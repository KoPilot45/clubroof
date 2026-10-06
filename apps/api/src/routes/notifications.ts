import { schema as s } from '@clubroof/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { NotificationItem, NewsItem, NotificationSettings } from '@clubroof/core';
import { notFound } from '../errors';
import { loadNews } from '../services/home';
import {
  getNotificationSettings,
  registerDevice,
  unregisterDevice,
  updateNotificationSettings,
} from '../services/notification-settings';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const mode = z.enum(['push', 'app', 'off']);

export const notificationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/notifications', async (request): Promise<NotificationItem[]> => {
    const rows = await app.db
      .select()
      .from(s.notifications)
      .where(eq(s.notifications.userId, request.actor!.user.id))
      .orderBy(desc(s.notifications.createdAt))
      .limit(100);
    return rows.map((n) => ({
      id: n.id,
      level: n.level,
      category: n.category,
      topic: n.topic,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
      doneAt: n.doneAt?.toISOString() ?? null,
    }));
  });

  app.post(
    '/notifications/:id/read',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      const updated = await app.db
        .update(s.notifications)
        .set({ readAt: app.now() })
        .where(
          and(
            eq(s.notifications.id, request.params.id),
            eq(s.notifications.userId, request.actor!.user.id),
            isNull(s.notifications.readAt),
          ),
        )
        .returning({ id: s.notifications.id });
      if (updated.length === 0) {
        const [exists] = await app.db
          .select({ id: s.notifications.id })
          .from(s.notifications)
          .where(
            and(
              eq(s.notifications.id, request.params.id),
              eq(s.notifications.userId, request.actor!.user.id),
            ),
          );
        if (!exists) throw notFound('Die Benachrichtigung');
      }
      return reply.status(204).send();
    },
  );

  app.post('/notifications/read-all', async (request, reply) => {
    await app.db
      .update(s.notifications)
      .set({ readAt: app.now() })
      .where(
        and(eq(s.notifications.userId, request.actor!.user.id), isNull(s.notifications.readAt)),
      );
    return reply.status(204).send();
  });

  app.get('/me/notification-settings', async (request): Promise<NotificationSettings> =>
    getNotificationSettings(app.db, request.actor!),
  );

  app.put(
    '/me/notification-settings',
    {
      schema: {
        body: z.object({
          topics: z.record(z.string().max(30), mode).optional(),
          mutedTeamIds: z.array(z.uuid()).max(50).optional(),
          reminderHours: z
            .union([z.literal(0), z.literal(2), z.literal(6), z.literal(24), z.literal(48)])
            .optional(),
          quietHours: z.object({ enabled: z.boolean(), start: time, end: time }).optional(),
        }),
      },
    },
    async (request): Promise<NotificationSettings> =>
      updateNotificationSettings(app.db, request.actor!, request.body, app.now()),
  );

  app.post(
    '/me/devices',
    {
      schema: {
        body: z.object({
          token: z.string().regex(/^(Exponent|Expo)PushToken\[[\w-]+\]$/, 'Ungültiger Push-Token'),
          platform: z.enum(['ios', 'android', 'web']),
        }),
      },
    },
    async (request, reply) => {
      await registerDevice(
        app.db,
        request.actor!,
        request.body.token,
        request.body.platform,
        app.now(),
      );
      return reply.status(204).send();
    },
  );

  app.delete(
    '/me/devices',
    { schema: { body: z.object({ token: z.string().max(200) }) } },
    async (request, reply) => {
      await unregisterDevice(app.db, request.actor!, request.body.token);
      return reply.status(204).send();
    },
  );

  app.get('/news', async (request): Promise<NewsItem[]> =>
    loadNews(app.db, request.actor!, app.now(), 50),
  );
};
