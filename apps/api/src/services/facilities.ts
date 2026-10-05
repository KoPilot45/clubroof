/**
 * Platzbelegung (Mappe S. 15, Konzept §5–6): Belegung je Platz für einen Zeitraum, Konfliktprüfung
 * und Sperrungen. Sperrungen können betroffene Termine absagen und die Beteiligten informieren.
 */
import {
  addDays,
  at,
  calendarDayOf,
  fromIsoDate,
  toIsoDate,
  type CreateFacilityBlockInput,
  type FacilityBooking,
  type FacilityOccupancy,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { notify, recipientsFor } from './event-admin';

const DEFAULT_EVENT_MINUTES = 120;
const MAX_RANGE_DAYS = 31;

type EventRow = typeof s.events.$inferSelect;

const eventEnd = (e: Pick<EventRow, 'startsAt' | 'endsAt'>) =>
  e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000);

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;

function requireModule(actor: Actor) {
  if (!moduleEnabled(actor, 'facility_booking')) {
    throw forbidden('Die Platzbelegung ist für den Verein nicht aktiviert.');
  }
}

/** Ansehen dürfen Platzverantwortliche und alle, die Termine einer Mannschaft verwalten. */
async function requireViewer(db: Db, actor: Actor): Promise<{ canManage: boolean }> {
  requireModule(actor);
  const canManage = actorCan(actor, 'facilities.manage');
  if (canManage) return { canManage };
  const teams = await db
    .select({ id: s.teams.id, orgUnitId: s.teams.orgUnitId })
    .from(s.teams)
    .where(eq(s.teams.clubId, actor.club.id));
  if (!teams.some((t) => actorCan(actor, 'events.manage', t))) {
    throw forbidden('Die Platzbelegung ist für Trainerteams und Platzverantwortliche.');
  }
  return { canManage };
}

