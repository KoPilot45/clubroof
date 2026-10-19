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
  type UpdateFacilityBlockInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gt, inArray, lt, ne } from 'drizzle-orm';
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

/**
 * Feste Grenze (Paket E2): Zwei Gruppen parallel auf einem Platz sind üblich; erst ab drei Terminen, die sich zeitlich
 * überlappen, gilt der Platz als überbelegt. Es bleibt ein Hinweis – „Trotzdem anlegen“ geht immer.
 */
export const PARALLEL_LIMIT = 3;

/** Höchste Zahl gleichzeitiger Termine innerhalb von [from, to). */
export function maxConcurrent(items: { s: Date; e: Date }[], from: Date, to: Date): number {
  const points: { t: number; d: number }[] = [];
  for (const i of items) {
    if (!overlaps(i.s, i.e, from, to)) continue;
    points.push({ t: Math.max(i.s.getTime(), from.getTime()), d: 1 });
    points.push({ t: Math.min(i.e.getTime(), to.getTime()), d: -1 });
  }
  // Ende vor Beginn bei gleicher Zeit: aneinander anschließende Termine überlappen nicht
  points.sort((a, b) => a.t - b.t || a.d - b.d);
  let now = 0;
  let max = 0;
  for (const p of points) {
    now += p.d;
    max = Math.max(max, now);
  }
  return max;
}

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
    // Kabinen haben einen eigenen Plan (Modul „Anlage & Material“)
    .where(and(eq(s.facilities.clubId, actor.club.id), ne(s.facilities.kind, 'changing_room')))
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
            editedAt: null,
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
          editedAt: b.editedAt?.toISOString() ?? null,
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
    const eventsHere = active.filter((b) => b.kind === 'event');
    for (const a of active) {
      if (a.kind === 'block') {
        // Sperrung: gilt als Konflikt, sobald ein Termin hineinfällt
        a.conflict = eventsHere.some((b) => overlaps(a._s, a._e, b._s, b._e));
      } else {
        const blocked = active.some((b) => b.kind === 'block' && overlaps(a._s, a._e, b._s, b._e));
        a.conflict =
          blocked ||
          maxConcurrent(
            eventsHere.map((b) => ({ s: b._s, e: b._e })),
            a._s,
            a._e,
          ) >= PARALLEL_LIMIT;
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
  excludeEventId?: string,
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
  const clash = events.filter((r) => r.event.id !== excludeEventId && eventEnd(r.event) > startsAt);
  if (blocks.length > 0 && !(allowConflict && actorCan(actor, 'facilities.manage'))) {
    throw new HttpError(
      409,
      'facility_blocked',
      `Der Platz ist gesperrt: ${blocks[0]!.reason}. Bitte wähle einen anderen Platz oder Zeitpunkt.`,
    );
  }
  const crowded =
    maxConcurrent(
      [
        ...clash.map((r) => ({ s: r.event.startsAt, e: eventEnd(r.event) })),
        { s: startsAt, e: endsAt },
      ],
      startsAt,
      endsAt,
    ) >= PARALLEL_LIMIT;
  if (crowded && !allowConflict) {
    const names = clash.map((r) => r.badge ?? r.event.title).join(', ');
    throw new HttpError(
      409,
      'facility_conflict',
      `Der Platz ist zu dieser Zeit schon mit mehreren Gruppen belegt (${names}).`,
    );
  }
}

/** Ruhiger Hinweis vor dem Anlegen: welche Gruppen zur selben Zeit auf dem Platz sind und ob er gesperrt ist. */
export async function getParallel(
  db: Db,
  actor: Actor,
  facilityId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<{ groups: string[]; blocked: string | null; crowded: boolean }> {
  await requireViewer(db, actor);
  const [blocks, events] = await Promise.all([
    db
      .select()
      .from(s.facilityBlocks)
      .where(
        and(
          eq(s.facilityBlocks.facilityId, facilityId),
          eq(s.facilityBlocks.clubId, actor.club.id),
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
          eq(s.events.clubId, actor.club.id),
          eq(s.events.status, 'scheduled'),
          lt(s.events.startsAt, endsAt),
          gt(s.events.startsAt, new Date(startsAt.getTime() - 12 * 3_600_000)),
        ),
      ),
  ]);
  const clash = events.filter((r) => eventEnd(r.event) > startsAt);
  const crowded =
    maxConcurrent(
      [
        ...clash.map((r) => ({ s: r.event.startsAt, e: eventEnd(r.event) })),
        { s: startsAt, e: endsAt },
      ],
      startsAt,
      endsAt,
    ) >= PARALLEL_LIMIT;
  return {
    groups: [...new Set(clash.map((r) => r.badge ?? r.event.title))],
    blocked: blocks[0]?.reason ?? null,
    crowded,
  };
}

/** Anstehende Termine auf dem Platz, die in den gesperrten Zeitraum fallen. */
async function eventsInBlock(db: Db, facilityId: string, startsAt: Date, endsAt: Date, now: Date) {
  return db
    .select({ event: s.events, badge: s.teams.badge })
    .from(s.events)
    .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .where(
      and(
        eq(s.events.facilityId, facilityId),
        eq(s.events.status, 'scheduled'),
        gt(s.events.startsAt, now),
        lt(s.events.startsAt, endsAt),
        gt(s.events.startsAt, new Date(startsAt.getTime() - 12 * 3_600_000)),
      ),
    )
    .then((rows) => rows.filter((r) => eventEnd(r.event) > startsAt));
}

/** Betroffene Termine absagen (Grund: Platz gesperrt) und die Beteiligten informieren. */
async function cancelAffected(
  db: Db,
  actor: Actor,
  facilityName: string,
  reason: string,
  affected: Awaited<ReturnType<typeof eventsInBlock>>,
  now: Date,
) {
  if (affected.length > 0) {
    const ids = affected.map((r) => r.event.id);
    await db
      .update(s.events)
      .set({ status: 'cancelled', cancelledReason: `${facilityName} gesperrt (${reason})` })
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
          topic: 'events',
          teamId: r.event.teamId,
          title: `Abgesagt: ${r.event.title}`,
          body: `${r.badge ? `${r.badge} · ` : ''}${when.format(r.event.startsAt)} Uhr – ${facilityName} gesperrt (${reason})`,
          link: `/events/${r.event.id}`,
        },
        now,
      );
    }
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
    ? await eventsInBlock(db, facility.id, startsAt, endsAt, now)
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

  await cancelAffected(db, actor, facility.name, reason, affected, now);

  const day = toIsoDate(calendarDayOf(startsAt, actor.club.timezone));
  const lastDay = toIsoDate(calendarDayOf(new Date(endsAt.getTime() - 1), actor.club.timezone));
  return getOccupancy(db, actor, day, lastDay);
}

