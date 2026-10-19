import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  type AreaOverview,
  AREA_KEYS,
  type ClubTeamPage,
  SCOPE_TYPES,
  type UploadedImage,
  type ClubCalendarEvent,
  type ClubSchedule,
  type ClubTeamGroup,
  type ContactGroup,
  type DocumentItem,
  type EventSummary,
  type HelperEvent,
  type HelperShift,
} from '@clubroof/core';
import { schema as s } from '@clubroof/db';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { HttpError, notFound } from '../errors';
import {
  listClubTeams,
  listContacts,
  listDocuments,
  listClubCalendar,
  getClubSchedule,
  listToday,
  loadVisibleDocument,
} from '../services/club';
import { cashReportCsv, cashReportPdf } from '../services/cash';
import { auditReportCsv, auditReportPdf } from '../services/club-audit';
import { receiptPdf } from '../services/club-donations';
import { closingCsv, closingPdf } from '../services/club-planning';
import { getClubTeamPage } from '../services/teams';
import { getAreaOverview } from '../services/area-overview';
import { listHelperEvents, setAttendance, signUp, withdraw } from '../services/helpers';
import { demoDocumentPdf } from '../storage/demo-documents';
import {
  deleteDocument,
  setClubLogo,
  updateDocument,
  uploadDocument,
  uploadImage,
} from '../services/uploads';

const LINK_VALIDITY_MS = 10 * 60 * 1000;