export async function getOccupancy(
  db: Db,
  actor: Actor,
  from: string,
  to: string,
): Promise<FacilityOccupancy> {
  const { canManage } = await requireViewer(db, actor);
  const first = fromIsoDate(from);
  const last = fromIsoDate(to);
  if (last < first) throw new HttpError(400, 'invalid_range', 'Das Ende liegt vor dem Beginn.');
  if ((last.getTime() - first.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    throw new HttpError(400, 'range_too_long', `Maximal ${MAX_RANGE_DAYS + 1} Tage möglich.`);
  }
  const start = at(first, '00:00', actor.club.timezone);
  const end = at(addDays(last, 1), '00:00', actor.club.timezone);

  const facilities = await db
    .select()
    .from(s.facilities)
    .where(eq(s.facilities.clubId, actor.club.id))
    .orderBy(asc(s.facilities.sortOrder));

  const [events, blocks] = await Promise.all([
    db
      .select({ event: s.events, badge: s.teams.badge })
      .from(s.events)
      .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
      .where(
        and(
          eq(s.events.clubId, actor.club.id),
          gt(s.events.startsAt, new Date(start.getTime() - 12 * 3_600_000)),
          lt(s.events.startsAt, end),
        ),
      )
      .orderBy(asc(s.events.startsAt)),
    db
      .select()
      .from(s.facilityBlocks)
      .where(
        and(
          eq(s.facilityBlocks.clubId, actor.club.id),
          lt(s.facilityBlocks.startsAt, end),
          gt(s.facilityBlocks.endsAt, start),
        ),
      ),
  ]);

  let conflicts = 0;
  const result = facilities.map((f) => {
    const own: (FacilityBooking & { _s: Date; _e: Date })[] = [
      ...events
        .filter((r) => r.event.facilityId === f.id)
        .map((r) => {
          const e = eventEnd(r.event);
          return {
            id: r.event.id,
            kind: 'event' as const,
            title: r.event.title,
            teamBadge: r.badge,
            eventType: r.event.type,
            startsAt: r.event.startsAt.toISOString(),
            endsAt: e.toISOString(),
            cancelled: r.event.status === 'cancelled',
            conflict: false,
            _s: r.event.startsAt,
            _e: e,
          };
        })
        .filter((b) => b._e > start),
      ...blocks
        .filter((b) => b.facilityId === f.id)
        .map((b) => ({
          id: b.id,
          kind: 'block' as const,
          title: b.reason,
          teamBadge: null,
          eventType: null,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          cancelled: false,
          conflict: false,
          _s: b.startsAt,
          _e: b.endsAt,
        })),
    ].sort((a, b) => a._s.getTime() - b._s.getTime());

    const active = own.filter((b) => !b.cancelled);
    for (const a of active) {
      for (const b of active) {
        if (a === b || (a.kind === 'block' && b.kind === 'block')) continue;
        if (overlaps(a._s, a._e, b._s, b._e)) a.conflict = true;
      }
    }
    conflicts += active.filter((b) => b.conflict).length;
    return {
      facility: { id: f.id, name: f.name, shortName: f.shortName, kind: f.kind },
      bookings: own.map(({ _s, _e, ...b }) => (void _s, void _e, b)),
    };
  });

  return { from, to, facilities: result, conflicts, canManage };
}

/** Prüft vor dem Anlegen eines Termins auf Überschneidungen. Wirft 409 mit Hinweistext. */
export async function assertFacilityFree(
  db: Db,
  actor: Actor,
  facilityId: string,
  startsAt: Date,
  endsAt: Date,
  allowConflict: boolean,
): Promise<void> {
  if (!moduleEnabled(actor, 'facility_booking')) return;
  const [blocks, events] = await Promise.all([
    db
      .select()
      .from(s.facilityBlocks)
      .where(
        and(
          eq(s.facilityBlocks.facilityId, facilityId),
          lt(s.facilityBlocks.startsAt, endsAt),
          gt(s.facilityBlocks.endsAt, startsAt),
        ),
      ),
    db
      .select({ event: s.events, badge: s.teams.badge })
      .from(s.events)
      .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
      .where(
        and(
          eq(s.events.facilityId, facilityId),
          eq(s.events.status, 'scheduled'),
          lt(s.events.startsAt, endsAt),
          gt(s.events.startsAt, new Date(startsAt.getTime() - 12 * 3_600_000)),
        ),
      ),
  ]);
  const clash = events.filter((r) => eventEnd(r.event) > startsAt);
  if (blocks.length > 0 && !(allowConflict && actorCan(actor, 'facilities.manage'))) {
    throw new HttpError(
      409,
      'facility_blocked',
      `Der Platz ist gesperrt: ${blocks[0]!.reason}. Bitte wähle einen anderen Platz oder Zeitpunkt.`,
    );
  }
  if (clash.length > 0 && !allowConflict) {
    const first = clash[0]!;
    throw new HttpError(
      409,
      'facility_conflict',
      `Der Platz ist zu dieser Zeit belegt (${first.badge ? `${first.badge} · ` : ''}${first.event.title}).`,
    );
  }
}

export async function createBlock(
  db: Db,
  actor: Actor,
  input: CreateFacilityBlockInput,
  now: Date,
): Promise<FacilityOccupancy> {
  requireModule(actor);
  if (!actorCan(actor, 'facilities.manage'))
    throw forbidden('Sperrungen dürfen nur Platzverantwortliche anlegen.');
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (endsAt <= startsAt)
    throw new HttpError(400, 'invalid_range', 'Das Ende muss nach dem Beginn liegen.');
  if (endsAt < now) throw new HttpError(400, 'in_past', 'Der Zeitraum liegt in der Vergangenheit.');
  const [facility] = await db
    .select()
    .from(s.facilities)
    .where(and(eq(s.facilities.id, input.facilityId), eq(s.facilities.clubId, actor.club.id)));
  if (!facility) throw notFound('Der Platz');
  const reason = input.reason.trim();

  const affected = input.cancelEvents
    ? await db
        .select({ event: s.events, badge: s.teams.badge })
        .from(s.events)
        .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
        .where(
          and(
            eq(s.events.facilityId, facility.id),
            eq(s.events.status, 'scheduled'),
            gt(s.events.startsAt, now),
            lt(s.events.startsAt, endsAt),
            gt(s.events.startsAt, new Date(startsAt.getTime() - 12 * 3_600_000)),
          ),
        )
        .then((rows) => rows.filter((r) => eventEnd(r.event) > startsAt))
    : [];

  const [block] = await db
    .insert(s.facilityBlocks)
    .values({ clubId: actor.club.id, facilityId: facility.id, startsAt, endsAt, reason })
    .returning({ id: s.facilityBlocks.id });
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'facility.blocked',
    entityType: 'facility_block',
    entityId: block!.id,
    data: { facility: facility.name, reason, cancelled: affected.length },
    createdAt: now,
  });

  if (affected.length > 0) {
    const ids = affected.map((r) => r.event.id);
    await db
      .update(s.events)
      .set({ status: 'cancelled', cancelledReason: `${facility.name} gesperrt (${reason})` })
      .where(inArray(s.events.id, ids));
    const participants = await db
      .select({ eventId: s.eventParticipants.eventId, personId: s.eventParticipants.personId })
      .from(s.eventParticipants)
      .where(inArray(s.eventParticipants.eventId, ids));
    const tz = actor.club.timezone;
    const when = new Intl.DateTimeFormat('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    });
    for (const r of affected) {
      const people = participants.filter((p) => p.eventId === r.event.id).map((p) => p.personId);
      await notify(
        db,
        actor,
        await recipientsFor(db, people, actor.user.id),
        {
          level: 'urgent',
          title: `Abgesagt: ${r.event.title}`,
          body: `${r.badge ? `${r.badge} · ` : ''}${when.format(r.event.startsAt)} Uhr – ${facility.name} gesperrt (${reason})`,
          link: `/events/${r.event.id}`,
        },
        now,
      );
    }
  }

  const day = toIsoDate(calendarDayOf(startsAt, actor.club.timezone));
  const lastDay = toIsoDate(calendarDayOf(new Date(endsAt.getTime() - 1), actor.club.timezone));
  return getOccupancy(db, actor, day, lastDay);
}

export async function deleteBlock(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  requireModule(actor);
  if (!actorCan(actor, 'facilities.manage'))
    throw forbidden('Sperrungen dürfen nur Platzverantwortliche aufheben.');
  const [block] = await db
    .select()
    .from(s.facilityBlocks)
    .where(and(eq(s.facilityBlocks.id, id), eq(s.facilityBlocks.clubId, actor.club.id)));
  if (!block) throw notFound('Die Sperrung');
  await db.delete(s.facilityBlocks).where(eq(s.facilityBlocks.id, id));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'facility.unblocked',
    entityType: 'facility_block',
    entityId: id,
    data: { reason: block.reason },
    createdAt: now,
  });
}
