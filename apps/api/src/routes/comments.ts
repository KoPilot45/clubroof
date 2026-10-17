import type { CommentItem } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { addComment, deleteComment, listComments, updateComment } from '../services/comments';

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

  const commentId = z.object({ id: z.uuid() });

  app.patch(
    '/comments/:id',
    { schema: { params: commentId, body: z.object({ body: z.string().trim().min(1).max(1000) }) } },
    async (request): Promise<CommentItem[]> =>
      updateComment(app.db, request.actor!, request.params.id, request.body.body, app.now()),
  );

  app.delete(
    '/comments/:id',
    { schema: { params: commentId } },
    async (request): Promise<CommentItem[]> =>
      deleteComment(app.db, request.actor!, request.params.id, app.now()),
  );
};
