/**
 * Trainer-Funktionen in der App: Termine anlegen und absagen. Neue Termine erhalten sofort
 * Teilnehmer nach dem Teilnahme-Modell der Mannschaft und berücksichtigen Abwesenheiten.
 */
import {
  can,
  addDays,
  at,
  calendarDayOf,
  toIsoDate,
  type CreateEventInput,
  type EventChange,
  type EventDetail,
  type UpdateEventInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { deliver, type NotificationInput } from '../notify/deliver';
import { HttpError, forbidden, notFound } from '../errors';
import { absenceReason } from './absences';
import { getEventDetail } from './events';
import { assertFacilityFree } from './facilities';
import { loadTeamForActor } from './team-access';

const localHm = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(d);

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

/** Benachrichtigung im Namen des Handelnden (Zustellung nach persönlichen Einstellungen). */
export async function notify(
  db: Db,
  actor: Actor,
  userIds: string[],
  n: NotificationInput,
  now: Date,
) {
  await deliver(db, actor.club, userIds, n, now);
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

  const repeat = input.type === 'match' ? 1 : Math.min(Math.max(input.repeatWeeks ?? 1, 1), 26);
  const firstDay = calendarDayOf(startsAt, actor.club.timezone);
  const hm = localHm(startsAt, actor.club.timezone);
  const meetingOffset = input.meetingAt
    ? startsAt.getTime() - new Date(input.meetingAt).getTime()
    : null;
  const occurrences = Array.from({ length: repeat }, (_, i) => {
    const start = i === 0 ? startsAt : at(addDays(firstDay, 7 * i), hm, actor.club.timezone);
    return {
      startsAt: start,
      endsAt: new Date(start.getTime() + (endsAt.getTime() - startsAt.getTime())),
      meetingAt: meetingOffset === null ? null : new Date(start.getTime() - meetingOffset),
    };
  });
  if (input.facilityId) {
    for (const occ of occurrences) {
      await assertFacilityFree(
        db,
        actor,
        input.facilityId,
        occ.startsAt,
        occ.endsAt,
        !!input.allowConflict,
      );
    }
  }

  const seriesId = occurrences.length > 1 ? randomUUID() : null;
  const eventIds = await db.transaction(async (tx) => {
    const created: string[] = [];
    for (const occ of occurrences) {
      const [event] = await tx
        .insert(s.events)
        .values({
          clubId: actor.club.id,
          teamId: team.id,
          orgUnitId: team.orgUnitId,
          type: input.type,
          title,
          description: input.description?.trim() || null,
          startsAt: occ.startsAt,
          endsAt: occ.endsAt,
          meetingAt: occ.meetingAt,
          seriesId,
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
      const day = toIsoDate(calendarDayOf(occ.startsAt, actor.club.timezone));
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
              team.participationMode === 'active_response'
                ? ('pending' as const)
                : ('yes' as const),
          };
        });
      if (rows.length) await tx.insert(s.eventParticipants).values(rows);
      created.push(event!.id);
    }
    return created;
  });
  const eventId = eventIds[0]!;

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
      topic: 'events',
      teamId: team.id,
      title: repeat > 1 ? `Neue Terminserie: ${title}` : `Neuer Termin: ${title}`,
      body: `${team.badge} · ${timeFmt(actor.club.timezone).format(startsAt)} Uhr${repeat > 1 ? ` · wöchentlich, ${repeat} Termine` : ''}`,
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
    : can(
        actor.grants,
        'events.manage',
        row.event.orgUnitId ? { orgUnitId: row.event.orgUnitId } : {},
      );
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
      topic: 'events',
      teamId: row.team?.id ?? null,
      title: `Abgesagt: ${row.event.title}`,
      body: `${row.team ? `${row.team.badge} · ` : ''}${timeFmt(actor.club.timezone).format(row.event.startsAt)} Uhr – ${reason.trim()}`,
      link: `/events/${eventId}`,
    },
    now,
  );

  return getEventDetail(db, actor, eventId, now);
}

// ── Termine ändern ───────────────────────────────────────────────────────────

type EventRow = typeof s.events.$inferSelect;

const fmtDateTime = (tz: string, d: Date | null) => (d ? `${timeFmt(tz).format(d)} Uhr` : null);

