/**
 * Vereinswissen (optionales Modul): kurze Artikel zu Abläufen und Regeln. Lesen dürfen alle
 * Mitglieder; schreiben, wer Vereinseinstellungen oder vereinsweite Dokumente pflegt.
 */
import type { SaveWikiPageInput, WikiOverview, WikiPage } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { forbidden, notFound } from '../errors';

function requireWiki(actor: Actor) {
  if (!moduleEnabled(actor, 'wiki')) throw forbidden('Das Vereinswissen ist nicht aktiviert.');
}
const canEdit = (actor: Actor) =>
  actorCan(actor, 'club.settings.manage') || actorCan(actor, 'documents.manage');

const excerpt = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 140);

export async function getWiki(db: Db, actor: Actor): Promise<WikiOverview> {
  requireWiki(actor);
  const rows = await db
    .select()
    .from(s.wikiPages)
    .where(eq(s.wikiPages.clubId, actor.club.id))
    .orderBy(asc(s.wikiPages.category), asc(s.wikiPages.title));
  return {
    pages: rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      updatedAt: r.updatedAt.toISOString(),
      excerpt: excerpt(r.body),
    })),
    categories: [...new Set(rows.map((r) => r.category))],
    canEdit: canEdit(actor),
  };
}

export async function getWikiPage(db: Db, actor: Actor, id: string): Promise<WikiPage> {
  requireWiki(actor);
  const [row] = await db
    .select({ page: s.wikiPages, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.wikiPages)
    .leftJoin(s.persons, eq(s.persons.id, s.wikiPages.updatedByPersonId))
    .where(and(eq(s.wikiPages.id, id), eq(s.wikiPages.clubId, actor.club.id)));
  if (!row) throw notFound('Der Artikel');
  const { page } = row;
  return {
    id: page.id,
    title: page.title,
    category: page.category,
    updatedAt: page.updatedAt.toISOString(),
    excerpt: excerpt(page.body),
    body: page.body,
    updatedBy: row.firstName ? `${row.firstName} ${row.lastName}` : null,
  };
}

export async function saveWikiPage(
  db: Db,
  actor: Actor,
  id: string | null,
  input: SaveWikiPageInput,
  now: Date,
): Promise<WikiPage> {
  requireWiki(actor);
  if (!canEdit(actor)) throw forbidden('Artikel pflegt die Vereinsverwaltung.');
  const values = {
    title: input.title.trim(),
    category: input.category.trim(),
    body: input.body.trim(),
    updatedByPersonId: actor.person.id,
    updatedAt: now,
  };
  if (id) {
    const updated = await db
      .update(s.wikiPages)
      .set(values)
      .where(and(eq(s.wikiPages.id, id), eq(s.wikiPages.clubId, actor.club.id)))
      .returning({ id: s.wikiPages.id });
    if (!updated.length) throw notFound('Der Artikel');
    return getWikiPage(db, actor, id);
  }
  const [row] = await db
    .insert(s.wikiPages)
    .values({ clubId: actor.club.id, ...values, createdAt: now })
    .returning({ id: s.wikiPages.id });
  return getWikiPage(db, actor, row!.id);
}

export async function deleteWikiPage(db: Db, actor: Actor, id: string) {
  requireWiki(actor);
  if (!canEdit(actor)) throw forbidden('Artikel pflegt die Vereinsverwaltung.');
  await db
    .delete(s.wikiPages)
    .where(and(eq(s.wikiPages.id, id), eq(s.wikiPages.clubId, actor.club.id)));
}
