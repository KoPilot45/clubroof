/**
 * Fundbüro und Marktplatz (optionale Module): Aushänge mit Ablaufdatum. Rückfragen laufen über
 * Kommentare am Aushang (öffentlich für Mitglieder) – Kontaktdaten werden nicht angezeigt.
 */
import type { BoardItem, BoardKind, BoardOverview, CreateBoardItemInput } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { forbidden, notFound } from '../errors';
import { resolveMediaUrl } from '../storage/media-links';
import { mediaReference } from './uploads';

const DAYS = { found: 60, lost: 30, offer: 30, search: 30 } as const;
const LABEL = { found: 'Gefunden', lost: 'Verloren', offer: 'Biete', search: 'Suche' } as const;

function kindsFor(actor: Actor): BoardKind[] {
  return [
    ...(moduleEnabled(actor, 'lost_and_found') ? (['found', 'lost'] as const) : []),
    ...(moduleEnabled(actor, 'marketplace') ? (['offer', 'search'] as const) : []),
  ];
}

const mayClose = (actor: Actor, row: typeof s.boardItems.$inferSelect) =>
  row.authorUserId === actor.user.id || actorCan(actor, 'news.publish');

export async function getBoard(db: Db, actor: Actor, now: Date): Promise<BoardOverview> {
  const kinds = kindsFor(actor);
  if (kinds.length === 0) throw forbidden('Fundbüro und Marktplatz sind nicht aktiviert.');
  const week = new Date(now.getTime() - 7 * 24 * 3_600_000);
  const rows = await db
    .select({ item: s.boardItems, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.boardItems)
    .leftJoin(s.persons, eq(s.persons.id, s.boardItems.authorPersonId))
    .where(
      and(
        eq(s.boardItems.clubId, actor.club.id),
        inArray(s.boardItems.kind, kinds),
        gt(s.boardItems.expiresAt, now),
        // Erledigte bleiben eine Woche sichtbar
        or(isNull(s.boardItems.doneAt), gt(s.boardItems.doneAt, week)),
      ),
    )
    .orderBy(desc(s.boardItems.createdAt))
    .limit(100);
  const items: BoardItem[] = rows.map(({ item, firstName, lastName }) => ({
    id: item.id,
    kind: item.kind as BoardKind,
    title: item.title,
    description: item.description,
    detail: item.detail,
    imageUrl: resolveMediaUrl(actor.links, item.imageUrl, now),
    author: firstName ? `${firstName} ${lastName}` : null,
    mine: item.authorUserId === actor.user.id,
    createdAt: item.createdAt.toISOString(),
    expiresAt: item.expiresAt.toISOString(),
    done: !!item.doneAt,
    canClose: !item.doneAt && mayClose(actor, item),
  }));
  return { kinds, items };
}

export async function createBoardItem(
  db: Db,
  actor: Actor,
  input: CreateBoardItemInput,
  now: Date,
): Promise<BoardOverview> {
  if (!kindsFor(actor).includes(input.kind))
    throw forbidden(`„${LABEL[input.kind]}“ ist im Verein nicht aktiviert.`);
  await db.insert(s.boardItems).values({
    clubId: actor.club.id,
    kind: input.kind,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    detail: input.detail?.trim() || null,
    imageUrl: input.imageId ? await mediaReference(db, actor, input.imageId, 'board') : null,
    authorPersonId: actor.person.id,
    authorUserId: actor.user.id,
    expiresAt: new Date(now.getTime() + DAYS[input.kind] * 24 * 3_600_000),
    createdAt: now,
  });
  return getBoard(db, actor, now);
}

export async function closeBoardItem(db: Db, actor: Actor, id: string, now: Date) {
  const [row] = await db
    .select()
    .from(s.boardItems)
    .where(and(eq(s.boardItems.id, id), eq(s.boardItems.clubId, actor.club.id)));
  if (!row || !kindsFor(actor).includes(row.kind as BoardKind)) throw notFound('Der Aushang');
  if (!mayClose(actor, row)) throw forbidden('Erledigen kann, wer den Aushang erstellt hat.');
  await db.update(s.boardItems).set({ doneAt: now }).where(eq(s.boardItems.id, id));
  return getBoard(db, actor, now);
}

/** Beteiligte für Kommentare: Verfasser des Aushangs. */
export async function boardDiscussion(db: Db, actor: Actor, id: string) {
  const [row] = await db
    .select()
    .from(s.boardItems)
    .where(and(eq(s.boardItems.id, id), eq(s.boardItems.clubId, actor.club.id)));
  if (!row || !kindsFor(actor).includes(row.kind as BoardKind)) throw notFound('Der Aushang');
  return {
    title: `${LABEL[row.kind as BoardKind]}: ${row.title}`,
    link: `/board`,
    participants: row.authorUserId ? [row.authorUserId] : [],
  };
}
