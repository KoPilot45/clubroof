import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  isLocale,
  TILE_HUBS,
  type HomeResponse,
  type Locale,
  type MeResponse,
  type SearchResponse,
  type TileInfo,
} from '@clubroof/core';
import { z } from 'zod';
import { search } from '../services/search';
import { loadHome } from '../services/home';
import { getTileInfo } from '../services/tile-info';
import { buildMe, markSeen, setPreferences } from '../services/me';

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
          clubTiles: z
            .object({
              order: z.array(z.string().regex(/^[a-z][a-z0-9-]{1,30}$/)).max(40),
              hidden: z.array(z.string().regex(/^[a-z][a-z0-9-]{1,30}$/)).max(40),
            })
            .nullable()
            .optional(),
          quickLinks: z
            .array(z.string().regex(/^[a-z][a-z0-9-]{1,30}$/))
            .max(12)
            .nullable()
            .optional(),
        }),
      },
    },
    async (request): Promise<MeResponse> => setPreferences(app.db, request.actor!, request.body),
  );

  app.get(
    '/search',
    { schema: { querystring: z.object({ q: z.string().trim().min(2).max(60) }) } },
    async (request): Promise<SearchResponse> =>
      search(app.db, request.actor!, request.query.q, app.now()),
  );

  app.post(
    '/me/seen',
    {
      schema: {
        body: z.object({ key: z.string().regex(/^[a-z_]{2,30}(:[0-9a-f-]{36})?$/) }),
      },
    },
    async (request, reply) => {
      await markSeen(app.db, request.actor!, request.body.key, app.now());
      return reply.code(204).send();
    },
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
