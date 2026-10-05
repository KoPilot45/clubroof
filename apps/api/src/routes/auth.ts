import { verify } from '@node-rs/argon2';
import { schema as s } from '@clubroof/db';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { LoginResponse } from '@clubroof/core';
import { loadActor } from '../actor';
import { createSession, deleteSession } from '../auth/session';
import { HttpError } from '../errors';
import { buildMe } from '../services/me';

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
    async (request): Promise<LoginResponse> => {
      const { email, password } = request.body;
      const [user] = await app.db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
      const ok = await verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
      if (!user || !user.passwordHash || !ok) throw invalidLogin();

      const now = app.now();
      // Zuerst prüfen, ob das Konto noch zu einem aktiven Mitglied gehört – erst dann Sitzung anlegen
      const actor = await loadActor(
        app.db,
        { sessionId: '', id: user.id, email: user.email, displayName: user.displayName },
        now,
        app.links,
      );
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

  app.post('/auth/logout', { preHandler: app.authenticate }, async (request, reply) => {
    await deleteSession(app.db, request.sessionUser!.sessionId);
    return reply.status(204).send();
  });
};
