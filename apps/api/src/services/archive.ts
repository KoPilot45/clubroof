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
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { can } from '@clubroof/core';
import { type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import type { FileStorage } from '../storage/files';

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
  /** Beim endgültigen Löschen: zugehörige Dateien entfernen (Dokumente behalten ihre Datei bis dahin) */
  purge?: (storage: FileStorage, payload: Payload) => Promise<void>;
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
  task: {
    nameOf: (p) => String(p.title),
    // Aufgaben dürfen gleich heißen
    taken: async () => false,
    restore: async (db, clubId, originalId, p, name) => {
      const personExists = async (id: unknown) =>
        typeof id === 'string' &&
        (await db.select({ id: s.persons.id }).from(s.persons).where(eq(s.persons.id, id))).length >
          0;
      const eventExists = async (id: unknown) =>
        typeof id === 'string' &&
        (await db.select({ id: s.events.id }).from(s.events).where(eq(s.events.id, id))).length > 0;
      await db.insert(s.teamTasks).values({
        id: originalId,
        clubId,
        teamId: String(p.teamId),
        eventId: (await eventExists(p.eventId)) ? (p.eventId as string) : null,
        title: name,
        note: (p.note as string | null) ?? null,
        dueOn: (p.dueOn as string | null) ?? null,
        assigneePersonId: (await personExists(p.assigneePersonId))
          ? (p.assigneePersonId as string)
          : null,
        createdByPersonId: (await personExists(p.createdByPersonId))
          ? (p.createdByPersonId as string)
          : null,
        doneAt: p.doneAt ? date(p.doneAt) : null,
        doneByPersonId: (await personExists(p.doneByPersonId))
          ? (p.doneByPersonId as string)
          : null,
        createdAt: date(p.createdAt),
      });
    },
  },
  sponsor: {
    nameOf: (p) => String(p.name),
    taken: async (db, clubId, _p, name) => {
      const rows = await db
        .select({ id: s.sponsors.id })
        .from(s.sponsors)
        .where(and(eq(s.sponsors.clubId, clubId), eq(s.sponsors.name, name)));
      return rows.length > 0;
    },
    restore: async (db, clubId, originalId, p, name) => {
      await db.insert(s.sponsors).values({
        id: originalId,
        clubId,
        name,
        slogan: (p.slogan as string | null) ?? null,
        description: (p.description as string | null) ?? null,
        linkUrl: (p.linkUrl as string | null) ?? null,
        logoRef: (p.logoRef as string | null) ?? null,
        logoDarkRef: (p.logoDarkRef as string | null) ?? null,
        // Wiederhergestellte Sponsoren erscheinen erst wieder als Werbung, wenn die Verwaltung es einschaltet
        advertise: false,
        hideForYouth: Boolean(p.hideForYouth),
        startsOn: (p.startsOn as string | null) ?? null,
        endsOn: (p.endsOn as string | null) ?? null,
        sortOrder: Number(p.sortOrder ?? 0),
        createdAt: date(p.createdAt),
      });
    },
  },
  document: {
    nameOf: (p) => String(p.title),
    taken: async (db, clubId, p, name) => {
      const rows = await db
        .select({ id: s.documents.id })
        .from(s.documents)
        .where(
          and(
            eq(s.documents.clubId, clubId),
            eq(s.documents.scopeType, p.scopeType as 'club' | 'org_unit' | 'team'),
            p.scopeId ? eq(s.documents.scopeId, String(p.scopeId)) : isNull(s.documents.scopeId),
            eq(s.documents.title, name),
          ),
        );
      return rows.length > 0;
    },
    restore: async (db, clubId, originalId, p, name) => {
      await db.insert(s.documents).values({
        id: originalId,
        clubId,
        scopeType: p.scopeType as 'club' | 'org_unit' | 'team',
        scopeId: (p.scopeId as string | null) ?? null,
        category: p.category as (typeof s.documents.$inferInsert)['category'],
        title: name,
        fileName: String(p.fileName),
        mimeType: String(p.mimeType),
        sizeBytes: Number(p.sizeBytes),
        storageKey: String(p.storageKey),
        uploadedByPersonId: (p.uploadedByPersonId as string | null) ?? null,
        createdAt: date(p.createdAt),
        editedAt: p.editedAt ? date(p.editedAt) : null,
      });
    },
    purge: async (storage, p) => {
      const key = String(p.storageKey);
      if (!key.startsWith('demo/')) await storage.remove(key);
    },
  },
  equipment: {
    nameOf: (p) => String(p.name),
    taken: async (db, clubId, p, name) => {
      const rows = await db
        .select({ id: s.equipmentItems.id })
        .from(s.equipmentItems)
        .where(
          and(
            eq(s.equipmentItems.clubId, clubId),
            eq(s.equipmentItems.kind, String(p.kind)),
            eq(s.equipmentItems.name, name),
          ),
        );
      return rows.length > 0;
    },
    restore: async (db, clubId, originalId, p, name) => {
      await db.insert(s.equipmentItems).values({
        id: originalId,
        clubId,
        kind: String(p.kind),
        name,
        quantity: Number(p.quantity ?? 1),
        location: (p.location as string | null) ?? null,
        note: (p.note as string | null) ?? null,
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
  teamId: string | null = null,
  retainUntil: Date | null = null,
): Promise<void> {
  await db.insert(s.archiveEntries).values({
    clubId: actor.club.id,
    teamId,
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

type Scope = { teamId: string | null; orgUnitId: string | null };
const target = (row: Scope) => (row.teamId ? { teamId: row.teamId, orgUnitId: row.orgUnitId } : {});
/** Rechte je Eintrag: Vereinseinträge brauchen das Recht im ganzen Verein, Mannschaftseinträge für die Mannschaft. */
const mayRead = (actor: Actor, row: Scope) => can(actor.grants, 'archive.read', target(row));
const mayRestore = (actor: Actor, row: Scope) => can(actor.grants, 'archive.restore', target(row));
const mayPurge = (actor: Actor, row: Scope) => can(actor.grants, 'archive.purge', target(row));
/** Wer überhaupt irgendwo ins Archiv schauen darf (Verein, Bereich oder Mannschaft) */
const mayReadAny = (actor: Actor) =>
  actor.grants.some((g) => g.permissions.includes('archive.read'));

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

export async function getArchive(
  db: Db,
  actor: Actor,
  now: Date,
  teamId?: string,
): Promise<ArchiveOverview> {
  if (!mayReadAny(actor)) throw forbidden('Das Archiv sehen nur Berechtigte.');
  const rows = await db
    .select({
      e: s.archiveEntries,
      by: s.users.displayName,
      teamName: s.teams.name,
      orgUnitId: s.teams.orgUnitId,
    })
    .from(s.archiveEntries)
    .leftJoin(s.users, eq(s.users.id, s.archiveEntries.archivedByUserId))
    .leftJoin(s.teams, eq(s.teams.id, s.archiveEntries.teamId))
    .where(
      and(
        eq(s.archiveEntries.clubId, actor.club.id),
        teamId ? eq(s.archiveEntries.teamId, teamId) : undefined,
      ),
    )
    .orderBy(desc(s.archiveEntries.archivedAt));
  const entries: ArchiveEntry[] = rows
    .filter(
      (r) =>
        (ARCHIVE_KINDS as readonly string[]).includes(r.e.kind) &&
        mayRead(actor, { teamId: r.e.teamId, orgUnitId: r.orgUnitId }),
    )
    .map((r) => {
      const kind = r.e.kind as ArchiveKind;
      const scope = { teamId: r.e.teamId, orgUnitId: r.orgUnitId };
      const locked = r.e.retainUntil && r.e.retainUntil > now ? r.e.retainUntil : null;
      return {
        id: r.e.id,
        kind,
        label: r.e.label,
        detail: r.e.detail,
        teamId: r.e.teamId,
        teamName: r.teamName,
        archivedAt: r.e.archivedAt.toISOString(),
        archivedBy: r.by,
        dueAt: addYears(r.e.archivedAt, ARCHIVE_RETENTION_YEARS[kind]).toISOString(),
        lockedUntil: locked?.toISOString() ?? null,
        canRestore: mayRestore(actor, scope),
        canPurge: mayPurge(actor, scope) && !locked,
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
  const [found] = await db
    .select({ row: s.archiveEntries, orgUnitId: s.teams.orgUnitId })
    .from(s.archiveEntries)
    .leftJoin(s.teams, eq(s.teams.id, s.archiveEntries.teamId))
    .where(and(eq(s.archiveEntries.id, id), eq(s.archiveEntries.clubId, actor.club.id)));
  if (
    !found ||
    !(ARCHIVE_KINDS as readonly string[]).includes(found.row.kind) ||
    !mayRead(actor, { teamId: found.row.teamId, orgUnitId: found.orgUnitId })
  )
    throw notFound('Der archivierte Eintrag');
  return { ...found.row, orgUnitId: found.orgUnitId };
}

/** Wiederherstellen; ist der Name inzwischen vergeben, fragt der Server nach (409), statt selbst umzubenennen. */
export async function restoreEntry(
  db: Db,
  actor: Actor,
  id: string,
  input: RestoreArchiveInput,
  now: Date,
): Promise<ArchiveOverview> {
  const row = await load(db, actor, id);
  if (!mayRestore(actor, row)) throw forbidden('Wiederherstellen dürfen nur Berechtigte.');
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
  return getArchive(db, actor, now, row.teamId ?? undefined);
}

/** Einen Eintrag endgültig löschen (nur Berechtigte, nicht während der Aufbewahrungsfrist). */
export async function purgeEntry(
  db: Db,
  storage: FileStorage,
  actor: Actor,
  id: string,
  now: Date,
): Promise<ArchiveOverview> {
  const row = await load(db, actor, id);
  if (!mayPurge(actor, row)) throw forbidden('Endgültig löschen dürfen nur Berechtigte.');
  if (row.retainUntil && row.retainUntil > now)
    throw new HttpError(409, 'retention', 'Die gesetzliche Aufbewahrungsfrist läuft noch.');
  await HANDLERS[row.kind as ArchiveKind].purge?.(storage, row.payload);
  await db.delete(s.archiveEntries).where(eq(s.archiveEntries.id, id));
  await audit(
    db,
    actor,
    'archive.purged',
    row.originalId,
    `Archiv: endgültig gelöscht: ${row.label}`,
    now,
  );
  return getArchive(db, actor, now, row.teamId ?? undefined);
}

/** Alle Einträge, die der Nutzer sehen darf (optional je Art oder Mannschaft). */
async function readable(db: Db, actor: Actor, kind?: ArchiveKind, teamId?: string) {
  const rows = await db
    .select({ row: s.archiveEntries, orgUnitId: s.teams.orgUnitId })
    .from(s.archiveEntries)
    .leftJoin(s.teams, eq(s.teams.id, s.archiveEntries.teamId))
    .where(
      and(
        eq(s.archiveEntries.clubId, actor.club.id),
        kind ? eq(s.archiveEntries.kind, kind) : undefined,
        teamId ? eq(s.archiveEntries.teamId, teamId) : undefined,
      ),
    )
    .orderBy(asc(s.archiveEntries.archivedAt));
  return rows
    .filter((r) => mayRead(actor, { teamId: r.row.teamId, orgUnitId: r.orgUnitId }))
    .map((r) => ({ ...r.row, orgUnitId: r.orgUnitId }));
}

/** Bereinigen (nur Fälliges) oder Archiv leeren (alles ohne laufende Frist), optional je Art oder Mannschaft. */
export async function purgeArchive(
  db: Db,
  storage: FileStorage,
  actor: Actor,
  input: PurgeArchiveInput,
  now: Date,
): Promise<PurgeArchiveResult> {
  if (!actor.grants.some((g) => g.permissions.includes('archive.purge')))
    throw forbidden('Endgültig löschen dürfen nur Berechtigte.');
  const rows = await readable(db, actor, input.kind, input.teamId);
  const allowed = rows.filter((r) => mayPurge(actor, r));
  const unlocked = allowed.filter((r) => !(r.retainUntil && r.retainUntil > now));
  const doomed = unlocked.filter(
    (r) =>
      input.mode === 'all' ||
      addYears(r.archivedAt, ARCHIVE_RETENTION_YEARS[r.kind as ArchiveKind] ?? 0) <= now,
  );
  for (const r of doomed) await HANDLERS[r.kind as ArchiveKind].purge?.(storage, r.payload);
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
    kept: allowed.length - unlocked.length,
    overview: await getArchive(db, actor, now, input.teamId),
  };
}

/** Gesamtexport (Datenübergabe): alle archivierten Einträge, die der Nutzer sehen darf, mit Inhalt. */
export async function exportArchive(db: Db, actor: Actor, now: Date, teamId?: string) {
  if (!mayReadAny(actor)) throw forbidden('Das Archiv sehen nur Berechtigte.');
  const rows = await readable(db, actor, undefined, teamId);
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
      teamId: r.teamId,
      archivedAt: r.archivedAt.toISOString(),
      retainUntil: r.retainUntil?.toISOString() ?? null,
      data: r.payload,
    })),
  };
}

export { HANDLERS as archiveHandlers };
