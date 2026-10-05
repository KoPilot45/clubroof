import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { Db } from '@clubroof/db';
import Fastify, { type FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { loadActor } from './actor';
import { findSessionUser } from './auth/session';
import type { Config } from './config';
import { HttpError, unauthorized } from './errors';
import { authRoutes } from './routes/auth';
import { clubRoutes, fileRoutes } from './routes/club';
import { createMailer, type Mailer } from './security/mailer';
import { twoFactorMissing } from './services/two-factor';
import { diskStorage, linkSigner, type FileStorage } from './storage/files';
import { communityRoutes } from './routes/community';
import { eventRoutes } from './routes/events';
import { meRoutes } from './routes/me';
import { notificationRoutes } from './routes/notifications';
import { adminRoutes } from './routes/admin';
import { editorialRoutes } from './routes/editorial';
import { teamAdminRoutes } from './routes/team-admin';
import { matchRoutes } from './routes/match';
import { invitationRoutes, joinRoutes } from './routes/invitations';
import { settingsRoutes, setupRoutes } from './routes/settings';
import { exchangeRoutes } from './routes/exchange';
import { facilityRoutes } from './routes/facilities';
import { profileRoutes } from './routes/profiles';
import { teamRoutes } from './routes/teams';

export type AppOptions = {
  db: Db;
  config: Config;
  storage?: FileStorage;
  mailer?: Mailer;
  now?: () => Date;
  logger?: boolean;
};

export async function buildApp({
  db,
  config,
  storage,
  mailer,
  now = () => new Date(),
  logger = false,
}: AppOptions) {
  const app = Fastify({
    // Signierte Download-Links sind länger als die Standardgrenze von 100 Zeichen
    routerOptions: { maxParamLength: 500 },
    logger: logger
      ? { redact: ['req.headers.authorization', 'req.body.password', 'req.body.newPassword'] }
      : false,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('db', db);
  app.decorate('config', config);
  app.decorate('now', now);
  app.decorate('storage', storage ?? diskStorage(config.uploadsDir));
  const links = linkSigner(config.fileSigningSecret);
  app.decorate('links', links);
  app.decorate(
    'mailer',
    mailer ??
      createMailer({ smtpUrl: config.smtpUrl, from: config.mailFrom }, (m) => app.log.info(m)),
  );
  app.decorateRequest('sessionUser', null);
  app.decorateRequest('actor', null);

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) throw unauthorized();
    const user = await findSessionUser(db, token, now());
    if (!user) throw unauthorized();
    request.sessionUser = user;
    request.actor = await loadActor(db, user, now(), links);
    // Vereinsvorgabe: Verwaltung nur mit eingerichteter 2-Faktor-Anmeldung
    const path = request.url.split('?')[0]!;
    if (
      twoFactorMissing(request.actor) &&
      ['/admin', '/invitations', '/join-requests', '/editorial'].some((p) => path.startsWith(p))
    ) {
      throw new HttpError(
        403,
        'two_factor_required',
        'Der Verein verlangt für die Verwaltung die 2-Faktor-Anmeldung. Bitte unter „Konto & Sicherheit“ einrichten.',
      );
    }
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type'],
  });
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: 'validation',
        message: 'Die Eingabe ist unvollständig oder ungültig.',
        details: error.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      });
    }
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply
        .status(429)
        .send({ error: 'rate_limited', message: 'Zu viele Versuche. Bitte warte eine Minute.' });
    }
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: 'internal', message: 'Es ist ein unerwarteter Fehler aufgetreten.' });
  });

  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(eventRoutes);
  await app.register(notificationRoutes);
  await app.register(communityRoutes);
  await app.register(teamRoutes);
  await app.register(clubRoutes);
  await app.register(profileRoutes);
  await app.register(exchangeRoutes);
  await app.register(adminRoutes);
  await app.register(editorialRoutes);
  await app.register(teamAdminRoutes);
  await app.register(matchRoutes);
  await app.register(invitationRoutes);
  await app.register(joinRoutes);
  await app.register(settingsRoutes);
  await app.register(setupRoutes);
  await app.register(facilityRoutes);
  await app.register(fileRoutes);

  return app;
}
