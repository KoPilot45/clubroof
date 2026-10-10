import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  isLocale,
  TILE_HUBS,
  type HomeResponse,
  type Locale,
  type MeResponse,
  type TileInfo,
} from '@clubroof/core';
import { z } from 'zod';
import { loadHome } from '../services/home';
import { getTileInfo } from '../services/tile-info';
import { buildMe, setPreferences } from '../services/me';

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/me', async (request): Promise<MeResponse> => buildMe(app.db, request.actor!));

  app.put(
    '/me/preferences',
    {
      schema: {
        body: z.object({
          colorMode: z.enum(['light', 'dark', 'system']).optional(),
          language: z.custom<Locale>(isLocale).nullable().optional(),
        }),
      },
    },
    async (request): Promise<MeResponse> => setPreferences(app.db, request.actor!, request.body),
  );

  app.get(
    '/tile-info',
    {
      schema: {
        querystring: z.object({ hub: z.enum(TILE_HUBS), teamId: z.uuid().optional() }),
      },
    },
    async (request): Promise<TileInfo> =>
      getTileInfo(
        app.db,
        request.actor!,
        request.query.hub,
        request.query.teamId ?? null,
        app.now(),
        { config: app.config, mailer: app.mailer },
      ),
  );

  app.get('/home', async (request): Promise<HomeResponse> =>
    loadHome(app.db, request.actor!, app.now()),
  );
};
