/**
 * Ehrenamt (Mappe S. 14, Konzept §5): Helferschichten mit Kapazität und freiwillige Teilnahme
 * an Vereinsveranstaltungen. Namen der Helfer sehen nur Organisatoren.
 */
import type { EventAttendance, HelperEvent, HelperShift } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, eq, gt, inArray, isNull } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, notFound } from '../errors';

/** Veranstaltungsarten, an denen man freiwillig teilnimmt. */
export const OPEN_EVENT_TYPES = ['club_event', 'meeting', 'work_assignment'] as const;

export async function shiftsFor(
  db: Db,
  actor: Actor,
  eventIds: string[],
): Promise<Map<string, HelperShift[]>> {
  const result = new Map<string, HelperShift[]>();
  if (eventIds.length === 0) return result;
  const shifts = await db
    .select()
    .from(s.helperShifts)
    .where(inArray(s.helperShifts.eventId, eventIds))
    .orderBy(asc(s.helperShifts.startsAt), asc(s.helperShifts.title));
  if (shifts.length === 0) return result;

  const signups = await db
    .select({
      shiftId: s.helperSignups.shiftId,
      personId: s.helperSignups.personId,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
    })
    .from(s.helperSignups)
    .innerJoin(s.persons, eq(s.persons.id, s.helperSignups.personId))
    .where(
      inArray(
        s.helperSignups.shiftId,
        shifts.map((x) => x.id),
      ),
    );

  const maySeeNames = actorCan(actor, 'helpers.manage');
  for (const shift of shifts) {
    const own = signups.filter((x) => x.shiftId === shift.id);
    const list = result.get(shift.eventId) ?? [];
    list.push({
      id: shift.id,
      title: shift.title,
      startsAt: shift.startsAt.toISOString(),
      endsAt: shift.endsAt.toISOString(),
      capacity: shift.capacity,
      filled: own.length,
      mine: own.some((x) => x.personId === actor.person.id),
      helpers: maySeeNames ? own.map((x) => `${x.firstName} ${x.lastName}`) : null,
    });
    result.set(shift.eventId, list);
  }
  return result;
}

/** Anstehende Veranstaltungen mit Helferschichten („Helfer gesucht“). */
export async function listHelperEvents(db: Db, actor: Actor, now: Date): Promise<HelperEvent[]> {
  const events = await db
    .selectDistinct({
      id: s.events.id,
      title: s.events.title,
      startsAt: s.events.startsAt,
      location: s.facilities.name,
      locationText: s.events.locationText,
    })
    .from(s.events)
    .innerJoin(s.helperShifts, eq(s.helperShifts.eventId, s.events.id))
    .leftJoin(s.facilities, eq(s.facilities.id, s.events.facilityId))
    .where(
      and(
        eq(s.events.clubId, actor.club.id),
        isNull(s.events.teamId),
        eq(s.events.status, 'scheduled'),
        gt(s.events.startsAt, now),
      ),
    )
    .orderBy(asc(s.events.startsAt));
  const shifts = await shiftsFor(
    db,
    actor,
    events.map((e) => e.id),
  );
  return events.map((e) => {
    const list = shifts.get(e.id) ?? [];
    return {
      event: {
        id: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        location: e.location ?? e.locationText,
      },
      shifts: list,
      openSpots: list.reduce((sum, x) => sum + Math.max(0, x.capacity - x.filled), 0),
    };
  });
}

async function loadShift(db: Db, actor: Actor, shiftId: string, now: Date) {
  const [row] = await db
    .select({ shift: s.helperShifts, event: s.events })
    .from(s.helperShifts)
    .innerJoin(s.events, eq(s.events.id, s.helperShifts.eventId))
    .where(and(eq(s.helperShifts.id, shiftId), eq(s.helperShifts.clubId, actor.club.id)));
  if (!row) throw notFound('Die Schicht');
  if (row.event.status !== 'scheduled' || row.shift.startsAt <= now) {
    throw new HttpError(
      409,
      'shift_closed',
      'Für diese Schicht sind keine Änderungen mehr möglich.',
    );
  }
  return row;
}

