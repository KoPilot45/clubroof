import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { HomeResponse, MeResponse } from '@clubroof/core';
import { loadHome } from '../services/home';
import { buildMe } from '../services/me';

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/me', async (request): Promise<MeResponse> => buildMe(request.actor!));

  app.get('/home', async (request): Promise<HomeResponse> =>
    loadHome(app.db, request.actor!, app.now()),
  );
};
