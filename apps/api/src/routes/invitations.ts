import type { InviteLink, InviteOverview, JoinInfo, LoginResponse } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { loadActor } from '../actor';
import { createSession } from '../auth/session';
import { buildMe } from '../services/me';
import {
  acceptInvite,
  approveJoin,
  createTeamLink,
  getInviteOverview,
  getJoinInfo,
  invitePerson,
  rejectJoin,
  requestJoin,
  revokeTeamLink,
} from '../services/invitations';

const token = z.object({ token: z.string().min(20).max(200) });
const isoDate = z.iso.date();
const name = z.string().trim().min(1).max(60);

/** Einladen und Beitrittsanfragen freigeben (angemeldet). */
export const invitationRoutes: FastifyPluginAsyncZod = async (auth) => {
  const app = auth;
  const ctx = { config: app.config, mailer: app.mailer };
  auth.addHook('preHandler', app.authenticate);

  auth.get('/invitations', async (request): Promise<InviteOverview> =>
    getInviteOverview(app.db, request.actor!, ctx, app.now()),
  );

  auth.post(
    '/invitations/person',
    {
      schema: {
        body: z.object({
          personId: z.uuid(),
          email: z.string().trim().max(120).email().nullish(),
          send: z.boolean(),
        }),
      },
    },
    async (request, reply): Promise<InviteLink> => {
      reply.code(201);
      return invitePerson(app.db, request.actor!, ctx, request.body, app.now());
    },
  );

  auth.post(
    '/teams/:teamId/invite-link',
    { schema: { params: z.object({ teamId: z.uuid() }) } },
    async (request, reply): Promise<InviteLink> => {
      reply.code(201);
      return createTeamLink(app.db, request.actor!, ctx, request.params.teamId, app.now());
    },
  );

  auth.delete(
    '/teams/:teamId/invite-link',
    { schema: { params: z.object({ teamId: z.uuid() }) } },
    async (request, reply) => {
      await revokeTeamLink(app.db, request.actor!, request.params.teamId, app.now());
      return reply.code(204).send();
    },
  );

  auth.post(
    '/join-requests/:id/approve',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.object({ personId: z.uuid().nullish(), childPersonId: z.uuid().nullish() }),
      },
    },
    async (request): Promise<InviteOverview> =>
      approveJoin(app.db, request.actor!, ctx, request.params.id, request.body, app.now()),
  );

  auth.post(
    '/join-requests/:id/reject',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.object({ note: z.string().trim().max(300).nullish() }),
      },
    },
    async (request): Promise<InviteOverview> =>
      rejectJoin(
        app.db,
        request.actor!,
        ctx,
        request.params.id,
        request.body.note ?? null,
        app.now(),
      ),
  );
};

/** Öffentliche Einladungsseiten (ohne Anmeldung). */
export const joinRoutes: FastifyPluginAsyncZod = async (app) => {
  const limited = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

  app.get(
    '/join/:token',
    { ...limited, schema: { params: token } },
    async (request): Promise<JoinInfo> =>
      getJoinInfo(app.db, app.links, request.params.token, app.now()),
  );

  app.post(
    '/join/:token/accept',
    {
      ...limited,
      schema: {
        params: token,
        body: z.object({
          email: z.string().trim().toLowerCase().email().max(120),
          password: z.string().max(200),
        }),
      },
    },
    async (request): Promise<LoginResponse> => {
      const now = app.now();
      const { userId } = await acceptInvite(app.db, request.params.token, request.body, now);
      // Direkt angemeldet
      const session = await createSession(app.db, userId, {
        now,
        ttlDays: app.config.sessionTtlDays,
        userAgent: request.headers['user-agent'],
      });
      const actor = await loadActor(
        app.db,
        { sessionId: '', id: userId, email: request.body.email, displayName: '' },
        now,
        app.links,
      );
      return {
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        me: await buildMe(app.db, actor),
      };
    },
  );

  app.post(
    '/join/:token/request',
    {
      ...limited,
      schema: {
        params: token,
        body: z.object({
          email: z.string().trim().toLowerCase().email().max(120),
          password: z.string().max(200),
          relation: z.enum(['player', 'parent']),
          firstName: name,
          lastName: name,
          birthDate: isoDate.nullish(),
          childFirstName: name.nullish(),
          childLastName: name.nullish(),
          childBirthDate: isoDate.nullish(),
          message: z.string().trim().max(300).nullish(),
        }),
      },
    },
    async (request, reply) => {
      await requestJoin(app.db, request.params.token, request.body, app.now());
      return reply.code(202).send({ status: 'pending' });
    },
  );
};
