import type {
  ChangingRoomPlan,
  DamageOverview,
  EquipmentOverview,
  RefereeDuty,
  RefereeDutyResult,
  RefereeOverview,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  assignChangingRoom,
  createItem,
  deleteItem,
  updateItem,
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
  createDuty,
  deleteDuty,
  updateDuty,
  getReferees,
  listOwnDuties,
  searchRefereeCandidates,
  setSettings,
  updateReferee,
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
  app.patch(
    '/equipment/:id',
    {
      schema: {
        params: id,
        body: z.object({
          name: z.string().trim().min(2).max(80).optional(),
          quantity: z.number().int().min(1).max(999).optional(),
          location: z.string().trim().max(80).nullish(),
          note: z.string().trim().max(300).nullish(),
        }),
      },
    },
    async (request): Promise<EquipmentOverview> =>
      updateItem(app.db, request.actor!, request.params.id, request.body, app.now()),
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
      deleteItem(app.db, request.actor!, request.params.id, app.now()),
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
  /** Eigene Einsätze in einem Zeitraum (für Termine und Kalender) */
  app.get(
    '/referees/duties',
    {
      schema: {
        querystring: z.object({
          from: z.iso.datetime({ offset: true }),
          to: z.iso.datetime({ offset: true }),
        }),
      },
    },
    async (request): Promise<RefereeDuty[]> =>
      listOwnDuties(app.db, request.actor!, app.now(), {
        from: new Date(request.query.from),
        to: new Date(request.query.to),
      }),
  );
  app.get(
    '/referees/candidates',
    { schema: { querystring: z.object({ q: z.string().max(60) }) } },
    async (request) => searchRefereeCandidates(app.db, request.actor!, request.query.q),
  );
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  app.post(
    '/referees',
    {
      schema: {
        body: z.object({
          personId: z.uuid(),
          level: z.string().trim().max(40).nullish(),
          licenseValidUntil: day.nullish(),
        }),
      },
    },
    async (request, reply): Promise<RefereeOverview> => {
      reply.code(201);
      return addReferee(app.db, request.actor!, request.body, app.now());
    },
  );
  app.patch(
    '/referees/:personId',
    {
      schema: {
        params: z.object({ personId: z.uuid() }),
        body: z.object({
          level: z.string().trim().max(40).nullable().optional(),
          licenseValidUntil: day.nullable().optional(),
          active: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<RefereeOverview> =>
      updateReferee(app.db, request.actor!, request.params.personId, request.body, app.now()),
  );
  app.put(
    '/referees/settings',
    {
      schema: {
        body: z.object({
          requiredReferees: z.number().int().min(0).max(99),
          requiredMatches: z.number().int().min(0).max(99),
        }),
      },
    },
    async (request): Promise<RefereeOverview> =>
      setSettings(app.db, request.actor!, request.body, app.now()),
  );
  app.post(
    '/referees/duties',
    {
      schema: {
        body: z.object({
          title: z.string().trim().min(2).max(120),
          startsAt: z.iso.datetime({ offset: true }),
          durationMinutes: z.number().int().min(30).max(600).optional(),
          location: z.string().trim().max(120).nullish(),
          createAbsence: z.boolean().optional(),
        }),
      },
    },
    async (request, reply): Promise<RefereeDutyResult> => {
      reply.code(201);
      return createDuty(app.db, request.actor!, request.body, app.now());
    },
  );
  app.patch(
    '/referees/duties/:id',
    {
      schema: {
        params: id,
        body: z.object({
          title: z.string().trim().min(2).max(120).optional(),
          startsAt: z.iso.datetime({ offset: true }).optional(),
          durationMinutes: z.number().int().min(30).max(600).optional(),
          location: z.string().trim().max(120).nullish(),
        }),
      },
    },
    async (request): Promise<RefereeDutyResult> =>
      updateDuty(app.db, request.actor!, request.params.id, request.body, app.now()),
  );
  app.delete(
    '/referees/duties/:id',
    { schema: { params: id } },
    async (request): Promise<RefereeOverview> =>
      deleteDuty(app.db, request.actor!, request.params.id, app.now()),
  );
};
