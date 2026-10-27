import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  isLocale,
  TILE_HUBS,
  GUARDIAN_ACCESS,
  type ChildAccessInfo,
  type HomeResponse,
  type InviteLink,
  type MyGuardianAccess,
  type Locale,
  type MeResponse,
  type SearchResponse,
  type TileInfo,
} from '@clubroof/core';
import { z } from 'zod';
import { search } from '../services/search';
import { loadHome } from '../services/home';
import { getTileInfo } from '../services/tile-info';
import {
  answerGuardianRequest,
  getChildAccess,
  getMyGuardianAccess,
  inviteChild,
  revokeChildInvite,
  setChildAccess,
  setMyGuardianAccess,
} from '../services/child-access';
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

  // ── Eigener Zugang für Kinder ───────────────────────────────────────────────────────────
  const childParams = z.object({ childId: z.uuid() });
  const access = z.enum(GUARDIAN_ACCESS);
  const ctx = { config: app.config, mailer: app.mailer };

  app.get(
    '/me/children/:childId/access',
    { schema: { params: childParams } },
    async (request): Promise<ChildAccessInfo> =>
      getChildAccess(app.db, request.actor!, request.params.childId, app.now()),
  );

  app.post(
    '/me/children/:childId/access/invitation',
    {
      schema: {
        params: childParams,
        body: z.object({
          email: z.string().trim().max(120).email(),
          access,
          send: z.boolean().default(false),
        }),
      },
    },
    async (request, reply): Promise<InviteLink> => {
      reply.code(201);
      return inviteChild(
        app.db,
        request.actor!,
        ctx,
        request.params.childId,
        request.body,
        app.now(),
      );
    },
  );

  app.delete(
    '/me/children/:childId/access/invitation',
    { schema: { params: childParams } },
    async (request, reply) => {
      await revokeChildInvite(app.db, request.actor!, request.params.childId, app.now());
      return reply.code(204).send();
    },
  );

  app.put(
    '/me/children/:childId/access',
    { schema: { params: childParams, body: z.object({ access }) } },
    async (request): Promise<ChildAccessInfo> =>
      setChildAccess(
        app.db,
        request.actor!,
        request.params.childId,
        request.body.access,
        app.now(),
      ),
  );

  app.get('/me/guardian-access', async (request): Promise<MyGuardianAccess> =>
    getMyGuardianAccess(app.db, request.actor!),
  );

  app.put(
    '/me/guardian-access',
    { schema: { body: z.object({ access }) } },
    async (request): Promise<MyGuardianAccess> =>
      setMyGuardianAccess(app.db, request.actor!, request.body.access, app.now()),
  );

  app.post(
    '/me/guardian-access/answer',
    { schema: { body: z.object({ approve: z.boolean() }) } },
    async (request): Promise<MyGuardianAccess> =>
      answerGuardianRequest(app.db, request.actor!, request.body.approve, app.now()),
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
