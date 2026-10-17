/**
 * Veranstaltungen planen (Mappe S. 8): Vereins- und Bereichsveranstaltungen wie Sommerfest,
 * Jahreshauptversammlung oder Arbeitseinsatz – mit Ablaufplan und Helferschichten.
 * Recht: `events.manage` für den Verein (Vorstand) bzw. den eigenen Bereich (Jugendleitung).
 */
import {
  can,
  scopesWith,
  type ClubEventType,
  type ClubEventForm,
  type CreateClubEventInput,
  type UpdateClubEventInput,
  type EventPlanning,
  type PlannedEvent,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden } from '../errors';
import { locationUrlFrom } from './location';
import { notify } from './event-admin';
import { usersOfPersons } from '../notify/persons';
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
    throw forbidden('Veranstaltungen plant der Vorstand bzw. die Abteilungsleitung.');
  const [facilities, events] = await Promise.all([
    db
      .select({ id: s.facilities.id, name: s.facilities.name })
      .from(s.facilities)
      .where(and(eq(s.facilities.clubId, actor.club.id), ne(s.facilities.kind, 'changing_room')))
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

/** Gezielte Einladung: Mannschaften brauchen das Trainerrecht für die Mannschaft, Personen das Mitgliederrecht. */
async function checkAudience(db: Db, actor: Actor, teamIds: string[], personIds: string[]) {
  if (teamIds.length) {
    const rows = await db
      .select({ id: s.teams.id, orgUnitId: s.teams.orgUnitId })
      .from(s.teams)
      .where(and(inArray(s.teams.id, teamIds), eq(s.teams.clubId, actor.club.id)));
    if (rows.length !== teamIds.length)
      throw new HttpError(400, 'invalid_team', 'Unbekannte Mannschaft.');
    for (const t of rows)
      if (!can(actor.grants, 'events.manage', { teamId: t.id, orgUnitId: t.orgUnitId }))
        throw forbidden('Für diese Mannschaft darfst du keine Veranstaltungen planen.');
  }
  if (personIds.length) {
    if (!actorCan(actor, 'members.read'))
      throw forbidden('Einzelne Personen einladen dürfen nur Berechtigte.');
    const rows = await db
      .select({ id: s.persons.id })
      .from(s.persons)
      .where(and(inArray(s.persons.id, personIds), eq(s.persons.clubId, actor.club.id)));
    if (rows.length !== personIds.length)
      throw new HttpError(400, 'invalid_person', 'Unbekannte Person.');
  }
}

/** Schichten müssen zur Veranstaltung passen (höchstens 12 Stunden davor oder danach) und ein Ende nach dem Beginn haben. */
function checkShifts(
  shifts: { title: string; startsAt: string; endsAt: string }[],
  startsAt: Date,
  endsAt: Date,
) {
  for (const shift of shifts) {
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
        ? 'Für diese Abteilung darfst du keine Veranstaltungen planen.'
        : 'Vereinsveranstaltungen plant der Vorstand.',
    );
  const teamIds = [...new Set(input.teamIds ?? [])];
  const personIds = [...new Set(input.personIds ?? [])];
  await checkAudience(db, actor, teamIds, personIds);
  if (input.orgUnitId) {
    const [unit] = await db
      .select({ id: s.orgUnits.id })
      .from(s.orgUnits)
      .where(and(eq(s.orgUnits.id, input.orgUnitId), eq(s.orgUnits.clubId, actor.club.id)));
    if (!unit) throw new HttpError(400, 'invalid_unit', 'Unbekannte Abteilung.');
  }
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (startsAt < now)
    throw new HttpError(400, 'in_past', 'Die Veranstaltung liegt in der Vergangenheit.');
  if (endsAt <= startsAt) throw new HttpError(400, 'invalid_end', 'Das Ende liegt vor dem Beginn.');
  checkShifts(input.shifts ?? [], startsAt, endsAt);
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
        locationUrl: input.facilityId ? null : locationUrlFrom(input.locationUrl),
        program: input.program?.length ? input.program : null,
        audience: teamIds.length || personIds.length ? { teamIds, personIds } : null,
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
  // Empfänger: gezielt Eingeladene, sonst der Bereich (oder der ganze Verein)
  const invited = teamIds.length || personIds.length;
  const recipients = invited
    ? [
        ...new Set([
          ...(
            await Promise.all(teamIds.map((id) => usersInScope(db, actor, ctx, 'team', id, now)))
          ).flat(),
          ...(await usersOfPersons(db, personIds)).filter((u) => u !== actor.user.id),
        ]),
      ]
    : await usersInScope(
        db,
        actor,
        ctx,
        input.orgUnitId ? 'org_unit' : 'club',
        input.orgUnitId ?? null,
        now,
      );
  await notify(
    db,
    actor,
    recipients,
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

const CLUB_TYPES = ['club_event', 'meeting', 'work_assignment'] as const;

/** Vereinsveranstaltung laden, die der Nutzer ändern darf: Ersteller oder Berechtigte für den Bereich. */
async function loadEditable(db: Db, actor: Actor, id: string) {
  const [event] = await db
    .select()
    .from(s.events)
    .where(and(eq(s.events.id, id), eq(s.events.clubId, actor.club.id), isNull(s.events.teamId)));
  if (!event || !(CLUB_TYPES as readonly string[]).includes(event.type))
    throw new HttpError(404, 'not_found', 'Die Veranstaltung wurde nicht gefunden.');
  const mayEdit =
    event.contactPersonId === actor.person.id ||
    can(actor.grants, 'events.manage', event.orgUnitId ? { orgUnitId: event.orgUnitId } : {});
  if (!mayEdit) throw forbidden('Diese Veranstaltung darfst du nicht ändern.');
  return event;
}

/** Formular zum Bearbeiten einer Vereinsveranstaltung (vorausgefüllt, Schichten mit Zahl der Angemeldeten). */
export async function getClubEventForm(db: Db, actor: Actor, id: string): Promise<ClubEventForm> {
  const event = await loadEditable(db, actor, id);
  const shifts = await db
    .select({
      id: s.helperShifts.id,
      title: s.helperShifts.title,
      startsAt: s.helperShifts.startsAt,
      endsAt: s.helperShifts.endsAt,
      capacity: s.helperShifts.capacity,
      signedUp: count(s.helperSignups.personId),
    })
    .from(s.helperShifts)
    .leftJoin(s.helperSignups, eq(s.helperSignups.shiftId, s.helperShifts.id))
    .where(eq(s.helperShifts.eventId, id))
    .groupBy(s.helperShifts.id)
    .orderBy(asc(s.helperShifts.startsAt), asc(s.helperShifts.title));
  return {
    id: event.id,
    type: event.type as ClubEventType,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: (event.endsAt ?? event.startsAt).toISOString(),
    orgUnitId: event.orgUnitId,
    teamIds: event.audience?.teamIds ?? [],
    personIds: event.audience?.personIds ?? [],
    facilityId: event.facilityId,
    locationText: event.locationText,
    locationUrl: event.locationUrl,
    program: event.program ?? [],
    shifts: shifts.map((x) => ({
      id: x.id,
      title: x.title,
      startsAt: x.startsAt.toISOString(),
      endsAt: x.endsAt.toISOString(),
      capacity: x.capacity,
      signedUp: Number(x.signedUp),
    })),
    editedAt: event.editedAt?.toISOString() ?? null,
  };
}

/**
 * Vereinsveranstaltung nachträglich ändern (Paket BE): alle Felder des Anlegens außer Art und Bereich, Ablaufplan und
 * Helferschichten (ändern, ergänzen, entfernen; Kapazität nicht unter der Zahl der Angemeldeten, Schichten mit
 * Angemeldeten bleiben). Wer sich angemeldet oder zugesagt hat, erfährt von geänderter Zeit oder geändertem Ort.
 */
export async function updateClubEvent(
  db: Db,
  actor: Actor,
  id: string,
  input: UpdateClubEventInput,
  now: Date,
): Promise<ClubEventForm> {
  const event = await loadEditable(db, actor, id);
  if (event.status === 'cancelled')
    throw new HttpError(409, 'cancelled', 'Eine abgesagte Veranstaltung lässt sich nicht ändern.');
  const end = event.endsAt ?? event.startsAt;
  if (end < now)
    throw new HttpError(409, 'past', 'Eine vergangene Veranstaltung lässt sich nicht mehr ändern.');

  const startsAt = input.startsAt ? new Date(input.startsAt) : event.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : end;
  if (endsAt <= startsAt) throw new HttpError(400, 'invalid_end', 'Das Ende liegt vor dem Beginn.');
  if ((input.startsAt || input.endsAt) && startsAt < now && input.startsAt)
    throw new HttpError(400, 'in_past', 'Die Veranstaltung liegt in der Vergangenheit.');

  let audience = event.audience;
  if (input.teamIds !== undefined || input.personIds !== undefined) {
    const teamIds = [...new Set(input.teamIds ?? event.audience?.teamIds ?? [])];
    const personIds = [...new Set(input.personIds ?? event.audience?.personIds ?? [])];
    await checkAudience(db, actor, teamIds, personIds);
    audience = teamIds.length || personIds.length ? { teamIds, personIds } : null;
  }

  const facilityId = input.facilityId === undefined ? event.facilityId : input.facilityId;
  if (facilityId && (facilityId !== event.facilityId || input.startsAt || input.endsAt)) {
    const [facility] = await db
      .select({ id: s.facilities.id })
      .from(s.facilities)
      .where(and(eq(s.facilities.id, facilityId), eq(s.facilities.clubId, actor.club.id)));
    if (!facility) throw new HttpError(400, 'invalid_facility', 'Unbekannter Platz.');
    await assertFacilityFree(
      db,
      actor,
      facilityId,
      startsAt,
      endsAt,
      input.allowConflict === true,
      id,
    );
  }

  // Schichten: Zahl der Angemeldeten je Schicht prüfen
  const current = await db
    .select({
      shift: s.helperShifts,
      signedUp: count(s.helperSignups.personId),
    })
    .from(s.helperShifts)
    .leftJoin(s.helperSignups, eq(s.helperSignups.shiftId, s.helperShifts.id))
    .where(eq(s.helperShifts.eventId, id))
    .groupBy(s.helperShifts.id);
  const wanted = input.shifts;
  if (wanted) {
    checkShifts(wanted, startsAt, endsAt);
    for (const x of wanted) {
      if (!x.id) continue;
      const own = current.find((c) => c.shift.id === x.id);
      if (!own) throw new HttpError(400, 'invalid_shift', 'Unbekannte Schicht.');
      if (x.capacity < Number(own.signedUp))
        throw new HttpError(
          409,
          'capacity',
          `Schicht „${x.title}“: Es haben sich schon ${own.signedUp} Helfer eingetragen, die Zahl der Plätze kann nicht darunter sinken.`,
        );
    }
    for (const c of current)
      if (!wanted.some((x) => x.id === c.shift.id) && Number(c.signedUp) > 0)
        throw new HttpError(
          409,
          'shift_in_use',
          `Schicht „${c.shift.title}“ kann nicht entfernt werden: Es haben sich schon Helfer eingetragen.`,
        );
  }

  const timeChanged =
    startsAt.getTime() !== event.startsAt.getTime() || endsAt.getTime() !== end.getTime();
  const placeChanged =
    (input.facilityId !== undefined && input.facilityId !== event.facilityId) ||
    (input.locationText !== undefined &&
      (input.locationText?.trim() || null) !== event.locationText);

  await db.transaction(async (tx) => {
    await tx
      .update(s.events)
      .set({
        title: input.title === undefined ? event.title : input.title.trim(),
        description:
          input.description === undefined ? event.description : input.description?.trim() || null,
        startsAt,
        endsAt,
        facilityId,
        locationText: facilityId
          ? null
          : input.locationText === undefined
            ? event.locationText
            : input.locationText?.trim() || null,
        locationUrl: facilityId
          ? null
          : input.locationUrl === undefined
            ? event.locationUrl
            : locationUrlFrom(input.locationUrl),
        program:
          input.program === undefined ? event.program : input.program.length ? input.program : null,
        audience,
        editedAt: now,
      })
      .where(eq(s.events.id, id));
    if (wanted) {
      for (const x of wanted) {
        const values = {
          title: x.title.trim(),
          startsAt: new Date(x.startsAt),
          endsAt: new Date(x.endsAt),
          capacity: x.capacity,
        };
        if (x.id) await tx.update(s.helperShifts).set(values).where(eq(s.helperShifts.id, x.id));
        else
          await tx.insert(s.helperShifts).values({ clubId: actor.club.id, eventId: id, ...values });
      }
      const removed = current
        .filter((c) => !wanted.some((x) => x.id === c.shift.id))
        .map((c) => c.shift.id);
      if (removed.length)
        await tx.delete(s.helperShifts).where(inArray(s.helperShifts.id, removed));
    }
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'event.edited',
      entityType: 'event',
      entityId: id,
      data: {
        label: `${TYPE_LABELS[event.type as ClubEventType]} geändert: ${input.title?.trim() ?? event.title}`,
        fields: Object.keys(input),
      },
      createdAt: now,
    });
  });

  // Wichtige Änderungen (Zeit, Ort) an alle, die zugesagt haben oder als Helfer eingetragen sind
  if (timeChanged || placeChanged) {
    const attendees = await db
      .select({ personId: s.eventParticipants.personId })
      .from(s.eventParticipants)
      .where(
        and(
          eq(s.eventParticipants.eventId, id),
          eq(s.eventParticipants.role, 'attendee'),
          ne(s.eventParticipants.status, 'no'),
        ),
      );
    const helpers = await db
      .select({ personId: s.helperSignups.personId })
      .from(s.helperSignups)
      .innerJoin(s.helperShifts, eq(s.helperShifts.id, s.helperSignups.shiftId))
      .where(eq(s.helperShifts.eventId, id));
    const recipients = (
      await usersOfPersons(db, [
        ...new Set([...attendees.map((a) => a.personId), ...helpers.map((h) => h.personId)]),
      ])
    ).filter((u) => u !== actor.user.id);
    await notify(
      db,
      actor,
      recipients,
      {
        level: 'action',
        topic: 'events',
        title: `Geändert: ${input.title?.trim() ?? event.title}`,
        body: timeChanged ? 'Die Zeit wurde geändert.' : 'Der Ort wurde geändert.',
        link: `/events/${id}`,
      },
      now,
    );
  }
  return getClubEventForm(db, actor, id);
}
