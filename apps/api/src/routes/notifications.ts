import { schema as s } from '@clubroof/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { NotificationItem, NewsItem } from '@clubroof/core';
import { notFound } from '../errors';
import { loadNews } from '../services/home';

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

  app.get('/news', async (request): Promise<NewsItem[]> =>
    loadNews(app.db, request.actor!, app.now(), 50),
  );
};
