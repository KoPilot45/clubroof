import { ARCHIVE_KINDS, type ArchiveOverview, type PurgeArchiveResult } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  exportArchive,
  getArchive,
  purgeArchive,
  purgeEntry,
  restoreEntry,
} from '../services/archive';

const id = z.object({ id: z.uuid() });

/** Archiv gelöschter Einträge (Paket AR): ansehen, wiederherstellen, auf Anstoß endgültig löschen, exportieren. */
export const archiveRoutes: FastifyPluginAsyncZod = async (auth) => {
  const app = auth;
  auth.addHook('preHandler', app.authenticate);

  auth.get('/archive', async (request): Promise<ArchiveOverview> =>
    getArchive(app.db, request.actor!, app.now()),
  );

  auth.get('/archive/export', async (request) => exportArchive(app.db, request.actor!, app.now()));

  auth.post(
    '/archive/:id/restore',
    {
      schema: {
        params: id,
        body: z.object({ newName: z.string().trim().min(1).max(120).optional() }),
      },
    },
    async (request): Promise<ArchiveOverview> =>
      restoreEntry(app.db, request.actor!, request.params.id, request.body, app.now()),
  );

  auth.post(
    '/archive/purge',
    {
      schema: {
        body: z.object({
          mode: z.enum(['due', 'all']),
          kind: z.enum(ARCHIVE_KINDS).optional(),
        }),
      },
    },
    async (request): Promise<PurgeArchiveResult> =>
      purgeArchive(app.db, request.actor!, request.body, app.now()),
  );

  auth.delete(
    '/archive/:id',
    { schema: { params: id } },
    async (request): Promise<ArchiveOverview> =>
      purgeEntry(app.db, request.actor!, request.params.id, app.now()),
  );
};
