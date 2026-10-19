/**
 * Abwesenheiten (Konzept §9): Spieler bzw. Eltern pflegen sie selbst; sie gelten für alle
 * (oder ausgewählte) Mannschaften und sagen betroffene Termine automatisch ab. Wird eine
 * Abwesenheit gelöscht, werden genau diese automatischen Absagen zurückgenommen.
 */
import {
  ABSENCE_KINDS,
  calendarDayOf,
  fromIsoDate,
  toIsoDate,
  type Absence,
  type AbsenceKind,
  type CreateAbsenceInput,
  type UpdateAbsenceInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, eq, gte, inArray } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { recalcAbsenceParticipation } from './participation';
import { HttpError, forbidden, notFound } from '../errors';

const LABELS: Record<AbsenceKind, string> = {
  vacation: 'Urlaub',
  injury: 'Verletzung',
  illness: 'Krankheit',
  school_work: 'Schule/Beruf',
  suspended: 'Sperre',
  other: 'Sonstiges',
};

export function absenceReason(kind: AbsenceKind): string {
  return `Abwesend: ${LABELS[kind]}`;
}

const MAX_DAYS = 366;

export async function listAbsences(db: Db, actor: Actor, now: Date): Promise<Absence[]> {
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const rows = await db
    .select({ absence: s.absences, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.absences)
    .innerJoin(s.persons, eq(s.persons.id, s.absences.personId))
    .where(and(inArray(s.absences.personId, actor.managedIds), gte(s.absences.endsOn, today)))
    .orderBy(asc(s.absences.startsOn));
  return toAbsences(db, rows);
}

async function toAbsences(
  db: Db,
  rows: { absence: typeof s.absences.$inferSelect; firstName: string; lastName: string }[],
): Promise<Absence[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.absence.id);
  const teamIds = [...new Set(rows.flatMap((r) => r.absence.teamIds ?? []))];
  const [affected, teams] = await Promise.all([
    db
      .select({ absenceId: s.eventParticipants.absenceId, n: count() })
      .from(s.eventParticipants)
      .where(inArray(s.eventParticipants.absenceId, ids))
      .groupBy(s.eventParticipants.absenceId),
    teamIds.length
      ? db
          .select({ id: s.teams.id, badge: s.teams.badge })
          .from(s.teams)
          .where(inArray(s.teams.id, teamIds))
      : Promise.resolve([] as { id: string; badge: string }[]),
  ]);
  return rows.map(({ absence: a, firstName, lastName }) => ({
    id: a.id,
    personId: a.personId,
    personName: `${firstName} ${lastName}`,
    kind: a.kind,
    startsOn: a.startsOn,
    endsOn: a.endsOn,
    teams: (a.teamIds ?? []).map((id) => teams.find((t) => t.id === id)).filter((t) => !!t),
    note: a.note,
    affectedEvents: Number(affected.find((x) => x.absenceId === a.id)?.n ?? 0),
    editedAt: a.editedAt?.toISOString() ?? null,
  }));
}

/** Teilnahme der Person an allen anstehenden Terminen aus ihren Abwesenheiten neu ableiten (siehe `participation.ts`). */
const recalc = (tx: Db, actor: Actor, personId: string, now: Date, ignoreAbsenceId?: string) =>
  recalcAbsenceParticipation(tx, {
    clubId: actor.club.id,
    timezone: actor.club.timezone,
    now,
    actorPersonId: actor.person.id,
    personId,
    ignoreAbsenceId,
  });

/**
 * Abwesenheit nachträglich ändern (Paket BE): Zeitraum, Grund, Mannschaftsauswahl und Notiz. Die abgeleitete Teilnahme
 * wird danach aus allen Abwesenheiten der Person neu berechnet – wie beim Löschen und Anlegen. Ändern dürfen die
 * Person selbst und ihre Eltern.
 */
