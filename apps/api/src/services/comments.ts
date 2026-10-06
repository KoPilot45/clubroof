/**
 * Kommentare zu Freigaben und Anfragen (Konzept §11): kein offener Chat, sondern ein kurzer
 * Austausch der Beteiligten an genau einem Vorgang. Wer den Vorgang sehen darf, darf kommentieren;
 * die übrigen Beteiligten und alle, die schon kommentiert haben, werden benachrichtigt.
 */
import type { CommentEntity, CommentItem } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq } from 'drizzle-orm';
import type { Actor } from '../actor';
import { notify } from './event-admin';
import { newsDiscussion } from './editorial';
import { demandDiscussion } from './exchange';

async function discussion(db: Db, actor: Actor, type: CommentEntity, id: string, now: Date) {
  return type === 'news' ? newsDiscussion(db, actor, id) : demandDiscussion(db, actor, id, now);
}

async function rows(db: Db, actor: Actor, type: CommentEntity, id: string) {
  return db
    .select({ comment: s.comments, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.comments)
    .leftJoin(s.persons, eq(s.persons.id, s.comments.authorPersonId))
    .where(
      and(
        eq(s.comments.clubId, actor.club.id),
        eq(s.comments.entityType, type),
        eq(s.comments.entityId, id),
      ),
    )
    .orderBy(asc(s.comments.createdAt));
}

export async function listComments(
  db: Db,
  actor: Actor,
  type: CommentEntity,
  id: string,
  now: Date,
): Promise<CommentItem[]> {
  await discussion(db, actor, type, id, now);
  return (await rows(db, actor, type, id)).map((r) => ({
    id: r.comment.id,
    author: r.firstName ? `${r.firstName} ${r.lastName}` : 'Ehemaliges Mitglied',
    mine: r.comment.authorUserId === actor.user.id,
    body: r.comment.body,
    createdAt: r.comment.createdAt.toISOString(),
  }));
}

export async function addComment(
  db: Db,
  actor: Actor,
  type: CommentEntity,
  id: string,
  body: string,
  now: Date,
): Promise<CommentItem[]> {
  const d = await discussion(db, actor, type, id, now);
  const before = await rows(db, actor, type, id);
  await db.insert(s.comments).values({
    clubId: actor.club.id,
    entityType: type,
    entityId: id,
    authorPersonId: actor.person.id,
    authorUserId: actor.user.id,
    body: body.trim(),
    createdAt: now,
  });
  const earlier = before.map((r) => r.comment.authorUserId).filter((u): u is string => !!u);
  await notify(
    db,
    actor,
    [...new Set([...d.participants, ...earlier])].filter((u) => u !== actor.user.id),
    {
      level: 'important',
      topic: type === 'news' ? 'admin' : 'exchange',
      title: `Kommentar: ${d.title}`,
      body: `${actor.person.firstName}: ${body.trim().slice(0, 140)}`,
      link: d.link,
    },
    now,
  );
  return listComments(db, actor, type, id, now);
}
