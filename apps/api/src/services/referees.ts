/**
 * Schiedsrichter (optionales Modul): Schiedsrichter werden vom Verband bei fremden Spielen
 * eingesetzt, nicht vom Verein. Der Schiedsrichter trägt seine Einsätze selbst ein („Meine
 * Einsätze“); Überschneidungen mit eigenen Terminen werden gemeldet, auf Wunsch entsteht eine
 * Abwesenheit. Der Verein sieht das „Schiedsrichter-Soll“: aktive Schiedsrichter gegen das vom
 * Verband verlangte Soll, Lizenzablauf, Pflichteinsätze. Pflege: Administration bzw. individuelles
 * Recht `referees.manage` – es gibt keine eigene Rolle.
 */
import {
  addDays,
  calendarDayOf,
  toIsoDate,
  type RefereeCollision,
  type RefereeDuty,
  type RefereeDutyInput,
  type RefereeDutyResult,
  type RefereeLicenseStatus,
  type RefereeOverview,
  type RefereeProfile,
  type RefereeSettings,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gt, gte, isNull, lt, lte, ne, or } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { createAbsence, deleteAbsence } from './absences';

const EXPIRING_DAYS = 60;
const HISTORY_DAYS = 90;
const DEFAULT_MINUTES = 120;

function requireModule(actor: Actor) {
  if (!moduleEnabled(actor, 'referees'))
    throw forbidden('Die Schiedsrichterverwaltung ist im Verein nicht aktiviert.');
}
const canManage = (actor: Actor) => actorCan(actor, 'referees.manage');

export function licenseStatus(validUntil: string | null, today: string): RefereeLicenseStatus {
  if (!validUntil) return 'none';
  if (validUntil < today) return 'expired';
  const soon = toIsoDate(addDays(new Date(`${today}T00:00:00Z`), EXPIRING_DAYS));
  return validUntil <= soon ? 'expiring' : 'ok';
}

const todayOf = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));

async function ownReferee(db: Db, actor: Actor) {
  const [ref] = await db
    .select()
    .from(s.referees)
    .where(
      and(
        eq(s.referees.personId, actor.person.id),
        eq(s.referees.clubId, actor.club.id),
        eq(s.referees.active, true),
      ),
    );
  return ref ?? null;
}

const toDuty = (d: typeof s.refereeDuties.$inferSelect): RefereeDuty => ({
  id: d.id,
  title: d.title,
  startsAt: d.startsAt.toISOString(),
  endsAt: d.endsAt.toISOString(),
  location: d.location,
  absence: d.absenceId !== null,
});

async function settingsOf(db: Db, clubId: string): Promise<RefereeSettings> {
  const [row] = await db
    .select()
    .from(s.refereeSettings)
    .where(eq(s.refereeSettings.clubId, clubId));
  return {
    requiredReferees: row?.requiredReferees ?? 0,
    requiredMatches: row?.requiredMatches ?? 0,
  };
}

/** Meine Einsätze: kommende zuerst (aufsteigend), danach die letzten 90 Tage (absteigend). */
export async function listOwnDuties(
  db: Db,
  actor: Actor,
  now: Date,
  range?: { from: Date; to: Date },
): Promise<RefereeDuty[]> {
  if (!moduleEnabled(actor, 'referees')) return [];
  const rows = await db
    .select()
    .from(s.refereeDuties)
    .where(
      and(
        eq(s.refereeDuties.personId, actor.person.id),
        ...(range
          ? [gte(s.refereeDuties.endsAt, range.from), lte(s.refereeDuties.startsAt, range.to)]
          : [gte(s.refereeDuties.endsAt, new Date(now.getTime() - HISTORY_DAYS * 86_400_000))]),
      ),
    )
    .orderBy(asc(s.refereeDuties.startsAt));
  if (range) return rows.map(toDuty);
  const upcoming = rows.filter((r) => r.endsAt >= now);
  const past = rows.filter((r) => r.endsAt < now).reverse();
  return [...upcoming, ...past].map(toDuty);
}

