import type { DemandDetail, ExchangeOverview } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  cancelDemand,
  createDemand,
  createOffer,
  deleteOffer,
  getDemand,
  getOverview,
  nominate,
  withdrawNomination,
} from '../services/exchange';

const id = z.object({ id: z.uuid() });

export const exchangeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/exchange', async (request): Promise<ExchangeOverview> =>
    getOverview(app.db, request.actor!, app.now()),
  );

  app.get(
    '/exchange/demands/:id',
    { schema: { params: id } },
    async (request): Promise<DemandDetail> =>
      getDemand(app.db, request.actor!, request.params.id, app.now()),
  );

  app.post(
    '/exchange/demands',
    {
      schema: {
        body: z.object({
          teamId: z.uuid(),
          eventId: z.uuid(),
          count: z.number().int().min(1).max(10),
          positions: z.array(z.string().max(40)).max(8).optional(),
          note: z.string().trim().max(300).nullish(),
        }),
      },
    },
    async (request, reply): Promise<DemandDetail> => {
      reply.code(201);
      return createDemand(app.db, request.actor!, request.body, app.now());
    },
  );

  app.delete('/exchange/demands/:id', { schema: { params: id } }, async (request, reply) => {
    await cancelDemand(app.db, request.actor!, request.params.id, app.now());
    return reply.code(204).send();
  });

  app.post(
    '/exchange/demands/:id/nominate',
    {
      schema: {
        params: id,
        body: z.object({ personId: z.uuid(), fromTeamId: z.uuid() }),
      },
    },
    async (request): Promise<DemandDetail> =>
      nominate(app.db, request.actor!, request.params.id, request.body, app.now()),
  );

  app.delete(
    '/exchange/demands/:id/nominations/:personId',
    { schema: { params: z.object({ id: z.uuid(), personId: z.uuid() }) } },
    async (request): Promise<DemandDetail> =>
      withdrawNomination(
        app.db,
        request.actor!,
        request.params.id,
        request.params.personId,
        app.now(),
      ),
  );

  app.post(
    '/exchange/offers',
    {
      schema: {
        body: z.object({
          teamId: z.uuid(),
          day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          count: z.number().int().min(1).max(10),
          note: z.string().trim().max(300).nullish(),
        }),
      },
    },
    async (request, reply): Promise<ExchangeOverview> => {
      reply.code(201);
      return createOffer(app.db, request.actor!, request.body, app.now());
    },
  );

  app.delete(
    '/exchange/offers/:id',
    { schema: { params: id } },
    async (request): Promise<ExchangeOverview> =>
      deleteOffer(app.db, request.actor!, request.params.id, app.now()),
  );
};
