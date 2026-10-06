import type { CalendarFeed } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notFound } from '../errors';
import {
  calendarIcs,
  deleteCalendarFeed,
  getCalendarFeed,
  renewCalendarFeed,
} from '../services/calendar';

/** Abo-Link verwalten (angemeldet). */
export const calendarRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  const base = (host: string | undefined, protocol: string) =>
    app.config.publicUrl ?? `${protocol}://${host}`;

  app.get('/me/calendar', async (request): Promise<CalendarFeed> =>
    getCalendarFeed(
      app.db,
      request.actor!,
      base(request.headers.host, request.protocol),
      app.config.dataEncryptionKey,
    ),
  );

  app.post('/me/calendar', async (request): Promise<CalendarFeed> =>
    renewCalendarFeed(
      app.db,
      request.actor!,
      base(request.headers.host, request.protocol),
      app.config.dataEncryptionKey,
      app.now(),
    ),
  );

  app.delete('/me/calendar', async (request, reply) => {
    await deleteCalendarFeed(app.db, request.actor!);
    return reply.code(204).send();
  });
};

/** Der Abo-Link selbst (ohne Anmeldung, der Token ist das Geheimnis). */
export const calendarFeedRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/calendar/:file',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { params: z.object({ file: z.string().regex(/^[\w-]{20,64}\.ics$/) }) },
    },
    async (request, reply) => {
      const ics = await calendarIcs(
        app.db,
        request.params.file.slice(0, -4),
        app.config.appUrl,
        app.links,
        app.now(),
      );
      if (!ics) throw notFound('Der Kalender');
      return reply
        .header('content-type', 'text/calendar; charset=utf-8')
        .header('cache-control', 'private, max-age=900')
        .header('x-content-type-options', 'nosniff')
        .send(ics);
    },
  );
};
