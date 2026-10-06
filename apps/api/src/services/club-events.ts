/**
 * Veranstaltungen planen (Mappe S. 8): Vereins- und Bereichsveranstaltungen wie Sommerfest,
 * Jahreshauptversammlung oder Arbeitseinsatz – mit Ablaufplan und Helferschichten.
 * Recht: `events.manage` für den Verein (Vorstand) bzw. den eigenen Bereich (Jugendleitung).
 */
import {
  can,
  scopesWith,
  type ClubEventType,
  type CreateClubEventInput,
  type EventPlanning,
  type PlannedEvent,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError, forbidden } from '../errors';
import { notify } from './event-admin';
import { usersInScope } from './editorial';
import { assertFacilityFree } from './facilities';
import { loadScopeContext } from './scopes';

const TYPE_LABELS: Record<ClubEventType, string> = {
  club_event: 'Veranstaltung',
  meeting: 'Versammlung',
  work_assignment: 'Arbeitseinsatz',
};

function planScopes(actor: Actor, units: { id: string; name: string }[]) {
  const sc = scopesWith(actor.grants, 'events.manage');
  return [
    ...(sc.all ? [{ orgUnitId: null, label: 'Ganzer Verein' }] : []),
    ...units
      .filter((u) => sc.all || sc.orgUnitIds.includes(u.id))
      .map((u) => ({ orgUnitId: u.id, label: u.name })),
  ];
}

export async function getEventPlanning(db: Db, actor: Actor, now: Date): Promise<EventPlanning> {
  const units = await db
    .select({ id: s.orgUnits.id, name: s.orgUnits.name })
    .from(s.orgUnits)
    .where(eq(s.orgUnits.clubId, actor.club.id))
    .orderBy(asc(s.orgUnits.sortOrder));
  const scopes = planScopes(actor, units);
  if (scopes.length === 0)
    throw forbidden('Veranstaltungen plant der Vorstand bzw. die Bereichsleitung.');
  const [facilities, events] = await Promise.all([
    db
      .select({ id: s.facilities.id, name: s.facilities.name })
      .from(s.facilities)
      .where(eq(s.facilities.clubId, actor.club.id))
      .orderBy(asc(s.facilities.name)),
    db
      .select({ event: s.events, facility: s.facilities.name })
      .from(s.events)
      .leftJoin(s.facilities, eq(s.facilities.id, s.events.facilityId))
      .where(
        and(
          eq(s.events.clubId, actor.club.id),
          isNull(s.events.teamId),
          gt(s.events.startsAt, now),
          inArray(s.events.type, ['club_event', 'meeting', 'work_assignment']),
        ),
      )
      .orderBy(asc(s.events.startsAt))
      .limit(50),
  ]);
  const ids = events.map((e) => e.event.id);
  const shifts = ids.length
    ? await db
        .select({
          eventId: s.helperShifts.eventId,
          title: s.helperShifts.title,
          capacity: s.helperShifts.capacity,
          startsAt: s.helperShifts.startsAt,
          filled: count(s.helperSignups.personId),
        })
        .from(s.helperShifts)
        .leftJoin(s.helperSignups, eq(s.helperSignups.shiftId, s.helperShifts.id))
        .where(inArray(s.helperShifts.eventId, ids))
        .groupBy(s.helperShifts.id)
        .orderBy(asc(s.helperShifts.startsAt), asc(s.helperShifts.title))
    : [];
  const unitName = (id: string | null) => units.find((u) => u.id === id)?.name ?? 'Ganzer Verein';
  const upcoming: PlannedEvent[] = events.map(({ event, facility }) => ({
    id: event.id,
    type: event.type as ClubEventType,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    status: event.status === 'cancelled' ? 'cancelled' : 'scheduled',
    location: facility ?? event.locationText,
    scopeLabel: unitName(event.orgUnitId),
    shifts: shifts
      .filter((x) => x.eventId === event.id)
      .map((x) => ({ title: x.title, filled: Number(x.filled), capacity: x.capacity })),
  }));
  return { scopes, facilities, upcoming };
}

