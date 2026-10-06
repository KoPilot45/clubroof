import type {
  ChangingRoomPlan,
  DamageOverview,
  EquipmentOverview,
  RefereeOverview,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  assignChangingRoom,
  createItem,
  deleteItem,
  getChangingRooms,
  getDamages,
  getEquipment,
  handOver,
  reportDamage,
  searchPeople,
  updateDamage,
} from '../services/equipment';
import {
  addReferee,
  assignReferee,
  getReferees,
  removeAssignment,
  respondAssignment,
} from '../services/referees';

const id = z.object({ id: z.uuid() });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Anlage & Material sowie Schiedsrichter (optionale Module). */
export const operationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/equipment/changing-rooms',
    { schema: { querystring: z.object({ date: isoDate }) } },
    async (request): Promise<ChangingRoomPlan> =>
      getChangingRooms(app.db, request.actor!, request.query.date),
  );
  app.put(
    '/events/:id/changing-room',
    { schema: { params: id, body: z.object({ roomId: z.uuid().nullable(), date: isoDate }) } },
    async (request): Promise<ChangingRoomPlan> =>
      assignChangingRoom(
        app.db,
        request.actor!,
        request.params.id,
        request.body.roomId,
        request.body.date,
      ),
  );

  app.get('/equipment', async (request): Promise<EquipmentOverview> =>
    getEquipment(app.db, request.actor!),
  );
  app.post(
    '/equipment',
    {
      schema: {
        body: z.object({
          kind: z.enum(['material', 'key']),
          name: z.string().trim().min(2).max(80),
          quantity: z.number().int().min(1).max(999),
          location: z.string().trim().max(80).nullish(),
          note: z.string().trim().max(300).nullish(),
        }),
      },
    },
    async (request, reply): Promise<EquipmentOverview> => {
      reply.code(201);
      return createItem(app.db, request.actor!, request.body, app.now());
    },
  );
  app.put(
    '/equipment/:id/holder',
    { schema: { params: id, body: z.object({ personId: z.uuid().nullable() }) } },
    async (request): Promise<EquipmentOverview> =>
      handOver(app.db, request.actor!, request.params.id, request.body.personId, app.now()),
  );
  app.delete(
    '/equipment/:id',
    { schema: { params: id } },
    async (request): Promise<EquipmentOverview> =>
      deleteItem(app.db, request.actor!, request.params.id),
  );
  app.get(
    '/equipment/people',
    { schema: { querystring: z.object({ q: z.string().trim().min(2).max(40) }) } },
    async (request) => searchPeople(app.db, request.actor!, request.query.q),
  );

  app.get('/damages', async (request): Promise<DamageOverview> =>
    getDamages(app.db, request.actor!, app.now()),
  );
  app.post(
    '/damages',
    {
      schema: {
        body: z.object({
          title: z.string().trim().min(3).max(100),
          description: z.string().trim().max(1000).nullish(),
          facilityId: z.uuid().nullish(),
          imageId: z.uuid().nullish(),
        }),
      },
    },
    async (request, reply): Promise<DamageOverview> => {
      reply.code(201);
      return reportDamage(app.db, request.actor!, request.body, app.now());
    },
  );
  app.patch(
    '/damages/:id',
    {
      schema: {
        params: id,
        body: z.object({
          status: z.enum(['open', 'in_progress', 'done']),
          resolution: z.string().trim().max(500).nullish(),
        }),
      },
    },
    async (request): Promise<DamageOverview> =>
      updateDamage(app.db, request.actor!, request.params.id, request.body, app.now()),
  );

  app.get('/referees', async (request): Promise<RefereeOverview> =>
    getReferees(app.db, request.actor!, app.now()),
  );
  app.post(
    '/referees',
    {
      schema: {
        body: z.object({ personId: z.uuid(), level: z.string().trim().max(40).nullish() }),
      },
    },
    async (request): Promise<RefereeOverview> =>
      addReferee(
        app.db,
        request.actor!,
        request.body.personId,
        request.body.level ?? null,
        app.now(),
      ),
  );
  app.post(
    '/referees/assignments',
    {
      schema: {
        body: z.object({
          eventId: z.uuid(),
          personId: z.uuid(),
          role: z.enum(['referee', 'assistant']).default('referee'),
        }),
      },
    },
    async (request): Promise<RefereeOverview> =>
      assignReferee(
        app.db,
        request.actor!,
        request.body.eventId,
        request.body.personId,
        request.body.role,
        app.now(),
      ),
  );
  app.post(
    '/referees/assignments/:id/respond',
    { schema: { params: id, body: z.object({ status: z.enum(['confirmed', 'declined']) }) } },
    async (request): Promise<RefereeOverview> =>
      respondAssignment(app.db, request.actor!, request.params.id, request.body.status, app.now()),
  );
  app.delete(
    '/referees/assignments/:id',
    { schema: { params: id } },
    async (request): Promise<RefereeOverview> =>
      removeAssignment(app.db, request.actor!, request.params.id, app.now()),
  );
};
