/**
 * Mini-Forum (optionales Modul, Konzept §11): wenige Themen mit Ablaufdatum statt Dauer-Chat.
 * Themen eröffnen darf, wer News schreiben darf; antworten dürfen alle Mitglieder, solange das
 * Thema offen ist. Das Moderationsteam (News freigeben, vereinsweit) blendet Beiträge aus und
 * schließt Themen; gemeldete Beiträge landen dort als Benachrichtigung.
 */
import {
  can,
  scopesWith,
  type CreateForumTopicInput,
  type ForumOverview,
  type ForumPost,
  type ForumTopicDetail,
  type ForumTopicSummary,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, desc, eq, max } from 'drizzle-orm';
import { moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { notify } from './event-admin';

type TopicRow = typeof s.forumTopics.$inferSelect;

function requireForum(actor: Actor) {
  if (!moduleEnabled(actor, 'forum')) throw forbidden('Das Forum ist im Verein nicht aktiviert.');
}
const canCreate = (actor: Actor) => {
  const sc = scopesWith(actor.grants, 'news.create');
  return sc.all || sc.orgUnitIds.length > 0 || sc.teamIds.length > 0;
};
const canModerate = (actor: Actor) => can(actor.grants, 'news.publish', {});
const isOpen = (t: TopicRow, now: Date) => !t.closedAt && t.closesAt > now;
const name = (r: { firstName: string | null; lastName: string | null }) =>
  r.firstName ? `${r.firstName} ${r.lastName}` : null;

async function summaries(db: Db, actor: Actor, now: Date, id?: string) {
  const rows = await db
    .select({ topic: s.forumTopics, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.forumTopics)
    .leftJoin(s.persons, eq(s.persons.id, s.forumTopics.authorPersonId))
    .where(and(eq(s.forumTopics.clubId, actor.club.id), ...(id ? [eq(s.forumTopics.id, id)] : [])))
    .orderBy(desc(s.forumTopics.pinned), desc(s.forumTopics.createdAt))
    .limit(50);
  const stats = await db
    .select({ topicId: s.forumPosts.topicId, n: count(), last: max(s.forumPosts.createdAt) })
    .from(s.forumPosts)
    .where(eq(s.forumPosts.clubId, actor.club.id))
    .groupBy(s.forumPosts.topicId);
  return rows.map(({ topic, ...author }) => {
    const st = stats.find((x) => x.topicId === topic.id);
    const summary: ForumTopicSummary = {
      id: topic.id,
      title: topic.title,
      author: name(author),
      createdAt: topic.createdAt.toISOString(),
      closesAt: topic.closesAt.toISOString(),
      open: isOpen(topic, now),
      pinned: topic.pinned,
      postCount: Number(st?.n ?? 0),
      lastPostAt: st?.last ? new Date(st.last).toISOString() : null,
    };
    return { topic, summary };
  });
}

export async function getForum(db: Db, actor: Actor, now: Date): Promise<ForumOverview> {
  requireForum(actor);
  const list = await summaries(db, actor, now);
  // Abgelaufene Themen bleiben 30 Tage lesbar, dann verschwinden sie aus der Liste
  const keep = list.filter(
    ({ topic }) =>
      isOpen(topic, now) ||
      (topic.closedAt ?? topic.closesAt).getTime() > now.getTime() - 30 * 24 * 3_600_000,
  );
  return {
    topics: keep.map((x) => x.summary),
    canCreate: canCreate(actor),
    canModerate: canModerate(actor),
  };
}

export async function getTopic(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<ForumTopicDetail> {
  requireForum(actor);
  const [entry] = await summaries(db, actor, now, id);
  if (!entry) throw notFound('Das Thema');
  const mod = canModerate(actor);
  const rows = await db
    .select({ post: s.forumPosts, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.forumPosts)
    .leftJoin(s.persons, eq(s.persons.id, s.forumPosts.authorPersonId))
    .where(eq(s.forumPosts.topicId, id))
    .orderBy(asc(s.forumPosts.createdAt));
  const posts: ForumPost[] = rows.map(({ post, ...author }) => ({
    id: post.id,
    author: name(author) ?? 'Ehemaliges Mitglied',
    mine: post.authorUserId === actor.user.id,
    body: post.hiddenAt && !mod ? null : post.body,
    hidden: !!post.hiddenAt,
    reported: mod && !!post.reportedAt,
    createdAt: post.createdAt.toISOString(),
  }));
  return {
    ...entry.summary,
    body: entry.topic.body,
    posts,
    canPost: entry.summary.open,
    canModerate: mod,
  };
}

export async function createTopic(
  db: Db,
  actor: Actor,
  input: CreateForumTopicInput,
  now: Date,
): Promise<ForumTopicDetail> {
  requireForum(actor);
  if (!canCreate(actor)) throw forbidden('Themen eröffnen Verantwortliche im Verein.');
  const [topic] = await db
    .insert(s.forumTopics)
    .values({
      clubId: actor.club.id,
      title: input.title.trim(),
      body: input.body.trim(),
      authorPersonId: actor.person.id,
      closesAt: new Date(now.getTime() + input.days * 24 * 3_600_000),
      createdAt: now,
    })
    .returning({ id: s.forumTopics.id });
  return getTopic(db, actor, topic!.id, now);
}

export async function addPost(
  db: Db,
  actor: Actor,
  topicId: string,
  body: string,
  now: Date,
): Promise<ForumTopicDetail> {
  const topic = await getTopic(db, actor, topicId, now);
  if (!topic.canPost) throw new HttpError(409, 'closed', 'Das Thema ist geschlossen.');
  await db.insert(s.forumPosts).values({
    clubId: actor.club.id,
    topicId,
    authorPersonId: actor.person.id,
    authorUserId: actor.user.id,
    body: body.trim(),
    createdAt: now,
  });
  return getTopic(db, actor, topicId, now);
}

async function loadPost(db: Db, actor: Actor, id: string) {
  const [post] = await db
    .select()
    .from(s.forumPosts)
    .where(and(eq(s.forumPosts.id, id), eq(s.forumPosts.clubId, actor.club.id)));
  if (!post) throw notFound('Der Beitrag');
  return post;
}

/** Beitrag melden: das Moderationsteam wird benachrichtigt. */
export async function reportPost(db: Db, actor: Actor, id: string, now: Date) {
  requireForum(actor);
  const post = await loadPost(db, actor, id);
  if (!post.reportedAt) {
    await db.update(s.forumPosts).set({ reportedAt: now }).where(eq(s.forumPosts.id, id));
    const mods = await db
      .select({
        userId: s.persons.userId,
        permissions: s.roles.permissions,
        scopeType: s.roleAssignments.scopeType,
        scopeId: s.roleAssignments.scopeId,
      })
      .from(s.roleAssignments)
      .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
      .innerJoin(s.persons, eq(s.persons.id, s.roleAssignments.personId))
      .where(eq(s.roleAssignments.clubId, actor.club.id));
    await notify(
      db,
      actor,
      [
        ...new Set(
          mods.filter((m) => m.userId && can([m], 'news.publish', {})).map((m) => m.userId!),
        ),
      ],
      {
        level: 'action',
        topic: 'admin',
        title: 'Forum: Beitrag gemeldet',
        body: post.body.slice(0, 140),
        link: `/forum/${post.topicId}`,
      },
      now,
    );
  }
  return getTopic(db, actor, post.topicId, now);
}

export async function moderatePost(
  db: Db,
  actor: Actor,
  id: string,
  hidden: boolean,
  now: Date,
): Promise<ForumTopicDetail> {
  requireForum(actor);
  if (!canModerate(actor)) throw forbidden('Ausblenden kann das Moderationsteam.');
  const post = await loadPost(db, actor, id);
  await db
    .update(s.forumPosts)
    .set(
      hidden
        ? { hiddenAt: now, hiddenByPersonId: actor.person.id }
        : { hiddenAt: null, hiddenByPersonId: null, reportedAt: null },
    )
    .where(eq(s.forumPosts.id, id));
  return getTopic(db, actor, post.topicId, now);
}

export async function closeTopic(
  db: Db,
  actor: Actor,
  id: string,
  input: { closed?: boolean; pinned?: boolean },
  now: Date,
): Promise<ForumTopicDetail> {
  const topic = await getTopic(db, actor, id, now);
  if (!topic.canModerate) throw forbidden('Themen schließt das Moderationsteam.');
  await db
    .update(s.forumTopics)
    .set({
      ...(input.closed !== undefined ? { closedAt: input.closed ? now : null } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
    })
    .where(eq(s.forumTopics.id, id));
  return getTopic(db, actor, id, now);
}
