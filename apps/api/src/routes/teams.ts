import type {
  EventDetail,
  Facility,
  RosterEntry,
  TeamCash,
  TeamOverview,
  TeamStats,
} from '@clubroof/core';
import { schema as s } from '@clubroof/db';
import { asc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createBooking, getTeamCash } from '../services/cash';
import { cancelEvent, createTeamEvent } from '../services/event-admin';
import { getRoster, getTeamOverview, getTeamStats } from '../services/teams';

const teamParams = z.object({ teamId: z.uuid() });
const isoDateTime = z.iso.datetime({ offset: true });

/** Team-Cockpit, Kasse und Trainer-Funktionen. */
export const teamRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/teams/:teamId',
    { schema: { params: teamParams } },
    async (request): Promise<TeamOverview> =>
      getTeamOverview(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.get(
    '/teams/:teamId/roster',
    { schema: { params: teamParams } },
    async (request): Promise<RosterEntry[]> =>
      getRoster(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.get(
    '/teams/:teamId/stats',
    { schema: { params: teamParams } },
    async (request): Promise<TeamStats> =>
      getTeamStats(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.get(
    '/teams/:teamId/cash',
    { schema: { params: teamParams } },
    async (request): Promise<TeamCash> =>
      getTeamCash(app.db, request.actor!, request.params.teamId),
  );

  app.post(
    '/teams/:teamId/cash/bookings',
    {
      schema: {
        params: teamParams,
        body: z.object({
          kind: z.enum(['income', 'expense', 'fine', 'drinks', 'payment']),
          amountCents: z.number().int().min(1).max(1_000_000),
          description: z.string().trim().min(2).max(120),
          personId: z.uuid().nullish(),
          counterparty: z.string().trim().max(120).nullish(),
          bookedOn: z.iso.date().nullish(),
        }),
      },
    },
    async (request, reply) => {
      const cash = await createBooking(
        app.db,
        request.actor!,
        request.params.teamId,
        request.body,
        app.now(),
      );
      return reply.status(201).send(cash);
    },
  );

  app.post(
    '/teams/:teamId/events',
    {
      schema: {
        params: teamParams,
        body: z.object({
          type: z.enum(['training', 'match', 'team_event']),
          title: z.string().trim().max(120).nullish(),
          startsAt: isoDateTime,
          endsAt: isoDateTime.nullish(),
          meetingAt: isoDateTime.nullish(),
          meetingPoint: z.string().trim().max(120).nullish(),
          facilityId: z.uuid().nullish(),
          locationText: z.string().trim().max(160).nullish(),
          description: z.string().trim().max(1000).nullish(),
          opponentName: z.string().trim().max(80).nullish(),
          isHome: z.boolean().nullish(),
        }),
      },
    },
    async (request, reply): Promise<EventDetail> => {
      const event = await createTeamEvent(
        app.db,
        request.actor!,
        request.params.teamId,
        request.body,
        app.now(),
      );
      return reply.status(201).send(event);
    },
  );

  app.post(
    '/events/:eventId/cancel',
    {
      schema: {
        params: z.object({ eventId: z.uuid() }),
        body: z.object({ reason: z.string().trim().min(3).max(200) }),
      },
    },
    async (request): Promise<EventDetail> =>
      cancelEvent(app.db, request.actor!, request.params.eventId, request.body.reason, app.now()),
  );

  app.get('/facilities', async (request): Promise<Facility[]> =>
    app.db
      .select({ id: s.facilities.id, name: s.facilities.name, shortName: s.facilities.shortName })
      .from(s.facilities)
      .where(eq(s.facilities.clubId, request.actor!.club.id))
      .orderBy(asc(s.facilities.sortOrder)),
  );
};