export async function getReferees(db: Db, actor: Actor, now: Date): Promise<RefereeOverview> {
  requireModule(actor);
  const manage = canManage(actor);
  const own = await ownReferee(db, actor);
  if (!manage && !own)
    throw forbidden('Die Schiedsrichter-Übersicht sehen Schiedsrichter und Verantwortliche.');
  const today = todayOf(actor, now);
  const profile: RefereeProfile | null = own
    ? {
        level: own.level,
        licenseValidUntil: own.licenseValidUntil,
        licenseStatus: licenseStatus(own.licenseValidUntil, today),
        active: own.active,
      }
    : null;

  let club: RefereeOverview['club'] = null;
  if (manage) {
    const [season] = await db
      .select()
      .from(s.seasons)
      .where(and(eq(s.seasons.clubId, actor.club.id), eq(s.seasons.isCurrent, true)));
    const [refs, settings] = await Promise.all([
      db
        .select({
          referee: s.referees,
          firstName: s.persons.firstName,
          lastName: s.persons.lastName,
        })
        .from(s.referees)
        .innerJoin(s.persons, eq(s.persons.id, s.referees.personId))
        .where(eq(s.referees.clubId, actor.club.id))
        .orderBy(asc(s.persons.lastName), asc(s.persons.firstName)),
      settingsOf(db, actor.club.id),
    ]);
    const from = season ? new Date(`${season.startsOn}T00:00:00Z`) : new Date(0);
    const to = season ? new Date(`${season.endsOn}T23:59:59Z`) : now;
    const duties = refs.length
      ? await db
          .select({ personId: s.refereeDuties.personId })
          .from(s.refereeDuties)
          .where(
            and(
              eq(s.refereeDuties.clubId, actor.club.id),
              gte(s.refereeDuties.startsAt, from),
              lte(s.refereeDuties.startsAt, to),
              lte(s.refereeDuties.startsAt, now),
            ),
          )
      : [];
    const active = refs.filter((r) => r.referee.active).length;
    club = {
      settings,
      active,
      shortfall: Math.max(0, settings.requiredReferees - active),
      seasonName: season?.name ?? '',
      referees: refs.map((r) => {
        const count = duties.filter((d) => d.personId === r.referee.personId).length;
        return {
          personId: r.referee.personId,
          name: `${r.firstName} ${r.lastName}`,
          level: r.referee.level,
          licenseValidUntil: r.referee.licenseValidUntil,
          licenseStatus: licenseStatus(r.referee.licenseValidUntil, today),
          active: r.referee.active,
          duties: count,
          dutiesOk: count >= settings.requiredMatches,
        };
      }),
    };
  }
  return {
    canManage: manage,
    isReferee: !!own,
    profile,
    mine: own ? await listOwnDuties(db, actor, now) : [],
    club,
  };
}

/** Mitglieder, die als Schiedsrichter eingetragen werden können (Suche nach Name). */
export async function searchRefereeCandidates(
  db: Db,
  actor: Actor,
  q: string,
): Promise<{ personId: string; name: string }[]> {
  requireModule(actor);
  if (!canManage(actor))
    throw forbidden('Schiedsrichter verwalten Administration und Verantwortliche.');
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const rows = await db
    .select({ id: s.persons.id, first: s.persons.firstName, last: s.persons.lastName })
    .from(s.persons)
    .where(and(eq(s.persons.clubId, actor.club.id), eq(s.persons.membershipStatus, 'active')))
    .orderBy(asc(s.persons.lastName));
  return rows
    .filter((r) => `${r.first} ${r.last}`.toLowerCase().includes(term))
    .slice(0, 10)
    .map((r) => ({ personId: r.id, name: `${r.first} ${r.last}` }));
}

