/**
 * Archiv (Paket AR): Löschen heißt archivieren. Beim Löschen wird ein Abbild des Eintrags im Archiv abgelegt, danach
 * verschwindet der Eintrag aus der Liste; wiederhergestellt wird mit der ursprünglichen ID. Endgültig gelöscht wird nur
 * auf Anstoß (Bereinigen, Archiv leeren) und nur mit dem Recht `archive.purge`; Einträge mit laufender gesetzlicher
 * Aufbewahrung (`retain_until`) bleiben. Jede Bereinigung steht im Änderungsprotokoll, ohne die Inhalte.
 */
import {
  ARCHIVE_KINDS,
  ARCHIVE_RETENTION_YEARS,
  type ArchiveEntry,
  type ArchiveKind,
  type ArchiveOverview,
  type PurgeArchiveInput,
  type PurgeArchiveResult,
  type RestoreArchiveInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';

type Payload = Record<string, unknown>;
type Archived = { originalId: string; label: string; detail: string | null; payload: Payload };

/** Wie eine Art archiviert und wiederhergestellt wird. */
type Handler = {
  /** Wiederherstellen: `name` ist der (ggf. neue) Name; liefert true, wenn der Name schon vergeben ist */
  taken: (db: Db, clubId: string, payload: Payload, name: string) => Promise<boolean>;
  nameOf: (payload: Payload) => string;
  restore: (
    db: Db,
    clubId: string,
    originalId: string,
    payload: Payload,
    name: string,
  ) => Promise<void>;
};

const date = (v: unknown) => new Date(String(v));

const HANDLERS: Record<ArchiveKind, Handler> = {
  wiki: {
    nameOf: (p) => String(p.title),
    taken: async (db, clubId, p, name) => {
      const rows = await db
        .select({ id: s.wikiPages.id })
        .from(s.wikiPages)
        .where(
          and(
            eq(s.wikiPages.clubId, clubId),
            eq(s.wikiPages.category, String(p.category)),
            eq(s.wikiPages.title, name),
          ),
        );
      return rows.length > 0;
    },
    restore: async (db, clubId, originalId, p, name) => {
      await db.insert(s.wikiPages).values({
        id: originalId,
        clubId,
        title: name,
        category: String(p.category),
        body: String(p.body),
        updatedByPersonId: (p.updatedByPersonId as string | null) ?? null,
        createdAt: date(p.createdAt),
        updatedAt: date(p.updatedAt),
      });
    },
  },
  exercise: {
    nameOf: (p) => String(p.title),
    taken: async (db, clubId, _p, name) => {
      const rows = await db
        .select({ id: s.exercises.id })
        .from(s.exercises)
        .where(and(eq(s.exercises.clubId, clubId), eq(s.exercises.title, name)));
      return rows.length > 0;
    },
    restore: async (db, clubId, originalId, p, name) => {
      await db.insert(s.exercises).values({
        id: originalId,
        clubId,
        title: name,
        category: String(p.category),
        durationMinutes: Number(p.durationMinutes),
        players: (p.players as string | null) ?? null,
        material: (p.material as string | null) ?? null,
        description: (p.description as string | null) ?? null,
        createdByPersonId: (p.createdByPersonId as string | null) ?? null,
        createdAt: date(p.createdAt),
        editedAt: p.editedAt ? date(p.editedAt) : null,
      });
    },
  },
};

const addYears = (d: Date, years: number) => {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + years);
  return r;
};

/** Legt das Abbild eines gelöschten Eintrags im Archiv ab (vor dem Löschen aufrufen). */
export async function archiveItem(
  db: Db,
  actor: Actor,
  kind: ArchiveKind,
  item: Archived,
  now: Date,
  retainUntil: Date | null = null,
): Promise<void> {
  await db.insert(s.archiveEntries).values({
    clubId: actor.club.id,
    kind,
    originalId: item.originalId,
    label: item.label,
    detail: item.detail,
    payload: item.payload,
    archivedByUserId: actor.user.id,
    archivedAt: now,
    retainUntil,
  });
}

const canRead = (actor: Actor) => actorCan(actor, 'archive.read');
const canRestore = (actor: Actor) => actorCan(actor, 'archive.restore');
const canPurge = (actor: Actor) => actorCan(actor, 'archive.purge');

async function audit(
  db: Db,
  actor: Actor,
  action: string,
  entityId: string | null,
  label: string,
  now: Date,
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: 'archive',
    entityId,
    data: { label },
    createdAt: now,
  });
}

export async function getArchive(db: Db, actor: Actor, now: Date): Promise<ArchiveOverview> {
  if (!canRead(actor)) throw forbidden('Das Archiv sehen nur Berechtigte.');
  const rows = await db
    .select({ e: s.archiveEntries, by: s.users.displayName })
    .from(s.archiveEntries)
    .leftJoin(s.users, eq(s.users.id, s.archiveEntries.archivedByUserId))
    .where(eq(s.archiveEntries.clubId, actor.club.id))
    .orderBy(desc(s.archiveEntries.archivedAt));
  const restore = canRestore(actor);
  const purge = canPurge(actor);
  const entries: ArchiveEntry[] = rows
    .filter((r) => (ARCHIVE_KINDS as readonly string[]).includes(r.e.kind))
    .map((r) => {
      const kind = r.e.kind as ArchiveKind;
      const locked = r.e.retainUntil && r.e.retainUntil > now ? r.e.retainUntil : null;
      return {
        id: r.e.id,
        kind,
        label: r.e.label,
        detail: r.e.detail,
        archivedAt: r.e.archivedAt.toISOString(),
        archivedBy: r.by,
        dueAt: addYears(r.e.archivedAt, ARCHIVE_RETENTION_YEARS[kind]).toISOString(),
        lockedUntil: locked?.toISOString() ?? null,
        canRestore: restore,
        canPurge: purge && !locked,
      };
    });
  return {
    entries,
    kinds: ARCHIVE_KINDS.map((kind) => {
      const of = entries.filter((e) => e.kind === kind);
      return {
        kind,
        count: of.length,
        due: of.filter((e) => e.dueAt <= now.toISOString() && !e.lockedUntil).length,
      };
    }),
    retentionYears: ARCHIVE_RETENTION_YEARS,
  };
}

