/**
 * News-Redaktion mit Freigabe (Mappe S. 8, Konzept §6/§10).
 *
 *  - Schreiben darf, wer `news.create` für den Geltungsbereich hat (Trainer für ihre Mannschaft,
 *    Jugendleitung für ihren Bereich, Vorstand für den Verein).
 *  - Veröffentlichen ohne Freigabe darf, wer `news.publish` für den Bereich hat. Alle anderen
 *    reichen zur Freigabe ein; Freigebende werden benachrichtigt, können freigeben oder mit
 *    Rückmeldung zurückgeben.
 *  - Wichtige und dringende News benachrichtigen beim Veröffentlichen alle im Geltungsbereich.
 */
import {
  calendarDayOf,
  can,
  toIsoDate,
  type EditorialNews,
  type EditorialOverview,
  type EditorialScope,
  type NewsReadReceipt,
  type Permission,
  type SaveNewsInput,
  type ScopeType,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq, gte, inArray, isNull, ne, or } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { mediaIdOf, resolveMediaUrl } from '../storage/media-links';
import { notify, recipientsFor } from './event-admin';
import { mediaReference } from './uploads';
import {
  labelOf,
  loadScopeContext as loadContext,
  targetOf,
  type ScopeContext as Context,
} from './scopes';

type NewsRow = typeof s.announcements.$inferSelect;
const allowed = (
  actor: Actor,
  permission: Permission,
  ctx: Context,
  row: Pick<NewsRow, 'scopeType' | 'scopeId'>,
) => {
  const target = targetOf(ctx, row.scopeType, row.scopeId);
  return target !== null && can(actor.grants, permission, target);
};

/** Bereiche, in denen ich schreiben darf. */
function writableScopes(actor: Actor, ctx: Context): EditorialScope[] {
  const all: { type: ScopeType; id: string | null }[] = [
    { type: 'club', id: null },
    ...ctx.units.map((u) => ({ type: 'org_unit' as const, id: u.id })),
    ...ctx.teams.map((t) => ({ type: 'team' as const, id: t.id })),
  ];
  return all
    .filter((sc) => can(actor.grants, 'news.create', targetOf(ctx, sc.type, sc.id)!))
    .map((sc) => ({
      ...sc,
      label: labelOf(ctx, sc.type, sc.id),
      canPublish: can(actor.grants, 'news.publish', targetOf(ctx, sc.type, sc.id)!),
    }));
}

export function newsPermissions(actor: Actor): { write: boolean; publish: boolean } {
  const has = (p: Permission) => actor.grants.some((g) => g.permissions.includes(p));
  return { write: has('news.create'), publish: has('news.publish') };
}

function toEditorial(
  row: NewsRow,
  actor: Actor,
  ctx: Context,
  authors: Map<string, string>,
): EditorialNews {
  const mine = row.authorPersonId === actor.person.id;
  const publish = allowed(actor, 'news.publish', ctx, row);
  const ownOpen = mine && (row.status === 'draft' || row.status === 'pending_approval');
  return {
    id: row.id,
    title: row.title,
    teaser: row.teaser,
    body: row.body,
    priority: row.priority,
    status: row.status,
    scope: {
      type: row.scopeType,
      id: row.scopeId,
      label: labelOf(ctx, row.scopeType, row.scopeId),
    },
    author: row.authorPersonId ? (authors.get(row.authorPersonId) ?? null) : null,
    mine,
    reviewNote: row.reviewNote,
    imageId: mediaIdOf(row.imageUrl),
    imageUrl: resolveMediaUrl(actor.links, row.imageUrl),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    can: {
      edit:
        (ownOpen && allowed(actor, 'news.create', ctx, row)) ||
        (publish && row.status !== 'archived'),
      publish: publish && row.status !== 'published' && row.status !== 'archived',
      remove: ownOpen || (publish && row.status !== 'archived'),
    },
  };
}

async function authorNames(db: Db, rows: NewsRow[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.authorPersonId).filter((x): x is string => !!x))];
  if (ids.length === 0) return new Map();
  const persons = await db
    .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.persons)
    .where(inArray(s.persons.id, ids));
  return new Map(persons.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
}

function requireWriter(actor: Actor) {
  if (!newsPermissions(actor).write)
    throw forbidden('News schreiben Trainer, Leitung und Vorstand.');
}