export async function addReferee(
  db: Db,
  actor: Actor,
  input: { personId: string; level?: string | null; licenseValidUntil?: string | null },
  now: Date,
): Promise<RefereeOverview> {
  requireModule(actor);
  if (!canManage(actor))
    throw forbidden('Schiedsrichter verwalten Administration und Verantwortliche.');
  const [person] = await db
    .select({ id: s.persons.id })
    .from(s.persons)
    .where(and(eq(s.persons.id, input.personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw new HttpError(400, 'invalid_person', 'Unbekanntes Mitglied.');
  const values = {
    level: input.level?.trim() || null,
    licenseValidUntil: input.licenseValidUntil ?? null,
  };
  await db
    .insert(s.referees)
    .values({ personId: input.personId, clubId: actor.club.id, ...values, createdAt: now })
    .onConflictDoUpdate({ target: s.referees.personId, set: { ...values, active: true } });
  return getReferees(db, actor, now);
}

/** Stufe und Lizenz ändert der Schiedsrichter selbst oder die Verwaltung; aktiv/inaktiv nur die Verwaltung. */
export async function updateReferee(
  db: Db,
  actor: Actor,
  personId: string,
  input: { level?: string | null; licenseValidUntil?: string | null; active?: boolean },
  now: Date,
): Promise<RefereeOverview> {
  requireModule(actor);
  const manage = canManage(actor);
  const self = personId === actor.person.id;
  if (!manage && !self) throw forbidden('Das ändern Schiedsrichter selbst oder die Verwaltung.');
  if (input.active !== undefined && !manage)
    throw forbidden('Aktiv oder inaktiv setzt die Verwaltung.');
  const [ref] = await db
    .select()
    .from(s.referees)
    .where(and(eq(s.referees.personId, personId), eq(s.referees.clubId, actor.club.id)));
  if (!ref) throw notFound('Der Schiedsrichter');
  const patch: Partial<typeof s.referees.$inferInsert> = {};
  if (input.level !== undefined) patch.level = input.level?.trim() || null;
  if (input.licenseValidUntil !== undefined) patch.licenseValidUntil = input.licenseValidUntil;
  if (input.active !== undefined) patch.active = input.active;
  if (Object.keys(patch).length)
    await db.update(s.referees).set(patch).where(eq(s.referees.personId, personId));
  return getReferees(db, actor, now);
}

export async function setSettings(
  db: Db,
  actor: Actor,
  input: RefereeSettings,
  now: Date,
): Promise<RefereeOverview> {
  requireModule(actor);
  if (!canManage(actor)) throw forbidden('Das Soll pflegen Administration und Verantwortliche.');
  await db
    .insert(s.refereeSettings)
    .values({ clubId: actor.club.id, ...input, updatedAt: now })
    .onConflictDoUpdate({ target: s.refereeSettings.clubId, set: { ...input, updatedAt: now } });
  return getReferees(db, actor, now);
}

/** Eigene Termine (Spiel, Training …), die sich mit dem Zeitraum überschneiden. */
async function collisionsFor(
  db: Db,
  actor: Actor,
  start: Date,
  end: Date,
): Promise<RefereeCollision[]> {
  const rows = await db
    .select({
      id: s.events.id,
      title: s.events.title,
      startsAt: s.events.startsAt,
      endsAt: s.events.endsAt,
      type: s.events.type,
      team: s.teams.badge,
    })
    .from(s.events)
    .innerJoin(s.eventParticipants, eq(s.eventParticipants.eventId, s.events.id))
    .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .where(
      and(
        eq(s.events.clubId, actor.club.id),
        eq(s.eventParticipants.personId, actor.person.id),
        ne(s.eventParticipants.status, 'no'),
        eq(s.events.status, 'scheduled'),
        lt(s.events.startsAt, end),
        // ohne Ende gilt ein Termin als zwei Stunden lang
        or(
          gt(s.events.endsAt, start),
          and(
            isNull(s.events.endsAt),
            gt(s.events.startsAt, new Date(start.getTime() - 2 * 3_600_000)),
          ),
        ),
      ),
    )
    .orderBy(asc(s.events.startsAt));
  return rows.map((r) => ({
    eventId: r.id,
    title: r.team ? `${r.team}: ${r.title}` : r.title,
    startsAt: r.startsAt.toISOString(),
  }));
}

export async function createDuty(
  db: Db,
  actor: Actor,
  input: RefereeDutyInput,
  now: Date,
): Promise<RefereeDutyResult> {
  requireModule(actor);
  if (!(await ownReferee(db, actor)))
    throw forbidden('Einsätze tragen aktive Schiedsrichter des Vereins ein.');
  const start = new Date(input.startsAt);
  const minutes = Math.min(Math.max(input.durationMinutes ?? DEFAULT_MINUTES, 30), 600);
  const end = new Date(start.getTime() + minutes * 60_000);
  const collisions = await collisionsFor(db, actor, start, end);

  // Auf Wunsch Abwesenheit für den Tag (nur für heute und später möglich)
  let absenceId: string | null = null;
  const day = toIsoDate(calendarDayOf(start, actor.club.timezone));
  if (input.createAbsence && day >= todayOf(actor, now)) {
    const absence = await createAbsence(
      db,
      actor,
      {
        personId: actor.person.id,
        kind: 'other',
        startsOn: day,
        endsOn: day,
        note: `Schiedsrichtereinsatz: ${input.title.trim()}`,
      },
      now,
    );
    absenceId = absence.id;
  }
  await db.insert(s.refereeDuties).values({
    clubId: actor.club.id,
    personId: actor.person.id,
    title: input.title.trim(),
    startsAt: start,
    endsAt: end,
    location: input.location?.trim() || null,
    absenceId,
    createdAt: now,
  });
  return { overview: await getReferees(db, actor, now), collisions };
}

export async function deleteDuty(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<RefereeOverview> {
  requireModule(actor);
  const [duty] = await db
    .select()
    .from(s.refereeDuties)
    .where(and(eq(s.refereeDuties.id, id), eq(s.refereeDuties.clubId, actor.club.id)));
  if (!duty) throw notFound('Der Einsatz');
  if (duty.personId !== actor.person.id)
    throw forbidden('Einsätze löscht nur der Schiedsrichter selbst.');
  await db.delete(s.refereeDuties).where(eq(s.refereeDuties.id, id));
  // automatische Absagen zu Terminen werden dabei zurückgesetzt
  if (duty.absenceId) await deleteAbsence(db, actor, duty.absenceId, now);
  return getReferees(db, actor, now);
}
