import type { SupportAccess } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getSupportAccess, grantSupport, objectRecovery, revokeSupport } from '../services/support';

/** Support-Freigabe und Widerspruch gegen die Admin-Wiederherstellung (Seite des Vereins). */
export const supportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/admin/support', async (request): Promise<SupportAccess> =>
    getSupportAccess(app.db, request.actor!, app.now()),
  );

  app.put(
    '/admin/support',
    { schema: { body: z.object({ hours: z.number().int() }) } },
    async (request): Promise<SupportAccess> =>
      grantSupport(app.db, request.actor!, request.body.hours, app.now()),
  );

  app.delete('/admin/support', async (request): Promise<SupportAccess> =>
    revokeSupport(app.db, request.actor!, app.now()),
  );

  app.post(
    '/admin/support/recoveries/:id/object',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (request): Promise<SupportAccess> =>
      objectRecovery(app.db, request.actor!, request.params.id, app.now()),
  );
};