/** Vereinsleben: Helfer, Teilnahme, Dokumente, Mannschaften, Ansprechpartner, Heute. */
export const clubRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/club/areas',
    { schema: { querystring: z.object({ area: z.enum([...AREA_KEYS, 'all']).default('all') }) } },
    async (request): Promise<AreaOverview> =>
      getAreaOverview(app.db, request.actor!, request.query.area, app.now()),
  );

  app.get('/helpers', async (request): Promise<HelperEvent[]> =>
    listHelperEvents(app.db, request.actor!, app.now()),
  );

  const shiftParams = { params: z.object({ shiftId: z.uuid() }) };
  app.put(
    '/shifts/:shiftId/signup',
    { schema: shiftParams },
    async (request): Promise<HelperShift> =>
      signUp(app.db, request.actor!, request.params.shiftId, app.now()),
  );
  app.delete(
    '/shifts/:shiftId/signup',
    { schema: shiftParams },
    async (request): Promise<HelperShift> =>
      withdraw(app.db, request.actor!, request.params.shiftId, app.now()),
  );

  const eventParams = { params: z.object({ eventId: z.uuid() }) };
  app.put(
    '/events/:eventId/attendance',
    {
      schema: {
        ...eventParams,
        // ohne Angabe: Zusage (bisheriges Verhalten)
        body: z.object({ status: z.enum(['yes', 'no', 'maybe']) }).nullish(),
      },
    },
    async (request) =>
      setAttendance(
        app.db,
        request.actor!,
        request.params.eventId,
        request.body?.status ?? 'yes',
        app.now(),
      ),
  );
  app.delete('/events/:eventId/attendance', { schema: eventParams }, async (request) =>
    setAttendance(app.db, request.actor!, request.params.eventId, null, app.now()),
  );

  app.get(
    '/documents',
    {
      schema: {
        querystring: z.object({
          category: z.enum(['regulations', 'forms', 'training_plans', 'other']).optional(),
          q: z.string().max(80).optional(),
          teamId: z.uuid().optional(),
        }),
      },
    },
    async (request): Promise<DocumentItem[]> =>
      listDocuments(app.db, request.actor!, request.query),
  );

  // Base64 vergrößert um ein Drittel: 10 MB Datei ≈ 14 MB Anfrage
  app.post(
    '/documents',
    {
      bodyLimit: 15 * 1024 * 1024,
      schema: {
        body: z.object({
          title: z.string().trim().min(2).max(120),
          category: z.enum(['regulations', 'forms', 'training_plans', 'other']),
          scopeType: z.enum(SCOPE_TYPES),
          scopeId: z.uuid().nullish(),
          fileName: z.string().trim().min(1).max(200),
          dataBase64: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      reply.code(201);
      return uploadDocument(app.db, app.storage, request.actor!, request.body, app.now());
    },
  );

  app.patch(
    '/documents/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.object({
          title: z.string().trim().min(2).max(120).optional(),
          category: z.enum(['regulations', 'forms', 'training_plans', 'other']).optional(),
          scopeType: z.enum(SCOPE_TYPES).optional(),
          scopeId: z.uuid().nullish(),
        }),
      },
    },
    async (request, reply) => {
      await updateDocument(app.db, request.actor!, request.params.id, request.body, app.now());
      return reply.code(204).send();
    },
  );

  app.delete(
    '/documents/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      await deleteDocument(app.db, request.actor!, request.params.id, app.now());
      return reply.code(204).send();
    },
  );

  app.post(
    '/media',
    {
      bodyLimit: 8 * 1024 * 1024,
      schema: {
        body: z.object({
          purpose: z.enum(['news', 'logo', 'avatar', 'board', 'receipt', 'sponsor', 'claim']),
          fileName: z.string().trim().min(1).max(200),
          dataBase64: z.string().min(1),
        }),
      },
    },
    async (request, reply): Promise<UploadedImage> => {
      reply.code(201);
      return uploadImage(app.db, app.storage, request.actor!, request.body, app.now());
    },
  );

  app.put(
    '/club/logo',
    { schema: { body: z.object({ imageId: z.uuid().nullable() }) } },
    async (request) => setClubLogo(app.db, request.actor!, request.body.imageId, app.now()),
  );

  app.get(
    '/documents/:id/link',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request): Promise<{ url: string; expiresAt: string }> => {
      const doc = await loadVisibleDocument(app.db, request.actor!, request.params.id);
      const expiresAt = new Date(app.now().getTime() + LINK_VALIDITY_MS);
      const base = app.config.publicUrl ?? `${request.protocol}://${request.headers.host}`;
      return {
        url: `${base}/files/${app.links.create(doc.id, expiresAt)}`,
        expiresAt: expiresAt.toISOString(),
      };
    },
  );

  app.get('/club/teams', async (request): Promise<ClubTeamGroup[]> =>
    listClubTeams(app.db, request.actor!, app.now()),
  );
  app.get(
    '/club/teams/:teamId',
    { schema: { params: z.object({ teamId: z.uuid() }) } },
    async (request): Promise<ClubTeamPage> =>
      getClubTeamPage(app.db, request.actor!, request.params.teamId, app.now()),
  );
  app.get('/club/contacts', async (request): Promise<ContactGroup[]> =>
    listContacts(app.db, request.actor!, app.now()),
  );
  app.get(
    '/club/calendar',
    {
      schema: {
        querystring: z.object({
          from: z.iso.datetime({ offset: true }),
          to: z.iso.datetime({ offset: true }),
        }),
      },
    },
    async (request): Promise<ClubCalendarEvent[]> =>
      listClubCalendar(
        app.db,
        request.actor!,
        { from: new Date(request.query.from), to: new Date(request.query.to) },
        app.now(),
      ),
  );
  app.get(
    '/club/schedule',
    {
      schema: {
        querystring: z.object({
          week: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }),
      },
    },
    async (request): Promise<ClubSchedule> =>
      getClubSchedule(app.db, request.actor!, request.query.week, app.now()),
  );
  app.get('/club/today', async (request): Promise<EventSummary[]> =>
    listToday(app.db, request.actor!, app.now()),
  );
};

/** Feste Bilder der Marke und des Demovereins (öffentlich, nur diese Namen). */
const BRAND_FILES: Record<string, string> = { 'demo-wappen.png': 'image/png' };

export const brandRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/brand/:name',
    { schema: { params: z.object({ name: z.string().max(60) }) } },
    async (request, reply) => {
      const type = BRAND_FILES[request.params.name];
      if (!type) throw notFound('Das Bild');
      const file = await readFile(
        fileURLToPath(new URL(`../../assets/${request.params.name}`, import.meta.url)),
      );
      return reply
        .header('content-type', type)
        .header('cache-control', 'public, max-age=86400')
        .header('x-content-type-options', 'nosniff')
        .send(file);
    },
  );
};

