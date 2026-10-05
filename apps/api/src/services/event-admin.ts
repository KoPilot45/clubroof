/**
 * Trainer-Funktionen in der App: Termine anlegen und absagen. Neue Termine erhalten sofort
 * Teilnehmer nach dem Teilnahme-Modell der Mannschaft und berücksichtigen Abwesenheiten.
 */
import {
  calendarDayOf,
  toIsoDate,
  type CreateEventInput,
  type EventDetail,
  type NotificationLevel,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { absenceReason } from './absences';
import { getEventDetail } from './events';
import { loadTeamForActor } from './team-access';

const DEFAULT_MINUTES = { training: 90, match: 105, team_event: 120 } as const;
const TITLES = { training: 'Training', team_event: 'Teamevent' } as const;

const timeFmt = (tz: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });

/** Nutzerkonten, die über einen Termin informiert werden: Teilnehmer selbst und deren Eltern. */
export async function recipientsFor(
  db: Db,
  personIds: string[],
  excludeUserId: string,
): Promise<string[]> {
  if (personIds.length === 0) return [];
  const [own, guardians] = await Promise.all([
    db.select({ userId: s.persons.userId }).from(s.persons).where(inArray(s.persons.id, personIds)),
    db
      .select({ userId: s.persons.userId })
      .from(s.guardianships)
      .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
      .where(inArray(s.guardianships.childPersonId, personIds)),
  ]);
  return [
    ...new Set([...own, ...guardians].map((r) => r.userId).filter((id): id is string => !!id)),
  ].filter((id) => id !== excludeUserId);
}

export async function notify(
  db: Db,
  actor: Actor,
  userIds: string[],
  n: { level: NotificationLevel; title: string; body: string; link: string },
  now: Date,
) {
  if (userIds.length === 0) return;
  await db.insert(s.notifications).values(
    userIds.map((userId) => ({
      clubId: actor.club.id,
      userId,
      level: n.level,
      category: 'termine',
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: now,
    })),
  );
}

