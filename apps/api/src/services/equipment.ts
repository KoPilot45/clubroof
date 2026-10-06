/**
 * Anlage & Material (optionales Modul, Konzept §6/§12): Kabinenplan, Material und Schlüssel mit
 * Ausgabe an Personen sowie Schadensmeldungen. Verwalten dürfen Platzverantwortliche
 * (`facilities.manage`); Kabinen teilen zusätzlich die Trainerteams ihren Terminen zu.
 * Schäden melden darf jedes Mitglied.
 */
import {
  addDays,
  at,
  can,
  fromIsoDate,
  type ChangingRoomPlan,
  type DamageOverview,
  type DamageReport,
  type DamageStatus,
  type EquipmentItem,
  type EquipmentOverview,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gte, ilike, inArray, lt, ne, or } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { resolveMediaUrl } from '../storage/media-links';
import { notify, recipientsFor } from './event-admin';
import { mediaReference } from './uploads';

function requireModule(actor: Actor) {
  if (!moduleEnabled(actor, 'equipment'))
    throw forbidden('„Anlage & Material“ ist im Verein nicht aktiviert.');
}
const canManage = (actor: Actor) => actorCan(actor, 'facilities.manage');
const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

// ── Kabinen ────────────────────────────────────────────────────────────────

export async function getChangingRooms(
  db: Db,
  actor: Actor,
  date: string,
): Promise<ChangingRoomPlan> {
  requireModule(actor);
  const tz = actor.club.timezone;
  const start = at(fromIsoDate(date), '00:00', tz);
  const end = at(addDays(fromIsoDate(date), 1), '00:00', tz);
  const rooms = await db
    .select({ id: s.facilities.id, name: s.facilities.name })
    .from(s.facilities)
    .where(and(eq(s.facilities.clubId, actor.club.id), eq(s.facilities.kind, 'changing_room')))
    .orderBy(asc(s.facilities.sortOrder), asc(s.facilities.name));
  const rows = await db
    .select({ event: s.events, team: s.teams, facility: s.facilities.name })
    .from(s.events)
    .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .leftJoin(s.facilities, eq(s.facilities.id, s.events.facilityId))
    .leftJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
    .where(
      and(
        eq(s.events.clubId, actor.club.id),
        eq(s.events.status, 'scheduled'),
        gte(s.events.startsAt, start),
        lt(s.events.startsAt, end),
        // Nur Termine auf der eigenen Anlage brauchen eine Kabine
        or(
          inArray(s.events.type, ['training']),
          and(eq(s.events.type, 'match'), eq(s.matchDetails.isHome, true)),
        ),
      ),
    )
    .orderBy(asc(s.events.startsAt));
  const endOf = (e: typeof s.events.$inferSelect) =>
    e.endsAt ?? new Date(e.startsAt.getTime() + 90 * 60_000);
  const events = rows.map(({ event, team, facility }) => {
    const conflict =
      !!event.changingRoomId &&
      rows.some(
        (o) =>
          o.event.id !== event.id &&
          o.event.changingRoomId === event.changingRoomId &&
          o.event.startsAt < endOf(event) &&
          event.startsAt < endOf(o.event),
      );
    return {
      id: event.id,
      title: event.title,
      badge: team?.badge ?? null,
      startsAt: event.startsAt.toISOString(),
      endsAt: endOf(event).toISOString(),
      location: facility ?? event.locationText,
      changingRoomId: event.changingRoomId,
      conflict,
    };
  });
  return { date, rooms, events, canAssign: canManage(actor) };
}

export async function assignChangingRoom(
  db: Db,
  actor: Actor,
  eventId: string,
  roomId: string | null,
  date: string,
): Promise<ChangingRoomPlan> {
  requireModule(actor);
  const [row] = await db
    .select({ event: s.events, team: s.teams })
    .from(s.events)
    .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .where(and(eq(s.events.id, eventId), eq(s.events.clubId, actor.club.id)));
  if (!row) throw notFound('Der Termin');
  const allowed = canManage(actor) || (row.team && actorCan(actor, 'events.manage', row.team));
  if (!allowed) throw forbidden('Kabinen teilen Platzverantwortliche und das Trainerteam zu.');
  if (roomId) {
    const [room] = await db
      .select({ id: s.facilities.id })
      .from(s.facilities)
      .where(
        and(
          eq(s.facilities.id, roomId),
          eq(s.facilities.clubId, actor.club.id),
          eq(s.facilities.kind, 'changing_room'),
        ),
      );
    if (!room) throw new HttpError(400, 'invalid_room', 'Unbekannte Kabine.');
  }
  await db.update(s.events).set({ changingRoomId: roomId }).where(eq(s.events.id, eventId));
  return getChangingRooms(db, actor, date);
}

