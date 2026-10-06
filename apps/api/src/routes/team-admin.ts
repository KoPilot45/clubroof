import {
  PARTICIPATION_MODES,
  TEAM_TEMPLATES,
  type ModuleOverview,
  type TeamAdminOverview,
  type TeamDetailAdmin,
  type TeamModule,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  decideModule,
  getModuleOverview,
  setTeamModule,
  setUnitModule,
  unitModules,
} from '../services/modules';
import {
  createTeam,
  deleteTeam,
  getTeamAdmin,
  getTeamAdminDetail,
  prepareSeason,
  startSeason,
  updateTeam,
} from '../services/team-admin';

const id = z.object({ id: z.uuid() });
const teamFields = {
  name: z.string().trim().min(2).max(60),
  badge: z.string().trim().min(1).max(6),
  ageGroup: z.string().trim().max(30).nullish(),
  league: z.string().trim().max(80).nullish(),
  template: z.enum(TEAM_TEMPLATES),
  participationMode: z.enum(PARTICIPATION_MODES),
};

/** Module, Mannschaften und Saisonwechsel. Rechte prüfen die Services. */
export const teamAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/admin/modules', async (request): Promise<ModuleOverview> =>
    getModuleOverview(app.db, request.actor!, app.now()),
  );

  app.post(
    '/admin/modules/:key',
    {
      schema: {
        params: z.object({ key: z.string().max(40) }),
        body: z.object({ decision: z.enum(['enable', 'disable', 'later', 'decline']) }),
      },
    },
    async (request): Promise<ModuleOverview> =>
      decideModule(app.db, request.actor!, request.params.key, request.body.decision, app.now()),
  );

  app.get('/admin/teams', async (request): Promise<TeamAdminOverview> =>
    getTeamAdmin(app.db, request.actor!, app.now()),
  );

  app.post(
    '/admin/teams',
    {
      schema: {
        body: z.object({ ...teamFields, orgUnitId: z.uuid(), seasonId: z.uuid().nullish() }),
      },
    },
    async (request, reply): Promise<TeamDetailAdmin> => {
      reply.code(201);
      return createTeam(app.db, request.actor!, request.body, app.now());
    },
  );

  app.get(
    '/admin/teams/:id',
    { schema: { params: id } },
    async (request): Promise<TeamDetailAdmin> =>
      getTeamAdminDetail(app.db, request.actor!, request.params.id, app.now()),
  );

  app.patch(
    '/admin/teams/:id',
    { schema: { params: id, body: z.object(teamFields).partial() } },
    async (request): Promise<TeamDetailAdmin> =>
      updateTeam(app.db, request.actor!, request.params.id, request.body, app.now()),
  );

  app.delete('/admin/teams/:id', { schema: { params: id } }, async (request, reply) => {
    await deleteTeam(app.db, request.actor!, request.params.id, app.now());
    return reply.code(204).send();
  });

  app.get(
    '/admin/org-units/:id/modules',
    { schema: { params: id } },
    async (request): Promise<TeamModule[]> =>
      unitModules(app.db, request.actor!, request.params.id),
  );

  app.put(
    '/admin/org-units/:id/modules/:key',
    {
      schema: {
        params: id.extend({ key: z.string().max(40) }),
        body: z.object({ enabled: z.boolean().nullable() }),
      },
    },
    async (request): Promise<TeamModule[]> =>
      setUnitModule(
        app.db,
        request.actor!,
        request.params.id,
        request.params.key,
        request.body.enabled,
        app.now(),
      ),
  );

  app.put(
    '/admin/teams/:id/modules/:key',
    {
      schema: {
        params: id.extend({ key: z.string().max(40) }),
        body: z.object({ enabled: z.boolean() }),
      },
    },
    async (request): Promise<TeamModule[]> =>
      setTeamModule(
        app.db,
        request.actor!,
        request.params.id,
        request.params.key,
        request.body.enabled,
        app.now(),
      ),
  );

  app.post(
    '/admin/seasons/next',
    { schema: { body: z.object({ copyPlayers: z.boolean() }) } },
    async (request, reply): Promise<TeamAdminOverview> => {
      reply.code(201);
      return prepareSeason(app.db, request.actor!, request.body, app.now());
    },
  );

  app.post(
    '/admin/seasons/:id/start',
    { schema: { params: id } },
    async (request): Promise<TeamAdminOverview> =>
      startSeason(app.db, request.actor!, request.params.id, app.now()),
  );
};