/**
 * Sperrung nachträglich ändern (Paket BE): Platz, Zeitraum und Grund. Betroffene Termine werden neu geprüft und auf
 * Wunsch wie beim Anlegen abgesagt; bereits abgesagte Termine bleiben abgesagt.
 */
export async function updateBlock(
  db: Db,
  actor: Actor,
  id: string,
  input: UpdateFacilityBlockInput,
  now: Date,
): Promise<FacilityOccupancy> {
  requireModule(actor);
  if (!actorCan(actor, 'facilities.manage'))
    throw forbidden('Sperrungen dürfen nur Platzverantwortliche ändern.');
  const [block] = await db
    .select()
    .from(s.facilityBlocks)
    .where(and(eq(s.facilityBlocks.id, id), eq(s.facilityBlocks.clubId, actor.club.id)));
  if (!block) throw notFound('Die Sperrung');
  const startsAt = input.startsAt ? new Date(input.startsAt) : block.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : block.endsAt;
  if (endsAt <= startsAt)
    throw new HttpError(400, 'invalid_range', 'Das Ende muss nach dem Beginn liegen.');
  if (endsAt < now) throw new HttpError(400, 'in_past', 'Der Zeitraum liegt in der Vergangenheit.');
  const [facility] = await db
    .select()
    .from(s.facilities)
    .where(
      and(
        eq(s.facilities.id, input.facilityId ?? block.facilityId),
        eq(s.facilities.clubId, actor.club.id),
      ),
    );
  if (!facility) throw notFound('Der Platz');
  const reason = input.reason?.trim() || block.reason;
  const affected = input.cancelEvents
    ? await eventsInBlock(db, facility.id, startsAt, endsAt, now)
    : [];
  await db
    .update(s.facilityBlocks)
    .set({ facilityId: facility.id, startsAt, endsAt, reason, editedAt: now })
    .where(eq(s.facilityBlocks.id, id));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'facility.block.updated',
    entityType: 'facility_block',
    entityId: id,
    data: { facility: facility.name, reason, cancelled: affected.length },
    createdAt: now,
  });
  await cancelAffected(db, actor, facility.name, reason, affected, now);
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
