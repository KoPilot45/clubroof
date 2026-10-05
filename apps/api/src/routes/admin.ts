import {
  SCOPE_TYPES,
  TEAM_FUNCTIONS,
  type AdminOverview,
  type AuditEntry,
  type MemberDetail,
  type MemberListItem,
  type RoleCatalog,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  addMembership,
  assignRole,
  createMember,
  endMembership,
  getAdminOverview,
  getMember,
  getRoleCatalog,
  listAudit,
  listMembers,
  revokeRole,
  updateMember,
} from '../services/admin';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const memberParams = z.object({ personId: z.uuid() });
const optionalText = (max: number) => z.string().trim().max(max).nullish();

const memberFields = {
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  birthDate: isoDate.nullish(),
  email: z.string().trim().max(120).email().nullish().or(z.literal('')),
  phone: optionalText(30),
  memberNumber: optionalText(30),
  memberSince: isoDate.nullish(),
};

/** Verwaltungsbereich. Alle Rechte werden in `services/admin.ts` geprüft. */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/admin/overview', async (request): Promise<AdminOverview> =>
    getAdminOverview(app.db, request.actor!, app.now()),
  );

  app.get('/admin/audit', async (request): Promise<AuditEntry[]> =>
    listAudit(app.db, request.actor!),
  );

  app.get(
    '/admin/members',
    {
      schema: {
        querystring: z.object({
          q: z.string().max(60).optional(),
          status: z.enum(['active', 'inactive', 'left']).optional(),
          teamId: z.uuid().optional(),
          withoutTeam: z.enum(['true', 'false']).optional(),
        }),
      },
    },
    async (request): Promise<MemberListItem[]> =>
      listMembers(
        app.db,
        request.actor!,
        { ...request.query, withoutTeam: request.query.withoutTeam === 'true' },
        app.now(),
      ),
  );

  app.post(
    '/admin/members',
    { schema: { body: z.object(memberFields) } },
    async (request, reply): Promise<MemberDetail> => {
      reply.code(201);
      return createMember(app.db, request.actor!, request.body, app.now());
    },
  );

  app.get(
    '/admin/members/:personId',
    { schema: { params: memberParams } },
    async (request): Promise<MemberDetail> =>
      getMember(app.db, request.actor!, request.params.personId, app.now()),
  );

  app.patch(
    '/admin/members/:personId',
    {
      schema: {
        params: memberParams,
        body: z
          .object(memberFields)
          .partial()
          .extend({ status: z.enum(['active', 'inactive', 'left']).optional() }),
      },
    },
    async (request): Promise<MemberDetail> =>
      updateMember(app.db, request.actor!, request.params.personId, request.body, app.now()),
  );

  app.post(
    '/admin/members/:personId/memberships',
    {
      schema: {
        params: memberParams,
        body: z.object({
          teamId: z.uuid(),
          function: z.enum(TEAM_FUNCTIONS),
          jerseyNumber: z.number().int().min(1).max(99).nullish(),
          isPrimary: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<MemberDetail> =>
      addMembership(app.db, request.actor!, request.params.personId, request.body, app.now()),
  );

  app.delete(
    '/admin/members/:personId/memberships/:membershipId',
    { schema: { params: memberParams.extend({ membershipId: z.uuid() }) } },
    async (request): Promise<MemberDetail> =>
      endMembership(
        app.db,
        request.actor!,
        request.params.personId,
        request.params.membershipId,
        app.now(),
      ),
  );

  app.get('/admin/roles', async (request): Promise<RoleCatalog> =>
    getRoleCatalog(app.db, request.actor!),
  );

  app.post(
    '/admin/members/:personId/roles',
    {
      schema: {
        params: memberParams,
        body: z.object({
          roleKey: z.string().min(1).max(40),
          scopeType: z.enum(SCOPE_TYPES),
          scopeId: z.uuid().nullish(),
        }),
      },
    },
    async (request): Promise<MemberDetail> =>
      assignRole(app.db, request.actor!, request.params.personId, request.body, app.now()),
  );

  app.delete(
    '/admin/members/:personId/roles/:assignmentId',
    { schema: { params: memberParams.extend({ assignmentId: z.uuid() }) } },
    async (request): Promise<MemberDetail> =>
      revokeRole(
        app.db,
        request.actor!,
        request.params.personId,
        request.params.assignmentId,
        app.now(),
      ),
  );
};