export async function getEditorialOverview(
  db: Db,
  actor: Actor,
  now: Date,
): Promise<EditorialOverview> {
  const perms = newsPermissions(actor);
  if (!perms.write && !perms.publish)
    throw forbidden('News schreiben Trainer, Leitung und Vorstand.');
  const ctx = await loadContext(db, actor);
  const recent = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(s.announcements)
    .where(
      and(
        eq(s.announcements.clubId, actor.club.id),
        ne(s.announcements.status, 'archived'),
        or(
          eq(s.announcements.authorPersonId, actor.person.id),
          eq(s.announcements.status, 'pending_approval'),
          and(eq(s.announcements.status, 'published'), gte(s.announcements.publishedAt, recent)),
        ),
      ),
    )
    .orderBy(desc(s.announcements.updatedAt));
  const authors = await authorNames(db, rows);
  const items = rows.map((r) => ({ row: r, item: toEditorial(r, actor, ctx, authors) }));
  return {
    scopes: writableScopes(actor, ctx),
    mine: items
      .filter(({ row }) => row.authorPersonId === actor.person.id && row.status !== 'published')
      .map((x) => x.item),
    toApprove: items
      .filter(({ row, item }) => row.status === 'pending_approval' && item.can.publish)
      .map((x) => x.item),
    published: items
      .filter(({ row, item }) => row.status === 'published' && item.can.edit)
      .sort((a, b) => (b.row.publishedAt?.getTime() ?? 0) - (a.row.publishedAt?.getTime() ?? 0))
      .slice(0, 20)
      .map((x) => x.item),
  };
}

async function loadForEditor(db: Db, actor: Actor, ctx: Context, id: string) {
  const [row] = await db
    .select()
    .from(s.announcements)
    .where(and(eq(s.announcements.id, id), eq(s.announcements.clubId, actor.club.id)));
  if (!row) throw notFound('Die Nachricht');
  const authors = await authorNames(db, [row]);
  const item = toEditorial(row, actor, ctx, authors);
  // Fremde Entwürfe und Einreichungen außerhalb meiner Freigaberechte bleiben unsichtbar
  if (!item.mine && !allowed(actor, 'news.publish', ctx, row)) throw notFound('Die Nachricht');
  return { row, item };
}

export async function getEditorialNews(db: Db, actor: Actor, id: string): Promise<EditorialNews> {
  const ctx = await loadContext(db, actor);
  return (await loadForEditor(db, actor, ctx, id)).item;
}

/** Wie viele aus dem Geltungsbereich die News gelesen haben (Konzept §11, optional). */
export async function getReadReceipt(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<NewsReadReceipt> {
  const ctx = await loadContext(db, actor);
  const { row, item } = await loadForEditor(db, actor, ctx, id);
  if (!item.mine && !item.can.publish)
    throw forbidden('Die Lesebestätigung sehen Verfasser und Freigebende.');
  if (row.status !== 'published')
    throw new HttpError(409, 'not_published', 'Die News ist noch nicht veröffentlicht.');
  const audience = await usersInScope(db, actor, ctx, row.scopeType, row.scopeId, now);
  const reads = audience.length
    ? await db
        .select({ userId: s.announcementReads.userId })
        .from(s.announcementReads)
        .where(
          and(
            eq(s.announcementReads.announcementId, id),
            inArray(s.announcementReads.userId, audience),
          ),
        )
    : [];
  const readers = new Set(reads.map((r) => r.userId));
  let unread: string[] | null = null;
  if (row.scopeType === 'team') {
    const missing = audience.filter((u) => !readers.has(u));
    unread = missing.length
      ? (
          await db
            .select({ name: s.users.displayName })
            .from(s.users)
            .where(inArray(s.users.id, missing))
        )
          .map((u) => u.name)
          .sort((a, b) => a.localeCompare(b, 'de'))
      : [];
  }
  return { read: readers.size, audience: audience.length, unread };
}

/** Nutzerkonten im Geltungsbereich (Mitglieder und deren Eltern). */
export async function usersInScope(
  db: Db,
  actor: Actor,
  ctx: Context,
  type: ScopeType,
  id: string | null,
  now: Date,
): Promise<string[]> {
  if (type === 'club') {
    const rows = await db
      .select({ userId: s.persons.userId })
      .from(s.persons)
      .where(and(eq(s.persons.clubId, actor.club.id), ne(s.persons.membershipStatus, 'left')));
    return [...new Set(rows.map((r) => r.userId).filter((u): u is string => !!u))].filter(
      (u) => u !== actor.user.id,
    );
  }
  const teamIds =
    type === 'team' ? [id!] : ctx.teams.filter((t) => t.orgUnitId === id).map((t) => t.id);
  if (teamIds.length === 0) return [];
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const members = await db
    .select({ personId: s.teamMemberships.personId })
    .from(s.teamMemberships)
    .where(
      and(
        inArray(s.teamMemberships.teamId, teamIds),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    );
  return recipientsFor(db, [...new Set(members.map((m) => m.personId))], actor.user.id);
}

async function authorUser(db: Db, actor: Actor, row: NewsRow): Promise<string[]> {
  if (!row.authorPersonId) return [];
  const [author] = await db
    .select({ userId: s.persons.userId })
    .from(s.persons)
    .where(eq(s.persons.id, row.authorPersonId));
  return author?.userId && author.userId !== actor.user.id ? [author.userId] : [];
}

/** Nutzer, die Einreichungen in diesem Bereich freigeben dürfen. */
async function publishersFor(db: Db, actor: Actor, ctx: Context, row: NewsRow): Promise<string[]> {
  const target = targetOf(ctx, row.scopeType, row.scopeId) ?? {};
  const rows = await db
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
  return [
    ...new Set(
      rows.filter((r) => r.userId && can([r], 'news.publish', target)).map((r) => r.userId!),
    ),
  ].filter((u) => u !== actor.user.id);
}

async function audit(db: Db, actor: Actor, action: string, id: string, label: string, now: Date) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: 'announcement',
    entityId: id,
    data: { label },
    createdAt: now,
  });
}

