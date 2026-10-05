import type { FacilityOccupancy } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createBlock, deleteBlock, getOccupancy } from '../services/facilities';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.iso.datetime({ offset: true });

export const facilityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/facilities/occupancy',
    { schema: { querystring: z.object({ from: day, to: day }) } },
    async (request): Promise<FacilityOccupancy> =>
      getOccupancy(app.db, request.actor!, request.query.from, request.query.to),
  );

  app.post(
    '/facilities/blocks',
    {
      schema: {
        body: z.object({
          facilityId: z.uuid(),
          startsAt: isoDateTime,
          endsAt: isoDateTime,
          reason: z.string().trim().min(2).max(160),
          cancelEvents: z.boolean().optional(),
        }),
      },
    },
    async (request, reply): Promise<FacilityOccupancy> => {
      reply.code(201);
      return createBlock(app.db, request.actor!, request.body, app.now());
    },
  );

  app.delete(
    '/facilities/blocks/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      await deleteBlock(app.db, request.actor!, request.params.id, app.now());
      return reply.code(204).send();
    },
  );
};
