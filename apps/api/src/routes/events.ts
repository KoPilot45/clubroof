import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { EventDetail, EventSummary } from '@clubroof/core';
import { HttpError } from '../errors';
import {
  fetchEventRows,
  getEventDetail,
  respondToEvent,
  summarizeEvents,
} from '../services/events';
import { myEventsCondition } from '../services/home';

const DAY = 24 * 60 * 60 * 1000;

export const eventRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/events',
    {
      schema: {
        querystring: z.object({
          from: z.iso.datetime({ offset: true }).optional(),
          to: z.iso.datetime({ offset: true }).optional(),
        }),
      },
    },
    async (request): Promise<EventSummary[]> => {
      const now = app.now();
      const from = request.query.from ? new Date(request.query.from) : now;
      const to = request.query.to
        ? new Date(request.query.to)
        : new Date(from.getTime() + 28 * DAY);
      if (to.getTime() - from.getTime() > 120 * DAY || to < from) {
        throw new HttpError(400, 'invalid_range', 'Der Zeitraum darf höchstens 120 Tage umfassen.');
      }
      const rows = await fetchEventRows(app.db, myEventsCondition(request.actor!, from, to), 300);
      return summarizeEvents(app.db, request.actor!, rows, now);
    },
  );

  app.get(
    '/events/:eventId',
    { schema: { params: z.object({ eventId: z.uuid() }) } },
    async (request): Promise<EventDetail> =>
      getEventDetail(app.db, request.actor!, request.params.eventId, app.now()),
  );

  app.put(
    '/events/:eventId/responses/:personId',
    {
      schema: {
        params: z.object({ eventId: z.uuid(), personId: z.uuid() }),
        body: z.object({
          status: z.enum(['yes', 'no', 'maybe']),
          reason: z.string().trim().max(200).nullish(),
        }),
      },
    },
    async (request): Promise<EventSummary> =>
      respondToEvent(
        app.db,
        request.actor!,
        { ...request.params, status: request.body.status, reason: request.body.reason },
        app.now(),
      ),
  );
};