async function afterPublish(db: Db, actor: Actor, ctx: Context, row: NewsRow, now: Date) {
  await audit(db, actor, 'news.published', row.id, `News veröffentlicht: ${row.title}`, now);
  if (row.priority !== 'info') {
    await notify(
      db,
      actor,
      await usersInScope(db, actor, ctx, row.scopeType, row.scopeId, now),
      {
        level: row.priority === 'urgent' ? 'urgent' : 'important',
        topic: 'news',
        teamId: row.scopeType === 'team' ? row.scopeId : null,
        title: row.title,
        body: row.teaser ?? row.body.slice(0, 140),
        link: `/news/${row.id}`,
      },
      now,
    );
  }
}

function validateScope(actor: Actor, ctx: Context, input: SaveNewsInput) {
  const scopeId = input.scopeType === 'club' ? null : (input.scopeId ?? null);
  const target = targetOf(ctx, input.scopeType, scopeId);
  if (!target) throw new HttpError(400, 'invalid_scope', 'Unbekannter Bereich.');
  if (!can(actor.grants, 'news.create', target))
    throw forbidden('Für diesen Bereich darfst du keine News schreiben.');
  return { scopeId, canPublish: can(actor.grants, 'news.publish', target) };
}

async function applyAction(
  db: Db,
  actor: Actor,
  ctx: Context,
  row: NewsRow,
  action: SaveNewsInput['action'],
  canPublish: boolean,
  now: Date,
): Promise<void> {
  if (action === 'publish') {
    if (!canPublish)
      throw forbidden('Veröffentlichen darf hier nur die Freigabe. Bitte einreichen.');
    const [published] = await db
      .update(s.announcements)
      .set({
        status: 'published',
        publishedAt: now,
        reviewNote: null,
        reviewedByPersonId: actor.person.id,
      })
      .where(eq(s.announcements.id, row.id))
      .returning();
    await afterPublish(db, actor, ctx, published!, now);
  } else if (action === 'submit') {
    await db
      .update(s.announcements)
      .set({ status: 'pending_approval', reviewNote: null })
      .where(eq(s.announcements.id, row.id));
    await audit(
      db,
      actor,
      'news.submitted',
      row.id,
      `News zur Freigabe eingereicht: ${row.title}`,
      now,
    );
    await notify(
      db,
      actor,
      await publishersFor(db, actor, ctx, row),
      {
        level: 'action',
        topic: 'admin',
        title: 'News wartet auf Freigabe',
        body: `${row.title} · ${labelOf(ctx, row.scopeType, row.scopeId)}`,
        link: `/admin/news/${row.id}`,
      },
      now,
    );
  }
}

export async function createNews(
  db: Db,
  actor: Actor,
  input: SaveNewsInput,
  now: Date,
): Promise<EditorialNews> {
  requireWriter(actor);
  const ctx = await loadContext(db, actor);
  const { scopeId, canPublish } = validateScope(actor, ctx, input);
  const [row] = await db
    .insert(s.announcements)
    .values({
      clubId: actor.club.id,
      scopeType: input.scopeType,
      scopeId,
      title: input.title.trim(),
      teaser: input.teaser?.trim() || null,
      body: input.body.trim(),
      priority: input.priority,
      imageUrl: input.imageId ? await mediaReference(db, actor, input.imageId, 'news') : null,
      status: 'draft',
      authorPersonId: actor.person.id,
      createdAt: now,
    })
    .returning();
  await applyAction(db, actor, ctx, row!, input.action, canPublish, now);
  return getEditorialNews(db, actor, row!.id);
}

