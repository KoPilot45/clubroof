import type {
  ClubTeamGroup,
  ContactGroup,
  DocumentItem,
  EventSummary,
  HelperEvent,
  HelperShift,
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
import { listHelperEvents, setAttendance, signUp, withdraw } from '../services/helpers';
import { placeholderPdf } from '../storage/files';

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
        .send(data);
    },
  );
};