export async function signUp(
  db: Db,
  actor: Actor,
  shiftId: string,
  now: Date,
): Promise<HelperShift> {
  const { shift } = await loadShift(db, actor, shiftId, now);
  await db.transaction(async (tx) => {
    // Sperre auf die Schicht, damit die Kapazität auch bei gleichzeitigen Anmeldungen hält
    await tx
      .select({ id: s.helperShifts.id })
      .from(s.helperShifts)
      .where(eq(s.helperShifts.id, shiftId))
      .for('update');
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(s.helperSignups)
      .where(eq(s.helperSignups.shiftId, shiftId));
    const [already] = await tx
      .select({ id: s.helperSignups.shiftId })
      .from(s.helperSignups)
      .where(
        and(eq(s.helperSignups.shiftId, shiftId), eq(s.helperSignups.personId, actor.person.id)),
      );
    if (already) return;
    if (Number(n) >= shift.capacity) {
      throw new HttpError(409, 'shift_full', 'Diese Schicht ist leider schon voll besetzt.');
    }
    await tx.insert(s.helperSignups).values({ shiftId, personId: actor.person.id, createdAt: now });
  });
  return (await shiftsFor(db, actor, [shift.eventId]))
    .get(shift.eventId)!
    .find((x) => x.id === shiftId)!;
}

export async function withdraw(
  db: Db,
  actor: Actor,
  shiftId: string,
  now: Date,
): Promise<HelperShift> {
  const { shift } = await loadShift(db, actor, shiftId, now);
  await db
    .delete(s.helperSignups)
    .where(
      and(eq(s.helperSignups.shiftId, shiftId), eq(s.helperSignups.personId, actor.person.id)),
    );
  return (await shiftsFor(db, actor, [shift.eventId]))
    .get(shift.eventId)!
    .find((x) => x.id === shiftId)!;
}

/**
 * Zusage, Absage oder „Unsicher“ für Vereinsveranstaltungen (ohne Begründung); `null` nimmt die
 * Rückmeldung zurück.
 */
export async function setAttendance(
  db: Db,
  actor: Actor,
  eventId: string,
  status: 'yes' | 'no' | 'maybe' | null,
  now: Date,
): Promise<EventAttendance> {
  const [event] = await db
    .select()
    .from(s.events)
    .where(and(eq(s.events.id, eventId), eq(s.events.clubId, actor.club.id)));
  if (!event) throw notFound('Die Veranstaltung');
  if (event.teamId !== null || !(OPEN_EVENT_TYPES as readonly string[]).includes(event.type)) {
    throw new HttpError(
      400,
      'not_open_event',
      'Für diesen Termin gibt es keine freiwillige Teilnahme.',
    );
  }
  if (event.status !== 'scheduled' || event.startsAt <= now) {
    throw new HttpError(409, 'event_closed', 'Die Anmeldung ist nicht mehr möglich.');
  }
  if (status) {
    await db
      .insert(s.eventParticipants)
      .values({
        clubId: actor.club.id,
        eventId,
        personId: actor.person.id,
        role: 'attendee',
        status,
        respondedAt: now,
        respondedByPersonId: actor.person.id,
      })
      .onConflictDoUpdate({
        target: [s.eventParticipants.eventId, s.eventParticipants.personId],
        set: { status, respondedAt: now, respondedByPersonId: actor.person.id },
      });
  } else {
    await db
      .delete(s.eventParticipants)
      .where(
        and(
          eq(s.eventParticipants.eventId, eventId),
          eq(s.eventParticipants.personId, actor.person.id),
          eq(s.eventParticipants.role, 'attendee'),
        ),
      );
  }
  return attendanceFor(db, actor, eventId);
}

export async function attendanceFor(
  db: Db,
  actor: Actor,
  eventId: string,
): Promise<EventAttendance> {
  const rows = await db
    .select({ personId: s.eventParticipants.personId, status: s.eventParticipants.status })
    .from(s.eventParticipants)
    .where(and(eq(s.eventParticipants.eventId, eventId), eq(s.eventParticipants.role, 'attendee')));
  const mine = rows.find((r) => r.personId === actor.person.id)?.status;
  return {
    status: mine === 'yes' || mine === 'no' || mine === 'maybe' ? mine : null,
    attending: mine === 'yes',
    count: rows.filter((r) => r.status === 'yes').length,
    maybe: rows.filter((r) => r.status === 'maybe').length,
    declined: rows.filter((r) => r.status === 'no').length,
  };
}
