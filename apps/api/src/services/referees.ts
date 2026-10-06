/**
 * Schiedsrichter (optionales Modul, Konzept §7/§12): Vereinsschiedsrichter werden Heimspielen
 * (meist Jugend) zugeteilt und bestätigen den Einsatz. Recht: `referees.manage`
 * (Schiedsrichterobmann). Schiedsrichter sehen ihre eigenen Einsätze.
 */
import {
  can,
  type RefereeAssignment,
  type RefereeMatch,
  type RefereeOverview,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { notify, recipientsFor } from './event-admin';

const WEEKS = 6;

function requireModule(actor: Actor) {
  if (!moduleEnabled(actor, 'referees'))
    throw forbidden('Die Schiedsrichterverwaltung ist im Verein nicht aktiviert.');
}
const canManage = (actor: Actor) => actorCan(actor, 'referees.manage');

async function homeMatches(db: Db, actor: Actor, now: Date, eventIds?: string[]) {
  return db
    .select({ event: s.events, team: s.teams, match: s.matchDetails, facility: s.facilities.name })
    .from(s.events)
    .innerJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
    .leftJoin(s.facilities, eq(s.facilities.id, s.events.facilityId))
    .where(
      and(
        eq(s.events.clubId, actor.club.id),
        eq(s.events.status, 'scheduled'),
        eq(s.matchDetails.isHome, true),
        gt(s.events.startsAt, now),
        lt(s.events.startsAt, new Date(now.getTime() + WEEKS * 7 * 24 * 3_600_000)),
        ...(eventIds ? [inArray(s.events.id, eventIds)] : []),
      ),
    )
    .orderBy(asc(s.events.startsAt));
}

export async function getReferees(db: Db, actor: Actor, now: Date): Promise<RefereeOverview> {
  requireModule(actor);
  const manage = canManage(actor);
  const [refs, matches] = await Promise.all([
    db
      .select({ referee: s.referees, firstName: s.persons.firstName, lastName: s.persons.lastName })
      .from(s.referees)
      .innerJoin(s.persons, eq(s.persons.id, s.referees.personId))
      .where(eq(s.referees.clubId, actor.club.id))
      .orderBy(asc(s.persons.lastName)),
    homeMatches(db, actor, now),
  ]);
  const ids = matches.map((m) => m.event.id);
  const assignments = ids.length
    ? await db
        .select({
          a: s.refereeAssignments,
          firstName: s.persons.firstName,
          lastName: s.persons.lastName,
        })
        .from(s.refereeAssignments)
        .innerJoin(s.persons, eq(s.persons.id, s.refereeAssignments.personId))
        .where(inArray(s.refereeAssignments.eventId, ids))
    : [];
  const toMatch = (m: (typeof matches)[number]): RefereeMatch => ({
    eventId: m.event.id,
    title: `${actor.club.shortName} ${m.team.badge} – ${m.match.opponentName}`,
    badge: m.team.badge,
    startsAt: m.event.startsAt.toISOString(),
    location: m.facility ?? m.event.locationText,
    assignments: assignments
      .filter((x) => x.a.eventId === m.event.id)
      .map((x): RefereeAssignment => ({
        id: x.a.id,
        personId: x.a.personId,
        name: `${x.firstName} ${x.lastName}`,
        role: x.a.role === 'assistant' ? 'assistant' : 'referee',
        status: x.a.status as RefereeAssignment['status'],
      })),
  });
  const mineRows = assignments.filter((x) => actor.managedIds.includes(x.a.personId));
  const mine = mineRows.map((x) => {
    const m = matches.find((mm) => mm.event.id === x.a.eventId)!;
    return {
      ...toMatch(m),
      assignmentId: x.a.id,
      status: x.a.status as RefereeAssignment['status'],
    };
  });
  const isReferee = refs.some((r) => actor.managedIds.includes(r.referee.personId));
  if (!manage && !isReferee) throw forbidden('Die Einteilung sieht der Schiedsrichterobmann.');
  return {
    referees: manage
      ? refs.map((r) => ({
          personId: r.referee.personId,
          name: `${r.firstName} ${r.lastName}`,
          level: r.referee.level,
          active: r.referee.active,
          upcoming: assignments.filter(
            (x) => x.a.personId === r.referee.personId && x.a.status !== 'declined',
          ).length,
        }))
      : [],
    matches: manage ? matches.map(toMatch) : [],
    canManage: manage,
    mine,
  };
}

export async function addReferee(
  db: Db,
  actor: Actor,
  personId: string,
  level: string | null,
  now: Date,
): Promise<RefereeOverview> {
  requireModule(actor);
  if (!canManage(actor)) throw forbidden('Schiedsrichter verwaltet der Schiedsrichterobmann.');
  const [person] = await db
    .select({ id: s.persons.id })
    .from(s.persons)
    .where(and(eq(s.persons.id, personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw new HttpError(400, 'invalid_person', 'Unbekanntes Mitglied.');
  await db
    .insert(s.referees)
    .values({ personId, clubId: actor.club.id, level: level?.trim() || null, createdAt: now })
    .onConflictDoUpdate({
      target: s.referees.personId,
      set: { level: level?.trim() || null, active: true },
    });
  return getReferees(db, actor, now);
}

export async function assignReferee(
  db: Db,
  actor: Actor,
  eventId: string,
  personId: string,
  role: 'referee' | 'assistant',
  now: Date,
): Promise<RefereeOverview> {
  requireModule(actor);
  if (!canManage(actor)) throw forbidden('Einteilen kann der Schiedsrichterobmann.');
  const [match] = await homeMatches(db, actor, now, [eventId]);
  if (!match) throw notFound('Das Heimspiel');
  const [ref] = await db
    .select()
    .from(s.referees)
    .where(
      and(
        eq(s.referees.personId, personId),
        eq(s.referees.clubId, actor.club.id),
        eq(s.referees.active, true),
      ),
    );
  if (!ref)
    throw new HttpError(400, 'not_referee', 'Die Person ist kein aktiver Vereinsschiedsrichter.');
  const existing = await db
    .select({ id: s.refereeAssignments.id })
    .from(s.refereeAssignments)
    .where(
      and(eq(s.refereeAssignments.eventId, eventId), eq(s.refereeAssignments.personId, personId)),
    );
  if (existing.length) throw new HttpError(409, 'already_assigned', 'Bereits eingeteilt.');
  await db.insert(s.refereeAssignments).values({
    clubId: actor.club.id,
    eventId,
    personId,
    role,
    createdAt: now,
  });
  const when = new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: actor.club.timezone,
  }).format(match.event.startsAt);
  await notify(
    db,
    actor,
    await recipientsFor(db, [personId], actor.user.id),
    {
      level: 'action',
      topic: 'matches',
      title: `Schiedsrichtereinsatz: ${match.team.badge} – ${match.match.opponentName}`,
      body: `${when} Uhr · bitte bestätigen`,
      link: '/referees',
    },
    now,
  );
  return getReferees(db, actor, now);
}

/** Schiedsrichter bestätigt oder sagt ab; der Obmann wird bei Absage informiert. */
export async function respondAssignment(
  db: Db,
  actor: Actor,
  id: string,
  status: 'confirmed' | 'declined',
  now: Date,
): Promise<RefereeOverview> {
  requireModule(actor);
  const [a] = await db
    .select()
    .from(s.refereeAssignments)
    .where(and(eq(s.refereeAssignments.id, id), eq(s.refereeAssignments.clubId, actor.club.id)));
  if (!a) throw notFound('Der Einsatz');
  if (!actor.managedIds.includes(a.personId) && !canManage(actor))
    throw forbidden('Bestätigen kann nur der eingeteilte Schiedsrichter.');
  await db.update(s.refereeAssignments).set({ status }).where(eq(s.refereeAssignments.id, id));
  if (status === 'declined') {
    const leads = await db
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
          leads.filter((l) => l.userId && can([l], 'referees.manage', {})).map((l) => l.userId!),
        ),
      ],
      {
        level: 'important',
        topic: 'admin',
        title: 'Schiedsrichter hat abgesagt',
        body: `${actor.person.firstName} ${actor.person.lastName} kann den Einsatz nicht übernehmen.`,
        link: '/referees',
      },
      now,
    );
  }
  return getReferees(db, actor, now);
}

export async function removeAssignment(db: Db, actor: Actor, id: string, now: Date) {
  requireModule(actor);
  if (!canManage(actor)) throw forbidden('Einteilungen ändert der Schiedsrichterobmann.');
  await db
    .delete(s.refereeAssignments)
    .where(and(eq(s.refereeAssignments.id, id), eq(s.refereeAssignments.clubId, actor.club.id)));
  return getReferees(db, actor, now);
}
