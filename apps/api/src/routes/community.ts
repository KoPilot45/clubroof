import {
  ABSENCE_KINDS,
  type Absence,
  type NewsItem,
  type PollDetail,
  type PollSummary,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createAbsence, deleteAbsence, listAbsences } from '../services/absences';
import { getNews, setLike } from '../services/news';
import { getPoll, listPolls, vote } from '../services/polls';

const isoDate = z.iso.date();

/** News-Details, Umfragen und Abwesenheiten. */
export const communityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  // ── News ────────────────────────────────────────────────────────────────────
  app.get(
    '/news/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request): Promise<NewsItem> =>
      getNews(app.db, request.actor!, request.params.id, app.now()),
  );

  app.put(
    '/news/:id/like',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request): Promise<NewsItem> =>
      setLike(app.db, request.actor!, request.params.id, true, app.now()),
  );

  app.delete(
    '/news/:id/like',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request): Promise<NewsItem> =>
      setLike(app.db, request.actor!, request.params.id, false, app.now()),
  );

  // ── Umfragen ────────────────────────────────────────────────────────────────
  app.get(
    '/polls',
    { schema: { querystring: z.object({ teamId: z.uuid().optional() }) } },
    async (request): Promise<PollSummary[]> =>
      listPolls(app.db, request.actor!, app.now(), { teamId: request.query.teamId }),
  );

  app.get(
    '/polls/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request): Promise<PollDetail> =>
      getPoll(app.db, request.actor!, request.params.id, app.now()),
  );

  app.put(
    '/polls/:id/vote',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.object({ optionId: z.uuid() }),
      },
    },
    async (request): Promise<PollDetail> =>
      vote(app.db, request.actor!, request.params.id, request.body.optionId, app.now()),
  );

  // ── Abwesenheiten ───────────────────────────────────────────────────────────
  app.get('/absences', async (request): Promise<Absence[]> =>
    listAbsences(app.db, request.actor!, app.now()),
  );

  app.post(
    '/absences',
    {
      schema: {
        body: z.object({
          personId: z.uuid(),
          kind: z.enum(ABSENCE_KINDS),
          startsOn: isoDate,
          endsOn: isoDate,
          teamIds: z.array(z.uuid()).max(20).nullish(),
          note: z.string().trim().max(200).nullish(),
        }),
      },
    },
    async (request, reply) => {
      const absence = await createAbsence(app.db, request.actor!, request.body, app.now());
      return reply.status(201).send(absence);
    },
  );

  app.delete(
    '/absences/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      await deleteAbsence(app.db, request.actor!, request.params.id, app.now());
      return reply.status(204).send();
    },
  );
};
