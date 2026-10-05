import type { NewsItem } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, lte, sql } from 'drizzle-orm';
import type { Actor } from '../actor';
import { notFound } from '../errors';
import { likedByUser, scopeLabels, scopeVisible, toNewsItem } from './home';

async function loadVisible(db: Db, actor: Actor, id: string, now: Date) {
  const [row] = await db
    .select()
    .from(s.announcements)
    .where(
      and(
        eq(s.announcements.id, id),
        eq(s.announcements.clubId, actor.club.id),
        eq(s.announcements.status, 'published'),
        lte(s.announcements.publishedAt, now),
        scopeVisible(actor, s.announcements),
      ),
    );
  if (!row) throw notFound('Die Nachricht');
  return row;
}

/** Nachricht öffnen. Der erste Aufruf je Nutzer zählt als Aufruf (Grundlage für Lesebestätigung). */
export async function getNews(db: Db, actor: Actor, id: string, now: Date): Promise<NewsItem> {
  const row = await loadVisible(db, actor, id, now);
  const inserted = await db
    .insert(s.announcementReads)
    .values({ announcementId: id, userId: actor.user.id, readAt: now })
    .onConflictDoNothing()
    .returning({ id: s.announcementReads.announcementId });
  let viewCount = row.viewCount;
  if (inserted.length > 0) {
    const [updated] = await db
      .update(s.announcements)
      .set({ viewCount: sql`${s.announcements.viewCount} + 1` })
      .where(eq(s.announcements.id, id))
      .returning({ viewCount: s.announcements.viewCount });
    viewCount = updated?.viewCount ?? viewCount + 1;
  }
  const [labels, liked] = await Promise.all([
    scopeLabels(db, actor.club.id),
    likedByUser(db, actor.user.id, [id]),
  ]);
  return toNewsItem(actor, { ...row, viewCount }, labels, liked.has(id));
}

/** „Gefällt mir“ setzen oder entfernen. Mehrfaches Setzen zählt nur einmal. */
export async function setLike(
  db: Db,
  actor: Actor,
  id: string,
  like: boolean,
  now: Date,
): Promise<NewsItem> {
  await loadVisible(db, actor, id, now);
  const changed = like
    ? await db
        .insert(s.announcementLikes)
        .values({ announcementId: id, userId: actor.user.id, createdAt: now })
        .onConflictDoNothing()
        .returning({ id: s.announcementLikes.announcementId })
    : await db
        .delete(s.announcementLikes)
        .where(
          and(
            eq(s.announcementLikes.announcementId, id),
            eq(s.announcementLikes.userId, actor.user.id),
          ),
        )
        .returning({ id: s.announcementLikes.announcementId });
  if (changed.length > 0) {
    await db
      .update(s.announcements)
      .set({
        likeCount: like
          ? sql`${s.announcements.likeCount} + 1`
          : sql`greatest(${s.announcements.likeCount} - 1, 0)`,
      })
      .where(eq(s.announcements.id, id));
  }
  const row = await loadVisible(db, actor, id, now);
  const labels = await scopeLabels(db, actor.club.id);
  return toNewsItem(actor, row, labels, like);
}