async function load(db: Db, actor: Actor, id: string) {
  const [row] = await db
    .select()
    .from(s.archiveEntries)
    .where(and(eq(s.archiveEntries.id, id), eq(s.archiveEntries.clubId, actor.club.id)));
  if (!row || !(ARCHIVE_KINDS as readonly string[]).includes(row.kind))
    throw notFound('Der archivierte Eintrag');
  return row;
}

/** Wiederherstellen; ist der Name inzwischen vergeben, fragt der Server nach (409), statt selbst umzubenennen. */
export async function restoreEntry(
  db: Db,
  actor: Actor,
  id: string,
  input: RestoreArchiveInput,
  now: Date,
): Promise<ArchiveOverview> {
  if (!canRestore(actor)) throw forbidden('Wiederherstellen dürfen nur Berechtigte.');
  const row = await load(db, actor, id);
  const handler = HANDLERS[row.kind as ArchiveKind];
  const name = input.newName?.trim() || handler.nameOf(row.payload);
  if (await handler.taken(db, actor.club.id, row.payload, name))
    throw new HttpError(
      409,
      'name_conflict',
      'Der Name ist inzwischen vergeben. Bitte wähle einen neuen Namen für den wiederhergestellten Eintrag.',
    );
  await db.transaction(async (tx) => {
    await handler.restore(tx as unknown as Db, actor.club.id, row.originalId, row.payload, name);
    await tx.delete(s.archiveEntries).where(eq(s.archiveEntries.id, id));
  });
  await audit(
    db,
    actor,
    'archive.restored',
    row.originalId,
    `Archiv: wiederhergestellt: ${name}`,
    now,
  );
  return getArchive(db, actor, now);
}

/** Einen Eintrag endgültig löschen (nur Berechtigte, nicht während der Aufbewahrungsfrist). */
export async function purgeEntry(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<ArchiveOverview> {
  if (!canPurge(actor)) throw forbidden('Endgültig löschen dürfen nur Berechtigte.');
  const row = await load(db, actor, id);
  if (row.retainUntil && row.retainUntil > now)
    throw new HttpError(409, 'retention', 'Die gesetzliche Aufbewahrungsfrist läuft noch.');
  await db.delete(s.archiveEntries).where(eq(s.archiveEntries.id, id));
  await audit(
    db,
    actor,
    'archive.purged',
    row.originalId,
    `Archiv: endgültig gelöscht: ${row.label}`,
    now,
  );
  return getArchive(db, actor, now);
}

/** Bereinigen (nur Fälliges) oder Archiv leeren (alles ohne laufende Frist), optional je Art. */
export async function purgeArchive(
  db: Db,
  actor: Actor,
  input: PurgeArchiveInput,
  now: Date,
): Promise<PurgeArchiveResult> {
  if (!canPurge(actor)) throw forbidden('Endgültig löschen dürfen nur Berechtigte.');
  const rows = await db
    .select()
    .from(s.archiveEntries)
    .where(
      and(
        eq(s.archiveEntries.clubId, actor.club.id),
        input.kind ? eq(s.archiveEntries.kind, input.kind) : undefined,
      ),
    )
    .orderBy(asc(s.archiveEntries.archivedAt));
  const unlocked = rows.filter((r) => !(r.retainUntil && r.retainUntil > now));
  const doomed = unlocked.filter(
    (r) =>
      input.mode === 'all' ||
      addYears(r.archivedAt, ARCHIVE_RETENTION_YEARS[r.kind as ArchiveKind] ?? 0) <= now,
  );
  if (doomed.length)
    await db.delete(s.archiveEntries).where(
      inArray(
        s.archiveEntries.id,
        doomed.map((r) => r.id),
      ),
    );
  await audit(
    db,
    actor,
    'archive.purged',
    null,
    input.mode === 'all'
      ? `Archiv: geleert: ${doomed.length} Einträge endgültig gelöscht`
      : `Archiv: bereinigt: ${doomed.length} Einträge endgültig gelöscht`,
    now,
  );
  return {
    deleted: doomed.length,
    kept: rows.length - unlocked.length,
    overview: await getArchive(db, actor, now),
  };
}

/** Gesamtexport (Datenübergabe): alle archivierten Einträge mit Inhalt. */
export async function exportArchive(db: Db, actor: Actor, now: Date) {
  if (!canRead(actor)) throw forbidden('Das Archiv sehen nur Berechtigte.');
  const rows = await db
    .select()
    .from(s.archiveEntries)
    .where(eq(s.archiveEntries.clubId, actor.club.id))
    .orderBy(asc(s.archiveEntries.archivedAt));
  await audit(
    db,
    actor,
    'archive.exported',
    null,
    `Archiv: exportiert (${rows.length} Einträge)`,
    now,
  );
  return {
    exportedAt: now.toISOString(),
    club: actor.club.name,
    entries: rows.map((r) => ({
      kind: r.kind,
      label: r.label,
      archivedAt: r.archivedAt.toISOString(),
      retainUntil: r.retainUntil?.toISOString() ?? null,
      data: r.payload,
    })),
  };
}

export { HANDLERS as archiveHandlers };