export async function updateNews(
  db: Db,
  actor: Actor,
  id: string,
  input: SaveNewsInput,
  now: Date,
): Promise<EditorialNews> {
  requireWriter(actor);
  const ctx = await loadContext(db, actor);
  const { row, item } = await loadForEditor(db, actor, ctx, id);
  if (!item.can.edit) throw forbidden('Diese Nachricht kannst du nicht mehr bearbeiten.');
  const { scopeId, canPublish } = validateScope(actor, ctx, input);
  if (row.status === 'published' && !canPublish)
    throw forbidden('Veröffentlichte News ändert nur die Freigabe.');

  const [updated] = await db
    .update(s.announcements)
    .set({
      scopeType: input.scopeType,
      scopeId,
      title: input.title.trim(),
      teaser: input.teaser?.trim() || null,
      body: input.body.trim(),
      priority: input.priority,
      ...(input.imageId !== undefined
        ? {
            imageUrl: input.imageId ? await mediaReference(db, actor, input.imageId, 'news') : null,
          }
        : {}),
    })
    .where(eq(s.announcements.id, id))
    .returning();
  if (row.status === 'published') {
    // Korrektur einer veröffentlichten Nachricht: bleibt veröffentlicht, keine neue Benachrichtigung
    await audit(db, actor, 'news.corrected', id, `News korrigiert: ${updated!.title}`, now);
  } else if (input.action === 'draft' && row.status === 'pending_approval' && item.mine) {
    // Autor holt die Einreichung zurück
    await db.update(s.announcements).set({ status: 'draft' }).where(eq(s.announcements.id, id));
  } else {
    await applyAction(db, actor, ctx, updated!, input.action, canPublish, now);
  }
  return getEditorialNews(db, actor, id);
}

export async function approveNews(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<EditorialNews> {
  const ctx = await loadContext(db, actor);
  const { row } = await loadForEditor(db, actor, ctx, id);
  if (!allowed(actor, 'news.publish', ctx, row)) throw forbidden('Freigeben darfst du hier nicht.');
  if (row.status !== 'pending_approval')
    throw new HttpError(409, 'not_pending', 'Diese Nachricht wartet nicht auf Freigabe.');
  const [published] = await db
    .update(s.announcements)
    .set({
      status: 'published',
      publishedAt: now,
      reviewNote: null,
      reviewedByPersonId: actor.person.id,
    })
    .where(eq(s.announcements.id, id))
    .returning();
  await afterPublish(db, actor, ctx, published!, now);
  await notify(
    db,
    actor,
    await authorUser(db, actor, row),
    {
      level: 'info',
      topic: 'news',
      title: 'Deine News ist veröffentlicht',
      body: row.title,
      link: `/news/${id}`,
    },
    now,
  );
  return getEditorialNews(db, actor, id);
}

export async function rejectNews(
  db: Db,
  actor: Actor,
  id: string,
  note: string,
  now: Date,
): Promise<EditorialNews> {
  const ctx = await loadContext(db, actor);
  const { row } = await loadForEditor(db, actor, ctx, id);
  if (!allowed(actor, 'news.publish', ctx, row)) throw forbidden('Freigeben darfst du hier nicht.');
  if (row.status !== 'pending_approval')
    throw new HttpError(409, 'not_pending', 'Diese Nachricht wartet nicht auf Freigabe.');
  await db
    .update(s.announcements)
    .set({ status: 'draft', reviewNote: note.trim(), reviewedByPersonId: actor.person.id })
    .where(eq(s.announcements.id, id));
  await audit(db, actor, 'news.rejected', id, `News zurückgegeben: ${row.title}`, now);
  await notify(
    db,
    actor,
    await authorUser(db, actor, row),
    {
      level: 'important',
      topic: 'admin',
      title: 'News zurückgegeben',
      body: `${row.title}: ${note.trim()}`,
      link: `/admin/news/${id}`,
    },
    now,
  );
  return getEditorialNews(db, actor, id);
}

export async function removeNews(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  const ctx = await loadContext(db, actor);
  const { row, item } = await loadForEditor(db, actor, ctx, id);
  if (!item.can.remove) throw forbidden('Diese Nachricht kannst du nicht entfernen.');
  if (row.status === 'published') {
    await db.update(s.announcements).set({ status: 'archived' }).where(eq(s.announcements.id, id));
    await audit(db, actor, 'news.archived', id, `News zurückgezogen: ${row.title}`, now);
  } else {
    await db.delete(s.announcements).where(eq(s.announcements.id, id));
  }
}