/** Gleicher Wochentag-Termin in der Serie mit neuer lokaler Uhrzeit. */
function sameDayAt(original: Date, reference: Date, tz: string): Date {
  return at(calendarDayOf(original, tz), localHm(reference, tz), tz);
}

export async function updateEvent(
  db: Db,
  actor: Actor,
  eventId: string,
  input: UpdateEventInput,
  now: Date,
): Promise<EventDetail> {
  const [row] = await db
    .select({ event: s.events, team: s.teams })
    .from(s.events)
    .innerJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .where(and(eq(s.events.id, eventId), eq(s.events.clubId, actor.club.id)));
  if (!row) throw notFound('Der Termin');
  if (!actorCan(actor, 'events.manage', row.team))
    throw forbidden('Diesen Termin darfst du nicht ändern.');
  const event = row.event;
  if (event.status === 'cancelled')
    throw new HttpError(409, 'cancelled', 'Abgesagte Termine können nicht geändert werden.');
  if (event.startsAt < now)
    throw new HttpError(409, 'in_past', 'Vergangene Termine können nicht geändert werden.');
  const tz = actor.club.timezone;

  // Zielwerte dieses Termins
  const startsAt = input.startsAt ? new Date(input.startsAt) : event.startsAt;
  const oldEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 90 * 60_000);
  const endsAt =
    input.endsAt !== undefined
      ? input.endsAt
        ? new Date(input.endsAt)
        : null
      : input.startsAt
        ? new Date(startsAt.getTime() + (oldEnd.getTime() - event.startsAt.getTime()))
        : event.endsAt;
  if (endsAt && endsAt <= startsAt)
    throw new HttpError(400, 'invalid_range', 'Das Ende muss nach dem Beginn liegen.');
  if (startsAt < now)
    throw new HttpError(400, 'in_past', 'Der neue Beginn liegt in der Vergangenheit.');
  const meetingAt =
    input.meetingAt !== undefined
      ? input.meetingAt
        ? new Date(input.meetingAt)
        : null
      : input.startsAt && event.meetingAt
        ? new Date(startsAt.getTime() - (event.startsAt.getTime() - event.meetingAt.getTime()))
        : event.meetingAt;
  const facilityId = input.facilityId !== undefined ? input.facilityId : event.facilityId;
  if (facilityId && facilityId !== event.facilityId) {
    const [f] = await db
      .select({ id: s.facilities.id })
      .from(s.facilities)
      .where(and(eq(s.facilities.id, facilityId), eq(s.facilities.clubId, actor.club.id)));
    if (!f) throw new HttpError(400, 'invalid_facility', 'Unbekannter Platz.');
  }
  const locationText =
    facilityId !== null
      ? null
      : input.locationText !== undefined
        ? input.locationText?.trim() || null
        : event.locationText;
  const title = input.title !== undefined ? input.title.trim() || event.title : event.title;
  const meetingPoint =
    input.meetingPoint !== undefined ? input.meetingPoint?.trim() || null : event.meetingPoint;
  const description =
    input.description !== undefined ? input.description?.trim() || null : event.description;

  // Betroffene Termine: dieser, bei „folgende“ alle späteren der Serie
  const targets: EventRow[] = [event];
  if (input.scope === 'following' && event.seriesId) {
    const later = await db
      .select()
      .from(s.events)
      .where(
        and(
          eq(s.events.seriesId, event.seriesId),
          eq(s.events.status, 'scheduled'),
          gt(s.events.startsAt, event.startsAt),
        ),
      )
      .orderBy(asc(s.events.startsAt));
    targets.push(...later);
  }

  const plan = targets.map((e, i) => {
    if (i === 0) return { e, startsAt, endsAt, meetingAt };
    const start = input.startsAt ? sameDayAt(e.startsAt, startsAt, tz) : e.startsAt;
    const dur = endsAt ? endsAt.getTime() - startsAt.getTime() : null;
    const oldDur = e.endsAt ? e.endsAt.getTime() - e.startsAt.getTime() : null;
    const end =
      input.startsAt || input.endsAt !== undefined
        ? dur !== null
          ? new Date(start.getTime() + dur)
          : null
        : oldDur !== null
          ? new Date(start.getTime() + oldDur)
          : null;
    const meet =
      meetingAt && input.startsAt
        ? new Date(start.getTime() - (startsAt.getTime() - meetingAt.getTime()))
        : input.meetingAt === null
          ? null
          : e.meetingAt;
    return { e, startsAt: start, endsAt: end, meetingAt: meet };
  });

  if (facilityId) {
    for (const p of plan) {
      await assertFacilityFree(
        db,
        actor,
        facilityId,
        p.startsAt,
        p.endsAt ?? new Date(p.startsAt.getTime() + 90 * 60_000),
        !!input.allowConflict,
        p.e.id,
      );
    }
  }

  // Match-Daten
  const [match] = await db
    .select()
    .from(s.matchDetails)
    .where(eq(s.matchDetails.eventId, event.id));
  const opponent = input.opponentName?.trim();
  if (match && input.opponentName !== undefined && !opponent)
    throw new HttpError(400, 'opponent_required', 'Bitte gib den Gegner an.');

  // Änderungsanzeige (alt → neu) für diesen Termin
  const facilityNames = new Map(
    (
      await db
        .select({ id: s.facilities.id, name: s.facilities.name })
        .from(s.facilities)
        .where(eq(s.facilities.clubId, actor.club.id))
    ).map((f) => [f.id, f.name]),
  );
  const place = (fid: string | null, text: string | null) =>
    (fid ? facilityNames.get(fid) : null) ?? text;
  const changes: EventChange[] = [];
  const add = (label: string, from: string | null, to: string | null) => {
    if (from !== to) changes.push({ label, from, to });
  };
  add('Beginn', fmtDateTime(tz, event.startsAt), fmtDateTime(tz, startsAt));
  add('Ende', fmtDateTime(tz, event.endsAt), fmtDateTime(tz, endsAt));
  add('Treffen', fmtDateTime(tz, event.meetingAt), fmtDateTime(tz, meetingAt));
  add('Treffpunkt', event.meetingPoint, meetingPoint);
  add('Ort', place(event.facilityId, event.locationText), place(facilityId, locationText));
  add('Titel', event.title, title);
  add('Info', event.description, description);
  if (match && opponent) add('Gegner', match.opponentName, opponent);
  if (match && input.isHome !== undefined)
    add(
      'Spielort',
      match.isHome ? 'Heimspiel' : 'Auswärtsspiel',
      input.isHome ? 'Heimspiel' : 'Auswärtsspiel',
    );
  if (changes.length === 0) return getEventDetail(db, actor, eventId, now);

  await db.transaction(async (tx) => {
    for (const p of plan) {
      await tx
        .update(s.events)
        .set({
          startsAt: p.startsAt,
          endsAt: p.endsAt,
          meetingAt: p.meetingAt,
          meetingPoint,
          facilityId,
          locationText,
          title: p.e.id === event.id || input.title !== undefined ? title : p.e.title,
          description,
        })
        .where(eq(s.events.id, p.e.id));
      await tx.insert(s.auditLog).values({
        clubId: actor.club.id,
        actorUserId: actor.user.id,
        action: 'event.updated',
        entityType: 'event',
        entityId: p.e.id,
        data: { changes },
        createdAt: now,
      });
    }
    if (match && (opponent || input.isHome !== undefined)) {
      await tx
        .update(s.matchDetails)
        .set({
          ...(opponent ? { opponentName: opponent } : {}),
          ...(input.isHome !== undefined ? { isHome: input.isHome } : {}),
        })
        .where(eq(s.matchDetails.eventId, event.id));
    }
  });

  const participants = await db
    .select({ personId: s.eventParticipants.personId })
    .from(s.eventParticipants)
    .where(
      inArray(
        s.eventParticipants.eventId,
        plan.map((p) => p.e.id),
      ),
    );
  const important = changes.some((c) =>
    ['Beginn', 'Treffen', 'Ort', 'Treffpunkt', 'Gegner'].includes(c.label),
  );
  await notify(
    db,
    actor,
    await recipientsFor(db, [...new Set(participants.map((p) => p.personId))], actor.user.id),
    {
      level: important ? 'important' : 'info',
      topic: 'events',
      teamId: row.team.id,
      title: `Geändert: ${title}`,
      body: `${row.team.badge} · ${changes
        .slice(0, 3)
        .map((c) => `${c.label}: ${c.from ?? '–'} → ${c.to ?? '–'}`)
        .join(' · ')}${plan.length > 1 ? ` (gilt für ${plan.length} Termine)` : ''}`,
      link: `/events/${eventId}`,
    },
    now,
  );

  return getEventDetail(db, actor, eventId, now);
}
