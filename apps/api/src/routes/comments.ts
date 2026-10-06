import type { CommentItem } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { addComment, listComments } from '../services/comments';

const params = z.object({ type: z.enum(['news', 'demand', 'board']), id: z.uuid() });

/** Kommentare zu Freigaben und Anfragen. Rechte prüft `services/comments.ts`. */
export const commentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/comments/:type/:id', { schema: { params } }, async (request): Promise<CommentItem[]> =>
    listComments(app.db, request.actor!, request.params.type, request.params.id, app.now()),
  );

  app.post(
    '/comments/:type/:id',
    { schema: { params, body: z.object({ body: z.string().trim().min(1).max(1000) }) } },
    async (request, reply): Promise<CommentItem[]> => {
      reply.code(201);
      return addComment(
        app.db,
        request.actor!,
        request.params.type,
        request.params.id,
        request.body.body,
        app.now(),
      );
    },
  );
};
