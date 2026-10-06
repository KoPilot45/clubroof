import {
  ANNOUNCEMENT_PRIORITIES,
  SCOPE_TYPES,
  type EditorialNews,
  type EditorialOverview,
  type NewsReadReceipt,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  approveNews,
  createNews,
  getEditorialNews,
  getEditorialOverview,
  getReadReceipt,
  rejectNews,
  removeNews,
  updateNews,
} from '../services/editorial';

const params = z.object({ id: z.uuid() });
const body = z.object({
  title: z.string().trim().min(3).max(120),
  teaser: z.string().trim().max(200).nullish(),
  body: z.string().trim().min(1).max(5000),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES),
  scopeType: z.enum(SCOPE_TYPES),
  scopeId: z.uuid().nullish(),
  action: z.enum(['draft', 'submit', 'publish']),
  imageId: z.uuid().nullish(),
});

/** News-Redaktion mit Freigabe. Rechte prüft `services/editorial.ts`. */
export const editorialRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/editorial/news', async (request): Promise<EditorialOverview> =>
    getEditorialOverview(app.db, request.actor!, app.now()),
  );

  app.get('/editorial/news/:id', { schema: { params } }, async (request): Promise<EditorialNews> =>
    getEditorialNews(app.db, request.actor!, request.params.id),
  );

  app.get(
    '/editorial/news/:id/reads',
    { schema: { params } },
    async (request): Promise<NewsReadReceipt> =>
      getReadReceipt(app.db, request.actor!, request.params.id, app.now()),
  );

  app.post(
    '/editorial/news',
    { schema: { body } },
    async (request, reply): Promise<EditorialNews> => {
      reply.code(201);
      return createNews(app.db, request.actor!, request.body, app.now());
    },
  );

  app.put(
    '/editorial/news/:id',
    { schema: { params, body } },
    async (request): Promise<EditorialNews> =>
      updateNews(app.db, request.actor!, request.params.id, request.body, app.now()),
  );

  app.post(
    '/editorial/news/:id/approve',
    { schema: { params } },
    async (request): Promise<EditorialNews> =>
      approveNews(app.db, request.actor!, request.params.id, app.now()),
  );

  app.post(
    '/editorial/news/:id/reject',
    { schema: { params, body: z.object({ note: z.string().trim().min(3).max(300) }) } },
    async (request): Promise<EditorialNews> =>
      rejectNews(app.db, request.actor!, request.params.id, request.body.note, app.now()),
  );

  app.delete('/editorial/news/:id', { schema: { params } }, async (request, reply) => {
    await removeNews(app.db, request.actor!, request.params.id, app.now());
    return reply.code(204).send();
  });
};
