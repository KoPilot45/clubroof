import {
  JERSEY_MODES,
  LINEUP_ROLES,
  MATCH_INCIDENT_KINDS,
  TRANSFER_KINDS,
  type JerseySettings,
  type MatchSheet,
  type TransferOverview,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getJerseys, getMatchSheet, saveJerseys, saveLineup, saveReport } from '../services/match';
import { createTransfer, listTransfers } from '../services/transfers';

const eventParams = z.object({ eventId: z.uuid() });
const teamParams = z.object({ teamId: z.uuid() });
const jersey = z.number().int().min(1).max(99).nullish();

/** Spielbetrieb: Aufstellung, Spielbericht, Rückennummern, Spielerbewegungen. */
export const matchRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/events/:eventId/match',
    { schema: { params: eventParams } },
    async (request): Promise<MatchSheet> =>
      getMatchSheet(app.db, request.actor!, request.params.eventId),
  );

  app.put(
    '/events/:eventId/lineup',
    {
      schema: {
        params: eventParams,
        body: z.object({
          entries: z
            .array(
              z.object({
                personId: z.uuid(),
                role: z.enum(LINEUP_ROLES),
                position: z.string().trim().max(30).nullish(),
                jerseyNumber: jersey,
              }),
            )
            .max(40),
          publish: z.boolean(),
        }),
      },
    },
    async (request): Promise<MatchSheet> =>
      saveLineup(app.db, request.actor!, request.params.eventId, request.body, app.now()),
  );

  app.put(
    '/events/:eventId/report',
    {
      schema: {
        params: eventParams,
        body: z.object({
          goalsFor: z.number().int().min(0).max(99),
          goalsAgainst: z.number().int().min(0).max(99),
          incidents: z
            .array(
              z.object({
                kind: z.enum(MATCH_INCIDENT_KINDS),
                personId: z.uuid().nullish(),
                assistPersonId: z.uuid().nullish(),
                minute: z.number().int().min(0).max(130).nullish(),
              }),
            )
            .max(60),
          complete: z.boolean(),
        }),
      },
    },
    async (request): Promise<MatchSheet> =>
      saveReport(app.db, request.actor!, request.params.eventId, request.body, app.now()),
  );

  app.get(
    '/teams/:teamId/jerseys',
    { schema: { params: teamParams } },
    async (request): Promise<JerseySettings> =>
      getJerseys(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.put(
    '/teams/:teamId/jerseys',
    {
      schema: {
        params: teamParams,
        body: z.object({
          mode: z.enum([...JERSEY_MODES, 'off']),
          numbers: z
            .array(
              z.object({ personId: z.uuid(), jerseyNumber: jersey.transform((v) => v ?? null) }),
            )
            .max(60)
            .optional(),
        }),
      },
    },
    async (request): Promise<JerseySettings> =>
      saveJerseys(app.db, request.actor!, request.params.teamId, request.body, app.now()),
  );

  app.get('/admin/transfers', async (request): Promise<TransferOverview> =>
    listTransfers(app.db, request.actor!),
  );

  app.post(
    '/admin/transfers',
    {
      schema: {
        body: z.object({
          personId: z.uuid(),
          kind: z.enum(TRANSFER_KINDS),
          fromTeamId: z.uuid().nullish(),
          toTeamId: z.uuid().nullish(),
          endsOn: z.iso.date().nullish(),
          externalClub: z.string().trim().max(80).nullish(),
          note: z.string().trim().max(300).nullish(),
          jerseyNumber: jersey,
        }),
      },
    },
    async (request, reply): Promise<TransferOverview> => {
      reply.code(201);
      return createTransfer(app.db, request.actor!, request.body, app.now());
    },
  );
};
