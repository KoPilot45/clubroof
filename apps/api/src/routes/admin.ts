import {
  SCOPE_TYPES,
  TEAM_FUNCTIONS,
  type AdminOverview,
  type AuditEntry,
  type EventPlanning,
  type MemberDetail,
  type MemberImportResult,
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
  setIndividualPermissions,
  updateMember,
} from '../services/admin';
import { createClubEvent, getEventPlanning } from '../services/club-events';
import { decodeText } from '../services/csv';
import { importMembers } from '../services/member-import';

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

  app.post(
    '/admin/import/members',
    {
      bodyLimit: 3 * 1024 * 1024,
      schema: {
        body: z
          .object({
            csv: z.string().min(1).max(2_000_000).optional(),
            /** Datei wie hochgeladen – UTF-8 oder Windows-1252 (Excel) */
            dataBase64: z.string().min(1).max(2_800_000).optional(),
            commit: z.boolean(),
          })
          .refine((b) => !!b.csv !== !!b.dataBase64, 'Entweder csv oder dataBase64 angeben.'),
      },
    },
    async (request): Promise<MemberImportResult> =>
      importMembers(
        app.db,
        request.actor!,
        request.body.csv ?? decodeText(Buffer.from(request.body.dataBase64!, 'base64')),
        request.body.commit,
        app.now(),
      ),
  );

  app.get('/admin/club-events', async (request): Promise<EventPlanning> =>
    getEventPlanning(app.db, request.actor!, app.now()),
  );

  app.post(
    '/admin/club-events',
    {
      schema: {
        body: z.object({
          type: z.enum(['club_event', 'meeting', 'work_assignment']),
          title: z.string().trim().min(3).max(100),
          description: z.string().trim().max(2000).nullish(),
          startsAt: z.iso.datetime({ offset: true }),
          endsAt: z.iso.datetime({ offset: true }),
          orgUnitId: z.uuid().nullish(),
          facilityId: z.uuid().nullish(),
          locationText: z.string().trim().max(120).nullish(),
          locationUrl: z.string().trim().max(400).nullish(),
          program: z
            .array(
              z.object({
                time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
                title: z.string().trim().min(1).max(80),
              }),
            )
            .max(20)
            .optional(),
          shifts: z
            .array(
              z.object({
                title: z.string().trim().min(2).max(60),
                startsAt: z.iso.datetime({ offset: true }),
                endsAt: z.iso.datetime({ offset: true }),
                capacity: z.number().int().min(1).max(50),
              }),
            )
            .max(20)
            .optional(),
          allowConflict: z.boolean().optional(),
        }),
      },
    },
    async (request, reply): Promise<EventPlanning> => {
      reply.code(201);
      return createClubEvent(app.db, request.actor!, request.body, app.now());
    },
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
          roleKey: z.string().max(40).optional(),
          teamFunction: z
            .enum(['player', 'coach', 'assistant_coach', 'team_manager', 'coaches'])
            .optional(),
          account: z.enum(['yes', 'no']).optional(),
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

  app.put(
    '/admin/members/:personId/permissions',
    {
      schema: {
        params: memberParams,
        body: z.object({ permissions: z.array(z.string().max(60)).max(60) }),
      },
    },
    async (request): Promise<MemberDetail> =>
      setIndividualPermissions(
        app.db,
        request.actor!,
        request.params.personId,
        request.body,
        app.now(),
      ),
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