// ── Material und Schlüssel ─────────────────────────────────────────────────

async function itemRows(db: Db, actor: Actor) {
  return db
    .select({
      item: s.equipmentItems,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
    })
    .from(s.equipmentItems)
    .leftJoin(s.persons, eq(s.persons.id, s.equipmentItems.holderPersonId))
    .where(eq(s.equipmentItems.clubId, actor.club.id))
    .orderBy(asc(s.equipmentItems.kind), asc(s.equipmentItems.name));
}

const toItem = (r: Awaited<ReturnType<typeof itemRows>>[number]): EquipmentItem => ({
  id: r.item.id,
  kind: r.item.kind === 'key' ? 'key' : 'material',
  name: r.item.name,
  quantity: r.item.quantity,
  location: r.item.location,
  note: r.item.note,
  holder:
    r.item.holderPersonId && r.firstName
      ? {
          personId: r.item.holderPersonId,
          name: name({ firstName: r.firstName, lastName: r.lastName! }),
        }
      : null,
  handedOutAt: r.item.handedOutAt?.toISOString() ?? null,
});

export async function getEquipment(db: Db, actor: Actor): Promise<EquipmentOverview> {
  requireModule(actor);
  const rows = await itemRows(db, actor);
  const manage = canManage(actor);
  const mine = rows.filter(
    (r) => r.item.holderPersonId && actor.managedIds.includes(r.item.holderPersonId),
  );
  return { items: manage ? rows.map(toItem) : [], mine: mine.map(toItem), canManage: manage };
}

function requireManage(actor: Actor) {
  requireModule(actor);
  if (!canManage(actor))
    throw forbidden('Material und Schlüssel verwalten die Platzverantwortlichen.');
}

export async function createItem(
  db: Db,
  actor: Actor,
  input: {
    kind: 'material' | 'key';
    name: string;
    quantity: number;
    location?: string | null;
    note?: string | null;
  },
  now: Date,
) {
  requireManage(actor);
  await db.insert(s.equipmentItems).values({
    clubId: actor.club.id,
    kind: input.kind,
    name: input.name.trim(),
    quantity: input.quantity,
    location: input.location?.trim() || null,
    note: input.note?.trim() || null,
    createdAt: now,
  });
  return getEquipment(db, actor);
}

/** Ausgeben (personId) oder zurücknehmen (null). */
export async function handOver(
  db: Db,
  actor: Actor,
  id: string,
  personId: string | null,
  now: Date,
): Promise<EquipmentOverview> {
  requireManage(actor);
  const [item] = await db
    .select()
    .from(s.equipmentItems)
    .where(and(eq(s.equipmentItems.id, id), eq(s.equipmentItems.clubId, actor.club.id)));
  if (!item) throw notFound('Der Gegenstand');
  if (personId) {
    const [person] = await db
      .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
      .from(s.persons)
      .where(
        and(
          eq(s.persons.id, personId),
          eq(s.persons.clubId, actor.club.id),
          ne(s.persons.membershipStatus, 'left'),
        ),
      );
    if (!person) throw new HttpError(400, 'invalid_person', 'Unbekanntes Mitglied.');
  }
  await db
    .update(s.equipmentItems)
    .set({ holderPersonId: personId, handedOutAt: personId ? now : null })
    .where(eq(s.equipmentItems.id, id));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: personId ? 'equipment.handed_out' : 'equipment.returned',
    entityType: 'equipment',
    entityId: id,
    data: {
      label: `${item.kind === 'key' ? 'Schlüssel' : 'Material'} ${personId ? 'ausgegeben' : 'zurück'}: ${item.name}`,
    },
    createdAt: now,
  });
  return getEquipment(db, actor);
}

export async function deleteItem(db: Db, actor: Actor, id: string) {
  requireManage(actor);
  await db
    .delete(s.equipmentItems)
    .where(and(eq(s.equipmentItems.id, id), eq(s.equipmentItems.clubId, actor.club.id)));
  return getEquipment(db, actor);
}

/** Personensuche für die Ausgabe (nur Platzverantwortliche). */
export async function searchPeople(db: Db, actor: Actor, q: string) {
  requireManage(actor);
  const term = `%${q.trim().replace(/[%_]/g, '')}%`;
  const rows = await db
    .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.persons)
    .where(
      and(
        eq(s.persons.clubId, actor.club.id),
        ne(s.persons.membershipStatus, 'left'),
        or(ilike(s.persons.firstName, term), ilike(s.persons.lastName, term)),
      ),
    )
    .orderBy(asc(s.persons.lastName))
    .limit(10);
  return rows.map((r) => ({ personId: r.id, name: name(r) }));
}