export async function updateAbsence(
  db: Db,
  actor: Actor,
  id: string,
  input: UpdateAbsenceInput,
  now: Date,
): Promise<Absence> {
  const [absence] = await db
    .select()
    .from(s.absences)
    .where(and(eq(s.absences.id, id), eq(s.absences.clubId, actor.club.id)));
  if (!absence || !actor.managedIds.includes(absence.personId)) throw notFound('Die Abwesenheit');

  const kind = input.kind ?? absence.kind;
  if (!ABSENCE_KINDS.includes(kind))
    throw new HttpError(400, 'invalid_kind', 'Unbekannter Grund der Abwesenheit.');
  const startsOn = input.startsOn ?? absence.startsOn;
  const endsOn = input.endsOn ?? absence.endsOn;
  const start = fromIsoDate(startsOn);
  const end = fromIsoDate(endsOn);
  if (end < start)
    throw new HttpError(400, 'invalid_range', 'Das Ende darf nicht vor dem Beginn liegen.');
  if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_DAYS)
    throw new HttpError(400, 'invalid_range', 'Eine Abwesenheit darf höchstens ein Jahr dauern.');
  if (end < calendarDayOf(now, actor.club.timezone))
    throw new HttpError(
      400,
      'in_past',
      'Abwesenheiten in der Vergangenheit können nicht eingetragen werden.',
    );
  const personTeams = actor.memberships
    .filter((m) => m.personId === absence.personId)
    .map((m) => m.teamId);
  const teamIds =
    input.teamIds === undefined ? absence.teamIds : input.teamIds?.length ? input.teamIds : null;
  if (teamIds && teamIds.some((t) => !personTeams.includes(t)))
    throw new HttpError(
      400,
      'invalid_team',
      'Eine ausgewählte Mannschaft gehört nicht zu dieser Person.',
    );

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(s.absences)
      .set({
        kind,
        startsOn,
        endsOn,
        teamIds,
        note: input.note === undefined ? absence.note : input.note?.trim() || null,
        editedAt: now,
      })
      .where(eq(s.absences.id, id))
      .returning();
    await recalc(tx as unknown as Db, actor, absence.personId, now);
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'absence.update',
      entityType: 'absence',
      entityId: id,
      data: { label: absenceReason(kind), fields: Object.keys(input) },
      createdAt: now,
    });
    const person = actor.managed.find((m) => m.id === absence.personId)!;
    const [result] = await toAbsences(tx as unknown as Db, [
      { absence: updated!, firstName: person.firstName, lastName: person.lastName },
    ]);
    return result!;
  });
}

export async function createAbsence(
  db: Db,
  actor: Actor,
  input: CreateAbsenceInput,
  now: Date,
): Promise<Absence> {
  if (!actor.managedIds.includes(input.personId)) {
    throw forbidden('Du kannst Abwesenheiten nur für dich oder deine Kinder eintragen.');
  }
  if (!ABSENCE_KINDS.includes(input.kind)) {
    throw new HttpError(400, 'invalid_kind', 'Unbekannter Grund der Abwesenheit.');
  }
  const start = fromIsoDate(input.startsOn);
  const end = fromIsoDate(input.endsOn);
  if (end < start) {
    throw new HttpError(400, 'invalid_range', 'Das Ende darf nicht vor dem Beginn liegen.');
  }
  if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_DAYS) {
    throw new HttpError(400, 'invalid_range', 'Eine Abwesenheit darf höchstens ein Jahr dauern.');
  }
  const today = calendarDayOf(now, actor.club.timezone);
  if (end < today) {
    throw new HttpError(
      400,
      'in_past',
      'Abwesenheiten in der Vergangenheit können nicht eingetragen werden.',
    );
  }

  const personTeams = actor.memberships
    .filter((m) => m.personId === input.personId)
    .map((m) => m.teamId);
  const teamIds = input.teamIds?.length ? input.teamIds : null;
  if (teamIds && teamIds.some((id) => !personTeams.includes(id))) {
    throw new HttpError(
      400,
      'invalid_team',
      'Eine ausgewählte Mannschaft gehört nicht zu dieser Person.',
    );
  }

  return db.transaction(async (tx) => {
    const [absence] = await tx
      .insert(s.absences)
      .values({
        clubId: actor.club.id,
        personId: input.personId,
        kind: input.kind,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        teamIds,
        note: input.note?.trim() || null,
        createdByPersonId: actor.person.id,
      })
      .returning();

    await recalc(tx as unknown as Db, actor, input.personId, now);

    const person = actor.managed.find((m) => m.id === input.personId)!;
    const [result] = await toAbsences(tx as unknown as Db, [
      { absence: absence!, firstName: person.firstName, lastName: person.lastName },
    ]);
    return result!;
  });
}

/**
 * Löscht eine Abwesenheit. Automatische Absagen für noch anstehende Termine werden
 * zurückgesetzt: bei automatischer Zusage auf „zugesagt“, sonst auf „offen“.
 * Trainer mit Korrekturrecht dürfen Abwesenheiten ihrer Spieler ebenfalls löschen.
 */
export async function deleteAbsence(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  const [absence] = await db
    .select()
    .from(s.absences)
    .where(and(eq(s.absences.id, id), eq(s.absences.clubId, actor.club.id)));
  if (!absence) throw notFound('Die Abwesenheit');

  if (!actor.managedIds.includes(absence.personId)) {
    const coachOf = await db
      .select({ team: { id: s.teams.id, orgUnitId: s.teams.orgUnitId } })
      .from(s.teamMemberships)
      .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
      .where(eq(s.teamMemberships.personId, absence.personId));
    if (!coachOf.some((m) => actorCan(actor, 'attendance.override', m.team))) {
      throw notFound('Die Abwesenheit');
    }
  }

  await db.transaction(async (tx) => {
    // erst neu ableiten (ohne diese Abwesenheit), dann löschen: die Verknüpfung wird beim Löschen sonst auf leer gesetzt
    await recalc(tx as unknown as Db, actor, absence.personId, now, id);
    await tx.delete(s.absences).where(eq(s.absences.id, id));
  });
}
