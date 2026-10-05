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
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, eq, gt, gte, inArray, ne, sql } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
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
  }));
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

    // Betroffene, noch anstehende Termine automatisch absagen. Bewusste Absagen bleiben unverändert.
    const eventDay = sql`(${s.events.startsAt} at time zone ${actor.club.timezone})::date`;
    const affected = await tx
      .select({ id: s.eventParticipants.id })
      .from(s.eventParticipants)
      .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
      .where(
        and(
          eq(s.eventParticipants.personId, input.personId),
          ne(s.eventParticipants.role, 'coach'),
          ne(s.eventParticipants.status, 'no'),
          gt(s.events.startsAt, now),
          sql`${eventDay} between ${input.startsOn}::date and ${input.endsOn}::date`,
          teamIds ? inArray(s.events.teamId, teamIds) : undefined,
        ),
      );
    if (affected.length > 0) {
      await tx
        .update(s.eventParticipants)
        .set({
          status: 'no',
          reason: absenceReason(input.kind),
          absenceId: absence!.id,
          respondedAt: now,
          respondedByPersonId: actor.person.id,
        })
        .where(
          inArray(
            s.eventParticipants.id,
            affected.map((a) => a.id),
          ),
        );
    }

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
    const rows = await tx
      .select({ id: s.eventParticipants.id, mode: s.teams.participationMode })
      .from(s.eventParticipants)
      .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
      .innerJoin(s.teams, eq(s.teams.id, s.events.teamId))
      .where(and(eq(s.eventParticipants.absenceId, id), gt(s.events.startsAt, now)));

    const autoYes = rows.filter((r) => r.mode !== 'active_response').map((r) => r.id);
    const pending = rows.filter((r) => r.mode === 'active_response').map((r) => r.id);
    const reset = { reason: null, absenceId: null, respondedAt: null, respondedByPersonId: null };
    if (autoYes.length) {
      await tx
        .update(s.eventParticipants)
        .set({ ...reset, status: 'yes' })
        .where(inArray(s.eventParticipants.id, autoYes));
    }
    if (pending.length) {
      await tx
        .update(s.eventParticipants)
        .set({ ...reset, status: 'pending' })
        .where(inArray(s.eventParticipants.id, pending));
    }
    await tx.delete(s.absences).where(eq(s.absences.id, id));
  });
}
