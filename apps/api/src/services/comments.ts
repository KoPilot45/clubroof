/**
 * Kommentare zu Freigaben und Anfragen (Konzept §11): kein offener Chat, sondern ein kurzer
 * Austausch der Beteiligten an genau einem Vorgang. Wer den Vorgang sehen darf, darf kommentieren;
 * die übrigen Beteiligten und alle, die schon kommentiert haben, werden benachrichtigt.
 */
import { can, type CommentEntity, type CommentItem } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq } from 'drizzle-orm';
import type { Actor } from '../actor';
import { forbidden, notFound } from '../errors';
import { boardDiscussion } from './board';
import { notify } from './event-admin';
import { newsDiscussion } from './editorial';
import { demandDiscussion } from './exchange';
import { resolveMediaUrl } from '../storage/media-links';

/** Moderation: wer News freigeben darf, löscht fremde Kommentare. */
const canModerate = (actor: Actor) => can(actor.grants, 'news.publish', {});

async function discussion(db: Db, actor: Actor, type: CommentEntity, id: string, now: Date) {
  if (type === 'news') return newsDiscussion(db, actor, id);
  if (type === 'board') return boardDiscussion(db, actor, id);
  return demandDiscussion(db, actor, id, now);
}

async function rows(db: Db, actor: Actor, type: CommentEntity, id: string) {
  return db
    .select({
      comment: s.comments,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
      avatar: s.persons.avatarUrl,
    })
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
    avatarUrl: resolveMediaUrl(actor.links, r.avatar),
    body: r.comment.body,
    createdAt: r.comment.createdAt.toISOString(),
    editedAt: r.comment.editedAt?.toISOString() ?? null,
    canEdit: r.comment.authorUserId === actor.user.id,
    canDelete: r.comment.authorUserId === actor.user.id || canModerate(actor),
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
      topic: type === 'news' ? 'admin' : type === 'board' ? 'news' : 'exchange',
      title: `Kommentar: ${d.title}`,
      body: `${actor.person.firstName}: ${body.trim().slice(0, 140)}`,
      link: d.link,
    },
    now,
  );
  return listComments(db, actor, type, id, now);
}

async function loadComment(db: Db, actor: Actor, id: string) {
  const [comment] = await db
    .select()
    .from(s.comments)
    .where(and(eq(s.comments.id, id), eq(s.comments.clubId, actor.club.id)));
  if (!comment) throw notFound('Der Kommentar');
  return comment;
}

/** Eigenen Kommentar ändern (Paket BE): nur wer ihn geschrieben hat und den Vorgang noch sehen darf. */
export async function updateComment(
  db: Db,
  actor: Actor,
  id: string,
  body: string,
  now: Date,
): Promise<CommentItem[]> {
  const comment = await loadComment(db, actor, id);
  const type = comment.entityType as CommentEntity;
  await discussion(db, actor, type, comment.entityId, now);
  if (comment.authorUserId !== actor.user.id)
    throw forbidden('Diesen Kommentar kannst du nicht ändern.');
  await db
    .update(s.comments)
    .set({ body: body.trim(), editedAt: now })
    .where(eq(s.comments.id, id));
  return listComments(db, actor, type, comment.entityId, now);
}

/** Kommentar löschen: der eigene oder – als Moderation – jeder (Paket BE). */
export async function deleteComment(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<CommentItem[]> {
  const comment = await loadComment(db, actor, id);
  const type = comment.entityType as CommentEntity;
  await discussion(db, actor, type, comment.entityId, now);
  if (comment.authorUserId !== actor.user.id && !canModerate(actor))
    throw forbidden('Diesen Kommentar kannst du nicht löschen.');
  await db.delete(s.comments).where(eq(s.comments.id, id));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'comment.delete',
    entityType: 'comment',
    entityId: id,
    data: { label: 'Kommentar gelöscht', own: comment.authorUserId === actor.user.id },
    createdAt: now,
  });
  return listComments(db, actor, type, comment.entityId, now);
}
