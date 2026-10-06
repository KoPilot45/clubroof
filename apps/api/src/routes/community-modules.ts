import {
  BOARD_KINDS,
  type BoardOverview,
  type ForumOverview,
  type ForumTopicDetail,
  type WikiOverview,
  type WikiPage,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { closeBoardItem, createBoardItem, getBoard } from '../services/board';
import {
  addPost,
  closeTopic,
  createTopic,
  getForum,
  getTopic,
  moderatePost,
  reportPost,
} from '../services/forum';
import { deleteWikiPage, getWiki, getWikiPage, saveWikiPage } from '../services/wiki';

const id = z.object({ id: z.uuid() });
const wikiBody = z.object({
  title: z.string().trim().min(3).max(100),
  category: z.string().trim().min(2).max(40),
  body: z.string().trim().min(1).max(10_000),
});

/** Optionale Vereinsmodule: Mini-Forum, Fundbüro/Marktplatz, Vereinswissen. */
export const communityModuleRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  // ── Forum
  app.get('/forum', async (request): Promise<ForumOverview> =>
    getForum(app.db, request.actor!, app.now()),
  );
  app.post(
    '/forum',
    {
      schema: {
        body: z.object({
          title: z.string().trim().min(3).max(100),
          body: z.string().trim().min(1).max(2000),
          days: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60)]),
        }),
      },
    },
    async (request, reply): Promise<ForumTopicDetail> => {
      reply.code(201);
      return createTopic(app.db, request.actor!, request.body, app.now());
    },
  );
  app.get('/forum/:id', { schema: { params: id } }, async (request): Promise<ForumTopicDetail> =>
    getTopic(app.db, request.actor!, request.params.id, app.now()),
  );
  app.patch(
    '/forum/:id',
    {
      schema: {
        params: id,
        body: z.object({ closed: z.boolean().optional(), pinned: z.boolean().optional() }),
      },
    },
    async (request): Promise<ForumTopicDetail> =>
      closeTopic(app.db, request.actor!, request.params.id, request.body, app.now()),
  );
  app.post(
    '/forum/:id/posts',
    { schema: { params: id, body: z.object({ body: z.string().trim().min(1).max(2000) }) } },
    async (request, reply): Promise<ForumTopicDetail> => {
      reply.code(201);
      return addPost(app.db, request.actor!, request.params.id, request.body.body, app.now());
    },
  );
  app.post(
    '/forum/posts/:id/report',
    { schema: { params: id } },
    async (request): Promise<ForumTopicDetail> =>
      reportPost(app.db, request.actor!, request.params.id, app.now()),
  );
  app.post(
    '/forum/posts/:id/moderate',
    { schema: { params: id, body: z.object({ hidden: z.boolean() }) } },
    async (request): Promise<ForumTopicDetail> =>
      moderatePost(app.db, request.actor!, request.params.id, request.body.hidden, app.now()),
  );

  // ── Fundbüro & Marktplatz
  app.get('/board', async (request): Promise<BoardOverview> =>
    getBoard(app.db, request.actor!, app.now()),
  );
  app.post(
    '/board',
    {
      schema: {
        body: z.object({
          kind: z.enum(BOARD_KINDS),
          title: z.string().trim().min(3).max(80),
          description: z.string().trim().max(1000).nullish(),
          detail: z.string().trim().max(80).nullish(),
          imageId: z.uuid().nullish(),
        }),
      },
    },
    async (request, reply): Promise<BoardOverview> => {
      reply.code(201);
      return createBoardItem(app.db, request.actor!, request.body, app.now());
    },
  );
  app.post('/board/:id/done', { schema: { params: id } }, async (request): Promise<BoardOverview> =>
    closeBoardItem(app.db, request.actor!, request.params.id, app.now()),
  );

  // ── Vereinswissen
  app.get('/wiki', async (request): Promise<WikiOverview> => getWiki(app.db, request.actor!));
  app.get('/wiki/:id', { schema: { params: id } }, async (request): Promise<WikiPage> =>
    getWikiPage(app.db, request.actor!, request.params.id),
  );
  app.post('/wiki', { schema: { body: wikiBody } }, async (request, reply): Promise<WikiPage> => {
    reply.code(201);
    return saveWikiPage(app.db, request.actor!, null, request.body, app.now());
  });
  app.put(
    '/wiki/:id',
    { schema: { params: id, body: wikiBody } },
    async (request): Promise<WikiPage> =>
      saveWikiPage(app.db, request.actor!, request.params.id, request.body, app.now()),
  );
  app.delete('/wiki/:id', { schema: { params: id } }, async (request, reply) => {
    await deleteWikiPage(app.db, request.actor!, request.params.id);
    return reply.code(204).send();
  });
};
