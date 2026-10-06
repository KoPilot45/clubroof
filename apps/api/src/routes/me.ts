import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { HomeResponse, MeResponse } from '@clubroof/core';
import { z } from 'zod';
import { loadHome } from '../services/home';
import { buildMe, setColorMode } from '../services/me';

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/me', async (request): Promise<MeResponse> => buildMe(app.db, request.actor!));

  app.put(
    '/me/preferences',
    { schema: { body: z.object({ colorMode: z.enum(['light', 'dark', 'system']) }) } },
    async (request): Promise<MeResponse> =>
      setColorMode(app.db, request.actor!, request.body.colorMode),
  );

  app.get('/home', async (request): Promise<HomeResponse> =>
    loadHome(app.db, request.actor!, app.now()),
  );
};