export async function createTeamEvent(
  db: Db,
  actor: Actor,
  teamId: string,
  input: CreateEventInput,
  now: Date,
): Promise<EventDetail> {
  const { team, permissions } = await loadTeamForActor(db, actor, teamId);
  if (!permissions.manageEvents)
    throw forbidden('Termine dürfen nur Verantwortliche der Mannschaft anlegen.');

  const startsAt = new Date(input.startsAt);
  if (startsAt.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    throw new HttpError(400, 'in_past', 'Der Termin liegt in der Vergangenheit.');
  }
  const endsAt = input.endsAt
    ? new Date(input.endsAt)
    : new Date(startsAt.getTime() + DEFAULT_MINUTES[input.type] * 60_000);
  if (endsAt <= startsAt)
    throw new HttpError(400, 'invalid_range', 'Das Ende muss nach dem Beginn liegen.');
  if (input.type === 'match' && !input.opponentName?.trim()) {
    throw new HttpError(400, 'opponent_required', 'Bitte gib den Gegner an.');
  }
  if (input.type === 'team_event' && !input.title?.trim()) {
    throw new HttpError(400, 'title_required', 'Bitte gib einen Titel an.');
  }
  if (input.facilityId) {
    const [facility] = await db
      .select({ id: s.facilities.id })
      .from(s.facilities)
      .where(and(eq(s.facilities.id, input.facilityId), eq(s.facilities.clubId, actor.club.id)));
    if (!facility) throw new HttpError(400, 'invalid_facility', 'Unbekannter Platz.');
  }

  const ourName = `${actor.club.shortName} ${team.badge}`;
  const opponent = input.opponentName?.trim() ?? '';
  const isHome = input.isHome ?? true;
  const title =
    input.title?.trim() ||
    (input.type === 'match'
      ? isHome
        ? `${ourName} – ${opponent}`
        : `${opponent} – ${ourName}`
      : TITLES[input.type]);

  const eventId = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(s.events)
      .values({
        clubId: actor.club.id,
        teamId: team.id,
        orgUnitId: team.orgUnitId,
        type: input.type,
        title,
        description: input.description?.trim() || null,
        startsAt,
        endsAt,
        meetingAt: input.meetingAt ? new Date(input.meetingAt) : null,
        meetingPoint: input.meetingPoint?.trim() || null,
        facilityId: input.facilityId ?? null,
        locationText: input.facilityId ? null : input.locationText?.trim() || null,
        contactPersonId: actor.person.id,
      })
      .returning({ id: s.events.id });

    if (input.type === 'match') {
      await tx.insert(s.matchDetails).values({
        eventId: event!.id,
        clubId: actor.club.id,
        opponentName: opponent,
        isHome,
        competition: team.league,
      });
    }

    // Teilnehmer nach Teilnahme-Modell; Abwesenheiten werden sofort berücksichtigt
    const day = toIsoDate(calendarDayOf(startsAt, actor.club.timezone));
    const members = await tx
      .select({ personId: s.teamMemberships.personId, fn: s.teamMemberships.function })
      .from(s.teamMemberships)
      .where(
        and(
          eq(s.teamMemberships.teamId, team.id),
          lte(s.teamMemberships.validFrom, day),
          or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, day)),
        ),
      );
    const playerIds = members.filter((m) => m.fn === 'player').map((m) => m.personId);
    const absences = playerIds.length
      ? await tx
          .select()
          .from(s.absences)
          .where(
            and(
              inArray(s.absences.personId, playerIds),
              lte(s.absences.startsOn, day),
              gte(s.absences.endsOn, day),
            ),
          )
      : [];

    const seen = new Set<string>();
    const rows = [...members]
      .sort((a, b) => Number(a.fn !== 'player') - Number(b.fn !== 'player'))
      .filter((m) => (seen.has(m.personId) ? false : (seen.add(m.personId), true)))
      .map((m) => {
        if (m.fn !== 'player') {
          return {
            clubId: actor.club.id,
            eventId: event!.id,
            personId: m.personId,
            role: 'coach' as const,
            status: 'yes' as const,
          };
        }
        const absence = absences.find(
          (a) => a.personId === m.personId && (!a.teamIds || a.teamIds.includes(team.id)),
        );
        if (absence) {
          return {
            clubId: actor.club.id,
            eventId: event!.id,
            personId: m.personId,
            role: 'player' as const,
            status: 'no' as const,
            reason: absenceReason(absence.kind),
            absenceId: absence.id,
          };
        }
        return {
          clubId: actor.club.id,
          eventId: event!.id,
          personId: m.personId,
          role: 'player' as const,
          status:
            team.participationMode === 'active_response' ? ('pending' as const) : ('yes' as const),
        };
      });
    if (rows.length) await tx.insert(s.eventParticipants).values(rows);
    return event!.id;
  });

  const memberIds = (
    await db
      .select({ personId: s.eventParticipants.personId })
      .from(s.eventParticipants)
      .where(eq(s.eventParticipants.eventId, eventId))
  ).map((r) => r.personId);
  await notify(
    db,
    actor,
    await recipientsFor(db, memberIds, actor.user.id),
    {
      level: team.participationMode === 'active_response' ? 'action' : 'info',
      title: `Neuer Termin: ${title}`,
      body: `${team.badge} · ${timeFmt(actor.club.timezone).format(startsAt)} Uhr`,
      link: `/events/${eventId}`,
    },
    now,
  );

  return getEventDetail(db, actor, eventId, now);
}

export async function cancelEvent(
  db: Db,
  actor: Actor,
  eventId: string,
  reason: string,
  now: Date,
): Promise<EventDetail> {
  const [row] = await db
    .select({ event: s.events, team: s.teams })
    .from(s.events)
    .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .where(and(eq(s.events.id, eventId), eq(s.events.clubId, actor.club.id)));
  if (!row) throw notFound('Der Termin');
  const allowed = row.team
    ? actorCan(actor, 'events.manage', row.team)
    : actorCan(actor, 'events.manage');
  if (!allowed) throw forbidden('Diesen Termin darfst du nicht absagen.');
  if (row.event.status === 'cancelled') {
    throw new HttpError(409, 'already_cancelled', 'Der Termin ist bereits abgesagt.');
  }
  if (row.event.startsAt < now) {
    throw new HttpError(409, 'in_past', 'Vergangene Termine können nicht abgesagt werden.');
  }

  await db
    .update(s.events)
    .set({ status: 'cancelled', cancelledReason: reason.trim() })
    .where(eq(s.events.id, eventId));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'event.cancelled',
    entityType: 'event',
    entityId: eventId,
    data: { reason: reason.trim() },
    createdAt: now,
  });

  const participants = await db
    .select({ personId: s.eventParticipants.personId })
    .from(s.eventParticipants)
    .where(eq(s.eventParticipants.eventId, eventId));
  await notify(
    db,
    actor,
    await recipientsFor(
      db,
      participants.map((p) => p.personId),
      actor.user.id,
    ),
    {
      level: 'urgent',
      title: `Abgesagt: ${row.event.title}`,
      body: `${row.team ? `${row.team.badge} · ` : ''}${timeFmt(actor.club.timezone).format(row.event.startsAt)} Uhr – ${reason.trim()}`,
      link: `/events/${eventId}`,
    },
    now,
  );

  return getEventDetail(db, actor, eventId, now);
}