// ── Schäden ────────────────────────────────────────────────────────────────

export async function getDamages(db: Db, actor: Actor, now: Date): Promise<DamageOverview> {
  requireModule(actor);
  const manage = canManage(actor);
  const rows = await db
    .select({
      report: s.damageReports,
      facility: s.facilities.name,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
    })
    .from(s.damageReports)
    .leftJoin(s.facilities, eq(s.facilities.id, s.damageReports.facilityId))
    .leftJoin(s.persons, eq(s.persons.id, s.damageReports.reportedByPersonId))
    .where(
      and(
        eq(s.damageReports.clubId, actor.club.id),
        // Mitglieder sehen offene Meldungen (damit nichts doppelt gemeldet wird) und ihre eigenen
        manage
          ? undefined
          : or(
              ne(s.damageReports.status, 'done'),
              eq(s.damageReports.reportedByUserId, actor.user.id),
            ),
      ),
    )
    .orderBy(desc(s.damageReports.createdAt))
    .limit(100);
  const facilities = await db
    .select({ id: s.facilities.id, name: s.facilities.name })
    .from(s.facilities)
    .where(eq(s.facilities.clubId, actor.club.id))
    .orderBy(asc(s.facilities.sortOrder), asc(s.facilities.name));
  const reports: DamageReport[] = rows.map(({ report, facility, firstName, lastName }) => ({
    id: report.id,
    title: report.title,
    description: report.description,
    facility,
    imageUrl: resolveMediaUrl(actor.links, report.imageUrl, now),
    status: report.status as DamageStatus,
    resolution: report.resolution,
    reportedBy: manage && firstName ? `${firstName} ${lastName}` : null,
    mine: report.reportedByUserId === actor.user.id,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  }));
  return { reports, facilities, canManage: manage };
}

async function managerUsers(db: Db, actor: Actor) {
  const rows = await db
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
  return [
    ...new Set(
      rows.filter((r) => r.userId && can([r], 'facilities.manage', {})).map((r) => r.userId!),
    ),
  ].filter((u) => u !== actor.user.id);
}

export async function reportDamage(
  db: Db,
  actor: Actor,
  input: {
    title: string;
    description?: string | null;
    facilityId?: string | null;
    imageId?: string | null;
  },
  now: Date,
): Promise<DamageOverview> {
  requireModule(actor);
  if (input.facilityId) {
    const [f] = await db
      .select({ id: s.facilities.id })
      .from(s.facilities)
      .where(and(eq(s.facilities.id, input.facilityId), eq(s.facilities.clubId, actor.club.id)));
    if (!f) throw new HttpError(400, 'invalid_facility', 'Unbekannter Ort.');
  }
  await db.insert(s.damageReports).values({
    clubId: actor.club.id,
    facilityId: input.facilityId ?? null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    imageUrl: input.imageId ? await mediaReference(db, actor, input.imageId, 'board') : null,
    reportedByPersonId: actor.person.id,
    reportedByUserId: actor.user.id,
    createdAt: now,
    updatedAt: now,
  });
  await notify(
    db,
    actor,
    await managerUsers(db, actor),
    {
      level: 'action',
      topic: 'admin',
      title: `Schaden gemeldet: ${input.title.trim()}`,
      body: input.description?.trim() ?? null,
      link: '/equipment/damages',
    },
    now,
  );
  return getDamages(db, actor, now);
}

export async function updateDamage(
  db: Db,
  actor: Actor,
  id: string,
  input: { status: DamageStatus; resolution?: string | null },
  now: Date,
): Promise<DamageOverview> {
  requireManage(actor);
  const [report] = await db
    .select()
    .from(s.damageReports)
    .where(and(eq(s.damageReports.id, id), eq(s.damageReports.clubId, actor.club.id)));
  if (!report) throw notFound('Die Meldung');
  await db
    .update(s.damageReports)
    .set({
      status: input.status,
      resolution: input.resolution?.trim() || report.resolution,
      updatedAt: now,
    })
    .where(eq(s.damageReports.id, id));
  if (input.status !== report.status && report.reportedByPersonId) {
    const label = { open: 'offen', in_progress: 'in Arbeit', done: 'erledigt' }[input.status];
    await notify(
      db,
      actor,
      await recipientsFor(db, [report.reportedByPersonId], actor.user.id),
      {
        level: 'info',
        topic: 'news',
        title: `Deine Schadensmeldung ist ${label}`,
        body: report.title,
        link: '/equipment/damages',
      },
      now,
    );
  }
  return getDamages(db, actor, now);
}
