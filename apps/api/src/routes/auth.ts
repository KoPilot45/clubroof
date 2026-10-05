import { verify } from '@node-rs/argon2';
import { schema as s } from '@clubroof/db';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  LoginResponse,
  TwoFactorChallenge,
  TwoFactorSetup,
  TwoFactorStatus,
} from '@clubroof/core';
import { loadActor } from '../actor';
import { createSession, deleteSession } from '../auth/session';
import { HttpError } from '../errors';
import { changePassword, requestPasswordReset, resetPassword } from '../services/account';
import { pendingRequestState } from '../services/invitations';
import { buildMe } from '../services/me';
import {
  completeChallenge,
  createChallenge,
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  startSetup,
} from '../services/two-factor';

const invalidLogin = () =>
  new HttpError(401, 'invalid_credentials', 'E-Mail-Adresse oder Passwort ist nicht korrekt.');

// Vergleichswert, damit unbekannte E-Mail-Adressen gleich lange brauchen wie falsche Passwörter.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Ff0gWr0Hq8i5o4p2nWkHk2rAfFJwKfQe3zjDA1Qn0wY';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/login',
    {
      config: { rateLimit: { max: app.config.loginRateLimit, timeWindow: '1 minute' } },
      schema: {
        body: z.object({
          email: z.string().trim().toLowerCase().email(),
          password: z.string().min(1).max(200),
        }),
      },
    },
    async (request): Promise<LoginResponse | TwoFactorChallenge> => {
      const { email, password } = request.body;
      const [user] = await app.db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
      const ok = await verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
      if (!user || !user.passwordHash || !ok) throw invalidLogin();

      const now = app.now();
      // Konto ohne Vereinszuordnung: Beitrittsanfrage noch offen oder abgelehnt?
      const [linked] = await app.db
        .select({ id: s.persons.id })
        .from(s.persons)
        .where(eq(s.persons.userId, user.id));
      if (!linked) {
        const state = await pendingRequestState(app.db, user.id);
        if (state === 'pending')
          throw new HttpError(
            403,
            'request_pending',
            'Deine Beitrittsanfrage wartet noch auf Freigabe durch den Verein.',
          );
        if (state === 'rejected')
          throw new HttpError(
            403,
            'request_rejected',
            'Deine Beitrittsanfrage wurde nicht freigegeben.',
          );
      }
      // Zuerst prüfen, ob das Konto noch zu einem aktiven Mitglied gehört – erst dann Sitzung anlegen
      const actor = await loadActor(
        app.db,
        {
          sessionId: '',
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          twoFactorEnabled: user.totpSecret !== null,
        },
        now,
        app.links,
      );
      // Mit 2-Faktor: noch keine Sitzung, erst den Code abfragen
      if (user.totpSecret) {
        return { twoFactorRequired: true, challenge: await createChallenge(app.db, user.id, now) };
      }
      const session = await createSession(app.db, user.id, {
        now,
        ttlDays: app.config.sessionTtlDays,
        userAgent: request.headers['user-agent'],
      });
      await app.db.update(s.users).set({ lastLoginAt: now }).where(eq(s.users.id, user.id));
      return {
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        me: await buildMe(app.db, actor),
      };
    },
  );

  app.post(
    '/auth/password/forgot',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { body: z.object({ email: z.string().trim().toLowerCase().email() }) },
    },
    async (request, reply) => {
      await requestPasswordReset(app.db, app.mailer, app.config, request.body.email, app.now());
      // Immer dieselbe Antwort, egal ob das Konto existiert
      return reply.status(202).send({ ok: true });
    },
  );

  app.post(
    '/auth/password/reset',
    {
      config: { rateLimit: { max: app.config.loginRateLimit, timeWindow: '1 minute' } },
      schema: {
        body: z.object({ token: z.string().min(20).max(200), password: z.string().max(200) }),
      },
    },
    async (request, reply) => {
      await resetPassword(app.db, request.body.token, request.body.password, app.now());
      return reply.status(204).send();
    },
  );

  app.post(
    '/auth/password/change',
    {
      preHandler: app.authenticate,
      schema: {
        body: z.object({
          currentPassword: z.string().min(1).max(200),
          newPassword: z.string().max(200),
        }),
      },
    },
    async (request, reply) => {
      await changePassword(
        app.db,
        request.sessionUser!,
        request.body.currentPassword,
        request.body.newPassword,
        app.now(),
      );
      return reply.status(204).send();
    },
  );

  // ── 2-Faktor-Anmeldung ──────────────────────────────────────────────────
  app.post(
    '/auth/2fa/verify',
    {
      config: { rateLimit: { max: app.config.loginRateLimit, timeWindow: '1 minute' } },
      schema: {
        body: z.object({
          challenge: z.string().min(20).max(200),
          code: z.string().trim().min(6).max(20),
        }),
      },
    },
    async (request): Promise<LoginResponse> => {
      const now = app.now();
      const userId = await completeChallenge(
        app.db,
        app.config,
        request.body.challenge,
        request.body.code,
        now,
      );
      const [user] = await app.db.select().from(s.users).where(eq(s.users.id, userId));
      const actor = await loadActor(
        app.db,
        {
          sessionId: '',
          id: user!.id,
          email: user!.email,
          displayName: user!.displayName,
          twoFactorEnabled: true,
        },
        now,
        app.links,
      );
      const session = await createSession(app.db, user!.id, {
        now,
        ttlDays: app.config.sessionTtlDays,
        userAgent: request.headers['user-agent'],
      });
      await app.db.update(s.users).set({ lastLoginAt: now }).where(eq(s.users.id, user!.id));
      return {
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
        me: await buildMe(app.db, actor),
      };
    },
  );

  app.get(
    '/auth/2fa',
    { preHandler: app.authenticate },
    async (request): Promise<TwoFactorStatus> => getTwoFactorStatus(app.db, request.actor!),
  );

  app.post(
    '/auth/2fa/setup',
    { preHandler: app.authenticate },
    async (request): Promise<TwoFactorSetup> => startSetup(app.db, request.actor!, app.config),
  );

  app.post(
    '/auth/2fa/enable',
    {
      preHandler: app.authenticate,
      schema: { body: z.object({ code: z.string().trim().min(6).max(10) }) },
    },
    async (request) =>
      enableTwoFactor(app.db, request.actor!, app.config, request.body.code, app.now()),
  );

  app.post(
    '/auth/2fa/disable',
    {
      preHandler: app.authenticate,
      schema: {
        body: z.object({
          password: z.string().min(1).max(200),
          code: z.string().trim().min(6).max(20),
        }),
      },
    },
    async (request, reply) => {
      await disableTwoFactor(app.db, request.actor!, app.config, request.body, app.now());
      return reply.status(204).send();
    },
  );

  app.post('/auth/logout', { preHandler: app.authenticate }, async (request, reply) => {
    await deleteSession(app.db, request.sessionUser!.sessionId);
    return reply.status(204).send();
  });
};