/** Dateiabruf über signierten Link – ohne Anmelde-Header, damit Browser und Apps ihn öffnen können. */
export const fileRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/files/:token',
    { schema: { params: z.object({ token: z.string().max(400) }) } },
    async (request, reply) => {
      const documentId = app.links.verify(request.params.token, app.now());
      if (!documentId)
        throw new HttpError(404, 'link_invalid', 'Der Link ist abgelaufen oder ungültig.');
      if (documentId.startsWith('cp:')) {
        const report = await cashReportPdf(app.db, documentId.slice(3), app.now());
        if (!report) throw notFound('Der Kassenbericht');
        return reply
          .header('content-type', 'application/pdf')
          .header(
            'content-disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
          )
          .header('cache-control', 'no-store')
          .header('x-content-type-options', 'nosniff')
          .send(report.pdf);
      }
      if (documentId.startsWith('dp:')) {
        const report = await receiptPdf(app.db, documentId.slice(3));
        if (!report) throw notFound('Die Zuwendungsbestätigung');
        return reply
          .header('content-type', 'application/pdf')
          .header(
            'content-disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
          )
          .header('cache-control', 'no-store')
          .header('x-content-type-options', 'nosniff')
          .send(report.pdf);
      }
      if (documentId.startsWith('ap:') || documentId.startsWith('a:')) {
        const pdf = documentId.startsWith('ap:');
        const payload = documentId.slice(pdf ? 3 : 2);
        const report = pdf
          ? await auditReportPdf(app.db, payload, app.now())
          : await auditReportCsv(app.db, payload, app.now());
        if (!report) throw notFound('Der Prüfbericht');
        const body = 'pdf' in report ? report.pdf : report.csv;
        return reply
          .header('content-type', pdf ? 'application/pdf' : 'text/csv; charset=utf-8')
          .header(
            'content-disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
          )
          .header('cache-control', 'no-store')
          .header('x-content-type-options', 'nosniff')
          .send(body);
      }
      if (documentId.startsWith('kp:') || documentId.startsWith('k:')) {
        const pdf = documentId.startsWith('kp:');
        const payload = documentId.slice(pdf ? 3 : 2);
        const report = pdf
          ? await closingPdf(app.db, payload, app.now())
          : await closingCsv(app.db, payload, app.now());
        if (!report) throw notFound('Der Jahresabschluss');
        const body = 'pdf' in report ? report.pdf : report.csv;
        return reply
          .header('content-type', pdf ? 'application/pdf' : 'text/csv; charset=utf-8')
          .header(
            'content-disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
          )
          .header('cache-control', 'no-store')
          .header('x-content-type-options', 'nosniff')
          .send(body);
      }
      if (documentId.startsWith('c:')) {
        const report = await cashReportCsv(app.db, documentId.slice(2), app.now());
        if (!report) throw notFound('Der Kassenbericht');
        return reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header(
            'content-disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
          )
          .header('cache-control', 'no-store')
          .header('x-content-type-options', 'nosniff')
          .send(report.csv);
      }
      if (documentId.startsWith('m:')) {
        const [media] = await app.db
          .select()
          .from(s.media)
          .where(eq(s.media.id, documentId.slice(2)));
        const image = media ? await app.storage.read(media.storageKey) : null;
        if (!media || !image) throw notFound('Das Bild');
        return reply
          .header('content-type', media.mimeType)
          .header('cache-control', 'private, max-age=43200')
          .header('x-content-type-options', 'nosniff')
          .header('content-security-policy', "default-src 'none'")
          .send(image);
      }
      const [row] = await app.db
        .select({ doc: s.documents, clubName: s.clubs.name })
        .from(s.documents)
        .innerJoin(s.clubs, eq(s.clubs.id, s.documents.clubId))
        .where(eq(s.documents.id, documentId));
      if (!row) throw notFound('Die Datei');

      let data = await app.storage.read(row.doc.storageKey);
      let mimeType = row.doc.mimeType;
      let fileName = row.doc.fileName;
      if (!data && row.doc.storageKey.startsWith('demo/')) {
        data = demoDocumentPdf(row.doc.title, row.clubName);
        mimeType = 'application/pdf';
        fileName = `${row.doc.title}.pdf`;
      }
      if (!data) throw notFound('Die Datei');

      return reply
        .header('content-type', mimeType)
        .header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`)
        .header('cache-control', 'private, no-store')
        .header('x-content-type-options', 'nosniff')
        .header('content-security-policy', "default-src 'none'")
        .send(data);
    },
  );
};
