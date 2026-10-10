import type { ClubSettings, LoginResponse } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { schema } from '@clubroof/db';
import { z } from 'zod';
import { loadActor } from '../actor';
import { createSession } from '../auth/session';
import {
  addOrgUnit,
  deleteOrgUnit,
  getClubSettings,
  renameOrgUnit,
  updateClub,
} from '../services/club-settings';
import { buildMe } from '../services/me';
import { needsSetup, setupClub } from '../services/setup';

// Erlaubte Vereinsfarben: eine Quelle (`@clubroof/design-tokens` → Datenbank-Enum), kein zweites Verzeichnis
const CLUB_COLOR_KEYS = schema.clubColorEnum.enumValues;
const KINDS = ['seniors', 'youth', 'women', 'veterans', 'other'] as const;
const unitName = z.string().trim().min(2).max(50);

/** Vereinseinstellungen (angemeldet). */
export const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/admin/club', async (request): Promise<ClubSettings> =>
    getClubSettings(app.db, request.actor!),
  );

  app.patch(
    '/admin/club',
    {
      schema: {
        body: z.object({
          name: z.string().trim().min(3).max(100).optional(),
          shortName: z.string().trim().min(2).max(40).optional(),
          colorTheme: z.enum(CLUB_COLOR_KEYS).optional(),
          colorMode: z.enum(['light', 'dark', 'system']).optional(),
          requireTwoFactor: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<ClubSettings> =>
      updateClub(app.db, request.actor!, request.body, app.now()),
  );

  app.post(
    '/admin/org-units',
    { schema: { body: z.object({ name: unitName, kind: z.enum(KINDS) }) } },
    async (request, reply): Promise<ClubSettings> => {
      reply.code(201);
      return addOrgUnit(app.db, request.actor!, request.body, app.now());
    },
  );

  app.patch(
    '/admin/org-units/:id',
    { schema: { params: z.object({ id: z.uuid() }), body: z.object({ name: unitName }) } },
    async (request): Promise<ClubSettings> =>
      renameOrgUnit(app.db, request.actor!, request.params.id, request.body.name, app.now()),
  );

  app.delete(
    '/admin/org-units/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request): Promise<ClubSettings> =>
      deleteOrgUnit(app.db, request.actor!, request.params.id, app.now()),
  );
};

/** Ersteinrichtung (ohne Anmeldung, nur auf einem leeren Server mit Einrichtungscode). */
export const setupRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/setup/status', async () => ({ needsSetup: await needsSetup(app.db) }));

  app.post(
    '/setup',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        body: z.object({
          setupToken: z.string().min(1).max(200),
          club: z.object({
            name: z.string().trim().min(3).max(100),
            shortName: z.string().trim().min(2).max(40),
            colorTheme: z.enum(CLUB_COLOR_KEYS),
          }),
          orgUnits: z
            .array(z.object({ name: unitName, kind: z.enum(KINDS) }))
            .min(1)
            .max(12),
          admin: z.object({
            firstName: z.string().trim().min(1).max(60),
            lastName: z.string().trim().min(1).max(60),
            email: z.string().trim().toLowerCase().email().max(120),
            password: z.string().max(200),
          }),
        }),
      },
    },
    async (request, reply): Promise<LoginResponse> => {
      const now = app.now();
      const { userId } = await setupClub(app.db, app.config, request.body, now);
      const session = await createSession(app.db, userId, {
        now,
        ttlDays: app.config.sessionTtlDays,
      });
      const actor = await loadActor(
        app.db,
        { sessionId: '', id: userId, email: request.body.admin.email, displayName: '' },
        now,
        app.links,
      );
      reply.code(201);
      return {
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        me: await buildMe(app.db, actor),
      };
    },
  );
};
