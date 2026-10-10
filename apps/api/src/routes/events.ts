import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Carpool, EventDetail, EventSummary } from '@clubroof/core';
import { HttpError } from '../errors';
import {
  fetchEventRows,
  getEventDetail,
  respondToEvent,
  recordAttendance,
  summarizeEvents,
} from '../services/events';
import { joinRide, leaveRide, offerRide, setRideRequest, withdrawOffer } from '../services/carpool';
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
          status: z.enum(['yes', 'no', 'maybe', 'pending']),
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

  app.put(
    '/events/:eventId/attendance-check',
    {
      schema: {
        params: z.object({ eventId: z.uuid() }),
        body: z.object({ present: z.array(z.uuid()).max(200) }),
      },
    },
    async (request): Promise<EventDetail> =>
      recordAttendance(
        app.db,
        request.actor!,
        request.params.eventId,
        request.body.present,
        app.now(),
      ),
  );

  // ── Fahrgemeinschaften ─────────────────────────────────────────────────
  const offerParams = z.object({ offerId: z.uuid() });

  app.put(
    '/events/:eventId/carpool/offer',
    {
      schema: {
        params: z.object({ eventId: z.uuid() }),
        body: z.object({
          seats: z.number().int().min(1).max(8),
          note: z.string().trim().max(120).nullish(),
        }),
      },
    },
    async (request): Promise<Carpool> =>
      offerRide(app.db, request.actor!, request.params.eventId, request.body, app.now()),
  );

  app.delete(
    '/carpool/offers/:offerId',
    { schema: { params: offerParams } },
    async (request): Promise<Carpool> =>
      withdrawOffer(app.db, request.actor!, request.params.offerId, app.now()),
  );

  app.put(
    '/carpool/offers/:offerId/passengers/:personId',
    { schema: { params: offerParams.extend({ personId: z.uuid() }) } },
    async (request): Promise<Carpool> =>
      joinRide(app.db, request.actor!, request.params.offerId, request.params.personId, app.now()),
  );

  app.delete(
    '/carpool/offers/:offerId/passengers/:personId',
    { schema: { params: offerParams.extend({ personId: z.uuid() }) } },
    async (request): Promise<Carpool> =>
      leaveRide(app.db, request.actor!, request.params.offerId, request.params.personId, app.now()),
  );

  app.put(
    '/events/:eventId/carpool/requests/:personId',
    {
      schema: {
        params: z.object({ eventId: z.uuid(), personId: z.uuid() }),
        body: z.object({ looking: z.boolean(), note: z.string().trim().max(120).nullish() }),
      },
    },
    async (request): Promise<Carpool> =>
      setRideRequest(
        app.db,
        request.actor!,
        request.params.eventId,
        request.params.personId,
        request.body,
        app.now(),
      ),
  );
};
