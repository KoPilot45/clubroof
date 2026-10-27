import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type {
  AdminRecoveryInfo,
  OperatorInviteResult,
  OperatorOverview,
  SupportView,
} from '@clubroof/core';
import { z } from 'zod';
import {
  authenticateOperator,
  createSetupInvite,
  operatorOverview,
  revokeSetupInvite,
  setClubStatus,
} from '../services/operator';
import { completeRecovery, startRecovery, supportView } from '../services/support';

/** Betreiber-Konsole. Eigene Prüfung, nie über Vereinsrechte (`actorCan`): ein Betreiber hat keine. */
export const operatorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.decorateRequest('operatorUserId', '');
  app.addHook('preHandler', async (request) => {
    const user = await authenticateOperator(app.db, request.headers.authorization, app.now());
    request.operatorUserId = user.id;
  });

  app.get('/operator/overview', async (): Promise<OperatorOverview> =>
    operatorOverview(app.db, app.now()),
  );

  app.post(
    '/operator/setup-invites',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
      schema: {
        body: z.object({
          clubName: z.string().trim().min(2).max(120),
          adminEmail: z.string().trim().toLowerCase().email(),
        }),
      },
    },
    async (request, reply): Promise<OperatorInviteResult> => {
      reply.code(201);
      return createSetupInvite(
        app.db,
        app.mailer,
        request.operatorUserId,
        request.body,
        app.config.appUrl,
        app.now(),
      );
    },
  );

  app.delete(
    '/operator/setup-invites/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request, reply) => {
      await revokeSetupInvite(app.db, request.operatorUserId, request.params.id, app.now());
      reply.code(204);
    },
  );

  app.put(
    '/operator/clubs/:id/status',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ status: z.enum(['active', 'suspended', 'archived']) }),
      },
    },
    async (request, reply) => {
      await setClubStatus(
        app.db,
        request.operatorUserId,
        request.params.id,
        request.body.status,
        app.now(),
      );
      reply.code(204);
    },
  );

  /** Schreibgeschützte Support-Sicht – nur mit Freigabe des Vereins. */
  app.get(
    '/operator/clubs/:id/support',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request): Promise<SupportView> =>
      supportView(app.db, request.operatorUserId, request.params.id, app.now()),
  );

  app.post(
    '/operator/clubs/:id/admin-recovery',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          firstName: z.string().trim().min(1).max(60),
          lastName: z.string().trim().min(1).max(60),
          email: z.string().trim().toLowerCase().email(),
          note: z.string().trim().max(500).nullish(),
        }),
      },
    },
    async (request, reply): Promise<AdminRecoveryInfo> => {
      reply.code(201);
      return startRecovery(
        app.db,
        app.mailer,
        request.operatorUserId,
        request.params.id,
        request.body,
        app.now(),
      );
    },
  );

  app.post(
    '/operator/admin-recoveries/:id/complete',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request): Promise<AdminRecoveryInfo> =>
      completeRecovery(
        app.db,
        app.mailer,
        request.operatorUserId,
        request.params.id,
        app.config.appUrl,
        app.now(),
      ),
  );
};
