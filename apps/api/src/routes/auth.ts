import { verify } from '@node-rs/argon2';
import { schema as s } from '@clubroof/db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  LoginResponse,
  NoClubLoginResponse,
  TwoFactorChallenge,
  TwoFactorSetup,
  TwoFactorStatus,
} from '@clubroof/core';
import { loadActor } from '../actor';
import { createSession, deleteSession } from '../auth/session';
import { HttpError } from '../errors';
import { changePassword, requestPasswordReset, resetPassword } from '../services/account';
import { accountInfo } from '../services/account-club';
import { buildMe } from '../services/me';
import {
  completeChallenge,
  enableEmailTwoFactor,
  sendEmailCode,
  sendEmailCodeForChallenge,
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

type UserRow = typeof s.users.$inferSelect;
type Entry = Awaited<ReturnType<typeof loadActor>> | null;

/** Lädt den Actor des Kontos; `null` für ein Konto ohne Verein, alle anderen Gründe (gesperrt, ausgetreten) werfen. */
async function tryLoadActor(app: FastifyInstance, user: UserRow, now: Date): Promise<Entry> {
  try {
    return await loadActor(
      app.db,
      {
        sessionId: '',
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        twoFactorEnabled: user.totpSecret !== null || user.twoFactorEmail,
      },
      now,
      app.links,
      user.lastClubId,
    );
  } catch (e) {
    if (e instanceof HttpError && e.code === 'no_club') return null;
    throw e;
  }
}

async function enterSession(
  app: FastifyInstance,
  user: UserRow,
  entry: Entry,
  now: Date,
  userAgent: string | undefined,
): Promise<LoginResponse | NoClubLoginResponse> {
  const session = await createSession(app.db, user.id, {
    now,
    ttlDays: app.config.sessionTtlDays,
    userAgent,
    activeClubId: entry?.club.id ?? null,
  });
  await app.db.update(s.users).set({ lastLoginAt: now }).where(eq(s.users.id, user.id));
  const base = { token: session.token, expiresAt: session.expiresAt.toISOString() };
  if (!entry) return { ...base, me: null, account: await accountInfo(app.db, user.id) };
  return { ...base, me: await buildMe(app.db, entry) };
}

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
    async (request): Promise<LoginResponse | NoClubLoginResponse | TwoFactorChallenge> => {
      const { email, password } = request.body;
      const [user] = await app.db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
      const ok = await verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
      if (!user || !user.passwordHash || !ok) throw invalidLogin();

      const now = app.now();
      // Zuerst prüfen, ob das Konto noch zu einem aktiven Mitglied gehört (Sperre, Austritt) – erst dann Sitzung anlegen.
      // Ein Konto ganz ohne Verein darf sich anmelden und sieht den Hinweis in der App.
      const entry = await tryLoadActor(app, user, now);
      // Mit 2-Faktor: noch keine Sitzung, erst den Code abfragen
      if (user.totpSecret || user.twoFactorEmail) {
        const methods: TwoFactorChallenge['methods'] = [
          ...(user.totpSecret ? (['app'] as const) : []),
          ...(user.twoFactorEmail ? (['email'] as const) : []),
        ];
        // Nur E-Mail-Verfahren: Code sofort senden
        if (!user.totpSecret) await sendEmailCode(app.db, app.mailer, user.id, now);
        return {
          twoFactorRequired: true,
          challenge: await createChallenge(app.db, user.id, now),
          methods,
        };
      }
      return enterSession(app, user, entry, now, request.headers['user-agent']);
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
    async (request): Promise<LoginResponse | NoClubLoginResponse> => {
      const now = app.now();
      const userId = await completeChallenge(
        app.db,
        app.config,
        request.body.challenge,
        request.body.code,
        now,
      );
      const [user] = await app.db.select().from(s.users).where(eq(s.users.id, userId));
      const entry = await tryLoadActor(app, user!, now);
      return enterSession(app, user!, entry, now, request.headers['user-agent']);
    },
  );

  app.post(
    '/auth/2fa/email/send',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { body: z.object({ challenge: z.string().min(20).max(200) }) },
    },
    async (request, reply) => {
      await sendEmailCodeForChallenge(app.db, app.mailer, request.body.challenge, app.now());
      return reply.status(202).send({ ok: true });
    },
  );

  app.post(
    '/auth/2fa/email/start',
    { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      await sendEmailCode(app.db, app.mailer, request.actor!.user.id, app.now());
      return reply.status(202).send({ ok: true });
    },
  );

  app.post(
    '/auth/2fa/email/enable',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: app.config.loginRateLimit, timeWindow: '1 minute' } },
      schema: { body: z.object({ code: z.string().trim().min(6).max(10) }) },
    },
    async (request, reply) => {
      await enableEmailTwoFactor(app.db, request.actor!, request.body.code, app.now());
      return reply.status(204).send();
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
