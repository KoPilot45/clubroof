import {
  SCOPE_TYPES,
  type UploadedImage,
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
  listToday,
  loadVisibleDocument,
} from '../services/club';
import { cashReportCsv } from '../services/cash';
import { listHelperEvents, setAttendance, signUp, withdraw } from '../services/helpers';
import { placeholderPdf } from '../storage/files';
import { deleteDocument, setClubLogo, uploadDocument, uploadImage } from '../services/uploads';

const LINK_VALIDITY_MS = 10 * 60 * 1000;

/** Vereinsleben: Helfer, Teilnahme, Dokumente, Mannschaften, Ansprechpartner, Heute. */
export const clubRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

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
  app.put('/events/:eventId/attendance', { schema: eventParams }, async (request) =>
    setAttendance(app.db, request.actor!, request.params.eventId, true, app.now()),
  );
  app.delete('/events/:eventId/attendance', { schema: eventParams }, async (request) =>
    setAttendance(app.db, request.actor!, request.params.eventId, false, app.now()),
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

  app.delete(
    '/documents/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      await deleteDocument(app.db, app.storage, request.actor!, request.params.id, app.now());
      return reply.code(204).send();
    },
  );

  app.post(
    '/media',
    {
      bodyLimit: 8 * 1024 * 1024,
      schema: {
        body: z.object({
          purpose: z.enum(['news', 'logo', 'avatar', 'board']),
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
  app.get('/club/contacts', async (request): Promise<ContactGroup[]> =>
    listContacts(app.db, request.actor!, app.now()),
  );
  app.get('/club/today', async (request): Promise<EventSummary[]> =>
    listToday(app.db, request.actor!, app.now()),
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
        data = placeholderPdf(row.doc.title, row.clubName);
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