export async function createClubEvent(
  db: Db,
  actor: Actor,
  input: CreateClubEventInput,
  now: Date,
): Promise<EventPlanning> {
  const target = input.orgUnitId ? { orgUnitId: input.orgUnitId } : {};
  if (!can(actor.grants, 'events.manage', target))
    throw forbidden(
      input.orgUnitId
        ? 'Für diesen Bereich darfst du keine Veranstaltungen planen.'
        : 'Vereinsveranstaltungen plant der Vorstand.',
    );
  if (input.orgUnitId) {
    const [unit] = await db
      .select({ id: s.orgUnits.id })
      .from(s.orgUnits)
      .where(and(eq(s.orgUnits.id, input.orgUnitId), eq(s.orgUnits.clubId, actor.club.id)));
    if (!unit) throw new HttpError(400, 'invalid_unit', 'Unbekannter Bereich.');
  }
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (startsAt < now)
    throw new HttpError(400, 'in_past', 'Die Veranstaltung liegt in der Vergangenheit.');
  if (endsAt <= startsAt) throw new HttpError(400, 'invalid_end', 'Das Ende liegt vor dem Beginn.');
  for (const shift of input.shifts ?? []) {
    const a = new Date(shift.startsAt);
    const b = new Date(shift.endsAt);
    if (b <= a)
      throw new HttpError(400, 'invalid_shift', `Schicht „${shift.title}“: Ende vor Beginn.`);
    if (
      a.getTime() < startsAt.getTime() - 12 * 3_600_000 ||
      b.getTime() > endsAt.getTime() + 12 * 3_600_000
    )
      throw new HttpError(
        400,
        'invalid_shift',
        `Schicht „${shift.title}“ liegt nicht bei der Veranstaltung.`,
      );
  }
  if (input.facilityId) {
    const [facility] = await db
      .select({ id: s.facilities.id })
      .from(s.facilities)
      .where(and(eq(s.facilities.id, input.facilityId), eq(s.facilities.clubId, actor.club.id)));
    if (!facility) throw new HttpError(400, 'invalid_facility', 'Unbekannter Platz.');
    await assertFacilityFree(
      db,
      actor,
      input.facilityId,
      startsAt,
      endsAt,
      input.allowConflict === true,
    );
  }

  const eventId = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(s.events)
      .values({
        clubId: actor.club.id,
        orgUnitId: input.orgUnitId ?? null,
        type: input.type,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        startsAt,
        endsAt,
        facilityId: input.facilityId ?? null,
        locationText: input.facilityId ? null : input.locationText?.trim() || null,
        program: input.program?.length ? input.program : null,
        contactPersonId: actor.person.id,
        createdAt: now,
      })
      .returning({ id: s.events.id });
    if (input.shifts?.length)
      await tx.insert(s.helperShifts).values(
        input.shifts.map((x) => ({
          clubId: actor.club.id,
          eventId: event!.id,
          title: x.title.trim(),
          startsAt: new Date(x.startsAt),
          endsAt: new Date(x.endsAt),
          capacity: x.capacity,
        })),
      );
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'event.planned',
      entityType: 'event',
      entityId: event!.id,
      data: { label: `${TYPE_LABELS[input.type]} geplant: ${input.title.trim()}` },
      createdAt: now,
    });
    return event!.id;
  });

  const ctx = await loadScopeContext(db, actor);
  const when = new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: actor.club.timezone,
  }).format(startsAt);
  await notify(
    db,
    actor,
    await usersInScope(
      db,
      actor,
      ctx,
      input.orgUnitId ? 'org_unit' : 'club',
      input.orgUnitId ?? null,
      now,
    ),
    {
      level: 'info',
      topic: 'events',
      title: `${TYPE_LABELS[input.type]}: ${input.title.trim()}`,
      body: `${when} Uhr${input.shifts?.length ? ' · Helfer gesucht' : ''}`,
      link: `/events/${eventId}`,
    },
    now,
  );
  return getEventPlanning(db, actor, now);
}
