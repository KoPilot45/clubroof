/**
 * Termine: Laden, Zusammenfassen und Rückmelden. Enthält die Regeln, wer einen Termin sehen,
 * die Teilnehmerliste einsehen und für wen zu- oder absagen darf.
 */
import {
  can,
  calendarDayOf,
  isResponseOpen,
  toIsoDate,
  responseDeadline,
  type AttendanceCounts,
  type AttendanceStatus,
  type ClubSeason,
  type DeadlineRule,
  type EventDetail,
  type EventSummary,
  type MyResponse,
  type Participant,
  type EventChange,
  type MatchKind,
  buildRouteUrl,
  ATTENDANCE_CORRECTION_DAYS,
  toAttendanceVisibility,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { actorCan, isFullAdmin, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { coachUsers, digestAt } from '../notify/coaches';
import { deliver } from '../notify/deliver';
import { carpoolFor } from './carpool';
import { OPEN_EVENT_TYPES, attendanceFor, shiftsFor } from './helpers';
import { resolveMediaUrl } from '../storage/media-links';

/** Wie lange Trainer Rückmeldungen nach Terminbeginn noch korrigieren dürfen. */
const OVERRIDE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type EventRow = Awaited<ReturnType<typeof fetchEventRows>>[number];

export async function fetchEventRows(
  db: Db,
  where: SQL | undefined,
  limit?: number,
  order: 'asc' | 'desc' = 'asc',
) {
  const query = db
    .select({
      event: s.events,
      team: {
        id: s.teams.id,
        name: s.teams.name,
        badge: s.teams.badge,
        orgUnitId: s.teams.orgUnitId,
        participationMode: s.teams.participationMode,
        attendanceVisibility: s.teams.attendanceVisibility,
        responsesVisible: s.teams.responsesVisible,
        allowMaybe: s.teams.allowMaybe,
        declineReasonRequired: s.teams.declineReasonRequired,
        absenceReasonsVisibleTo: s.teams.absenceReasonsVisibleTo,
      },
      facilityName: s.facilities.name,
      match: s.matchDetails,
    })
    .from(s.events)
    .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .leftJoin(s.facilities, eq(s.facilities.id, s.events.facilityId))
    .leftJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
    .where(where)
    .orderBy(order === 'asc' ? asc(s.events.startsAt) : desc(s.events.startsAt));
  return limit ? query.limit(limit) : query;
}

function isTeamMember(actor: Actor, teamId: string | null): boolean {
  return teamId !== null && actor.teamIds.includes(teamId);
}

/**
 * Zu- und Absage-Übersicht (Zahlen, Teilnehmerliste): das Trainerteam immer, Spieler und Eltern nur, wenn die
 * Mannschaft sie freigibt (`responsesVisible`). Der Server liefert sie sonst nicht aus.
 */
function mayOverview(actor: Actor, row: EventRow): boolean {
  return (
    row.team !== null &&
    (row.team.responsesVisible ||
      actorCan(actor, 'attendance.read', row.team) ||
      canOverride(actor, row))
  );
}

/** Saisons des Vereins, neueste zuerst (für die Zeitraum-Auswahl im Archiv). */
export async function listSeasons(db: Db, actor: Actor): Promise<ClubSeason[]> {
  const rows = await db
    .select()
    .from(s.seasons)
    .where(eq(s.seasons.clubId, actor.club.id))
    .orderBy(desc(s.seasons.startsOn));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    isCurrent: r.isCurrent,
  }));
}

/**
 * Vergangene Termine zum Rückwärts-Blättern („Archiv“): neueste zuerst, Sichtbarkeit wie bei „Meine Termine“.
 * `before` ist exklusiv (Beginn des ältesten bereits geladenen Termins), `after` inklusiv.
 */
export async function listPastEvents(
  db: Db,
  actor: Actor,
  q: {
    before: Date;
    after?: Date;
    limit: number;
    teamId?: string;
    kind?: 'match' | 'training' | 'club';
  },
  now: Date,
): Promise<EventSummary[]> {
  // Nie über „jetzt“ hinaus: das Archiv zeigt nur Beginnzeiten in der Vergangenheit
  const before = q.before > now ? now : q.before;
  const rows = await fetchEventRows(
    db,
    and(
      eq(s.events.clubId, actor.club.id),
      lt(s.events.startsAt, before),
      q.after ? gte(s.events.startsAt, q.after) : undefined,
      q.teamId ? eq(s.events.teamId, q.teamId) : undefined,
      q.kind === 'match'
        ? inArray(s.events.type, ['match', 'tournament'])
        : q.kind === 'training'
          ? eq(s.events.type, 'training')
          : q.kind === 'club'
            ? isNull(s.events.teamId)
            : undefined,
      or(
        isNull(s.events.teamId),
        inArray(
          s.events.id,
          sql`(select ${s.eventParticipants.eventId} from ${s.eventParticipants} where ${inArray(
            s.eventParticipants.personId,
            actor.managedIds,
          )})`,
        ),
      ),
    ),
    q.limit,
    'desc',
  );
  return summarizeEvents(db, actor, rows, now);
}

export function canOverride(actor: Actor, row: EventRow): boolean {
  return row.team !== null && actorCan(actor, 'attendance.override', row.team);
}

/** Baut die Zusammenfassungen für mehrere Termine mit möglichst wenigen Abfragen. */
export async function summarizeEvents(
  db: Db,
  actor: Actor,
  rows: EventRow[],
  now: Date,
): Promise<EventSummary[]> {
  if (rows.length === 0) return [];
  const eventIds = rows.map((r) => r.event.id);
  const teamIds = [...new Set(rows.map((r) => r.team?.id).filter((id): id is string => !!id))];

  // Erfasste Anwesenheit vergangener Termine (nur wo erfasst): Anzahl da / Teilnehmer
  const recordedIds = rows
    .filter((r) => r.event.attendanceRecordedAt && r.event.status === 'scheduled')
    .map((r) => r.event.id);
  const [presenceRows, countRows, mine, rules] = await Promise.all([
    recordedIds.length
      ? db
          .select({
            eventId: s.eventParticipants.eventId,
            total: count(),
            present: sql<number>`count(*) filter (where ${s.eventParticipants.attended} is true)`,
          })
          .from(s.eventParticipants)
          .where(
            and(
              inArray(s.eventParticipants.eventId, recordedIds),
              ne(s.eventParticipants.role, 'coach'),
            ),
          )
          .groupBy(s.eventParticipants.eventId)
      : Promise.resolve([] as { eventId: string; total: number; present: number }[]),
    db
      .select({
        eventId: s.eventParticipants.eventId,
        status: s.eventParticipants.status,
        n: count(),
      })
      .from(s.eventParticipants)
      .where(
        and(inArray(s.eventParticipants.eventId, eventIds), ne(s.eventParticipants.role, 'coach')),
      )
      .groupBy(s.eventParticipants.eventId, s.eventParticipants.status),
    db
      .select()
      .from(s.eventParticipants)
      .where(
        and(
          inArray(s.eventParticipants.eventId, eventIds),
          inArray(s.eventParticipants.personId, actor.managedIds),
        ),
      ),
    teamIds.length
      ? db.select().from(s.teamDeadlineRules).where(inArray(s.teamDeadlineRules.teamId, teamIds))
      : Promise.resolve([] as (typeof s.teamDeadlineRules.$inferSelect)[]),
  ]);

  return rows.map((row) => {
    const { event } = row;
    const allCounts: AttendanceCounts = { yes: 0, no: 0, maybe: 0, pending: 0 };
    for (const c of countRows) if (c.eventId === event.id) allCounts[c.status] = Number(c.n);
    // Ohne Mannschaft (Vereinstermin) gibt es keine Übersicht; sonst nach Freigabe der Mannschaft
    const counts = row.team ? (mayOverview(actor, row) ? allCounts : null) : allCounts;

    const rule = rules.find((r) => r.teamId === event.teamId && r.eventType === event.type);
    const deadline = responseDeadline(event.startsAt, toDeadlineRule(rule), actor.club.timezone);

    const regularOpen =
      event.status === 'scheduled' && isResponseOpen(now, event.startsAt, deadline);
    const overrideOpen =
      event.status === 'scheduled' &&
      canOverride(actor, row) &&
      now.getTime() < event.startsAt.getTime() + OVERRIDE_WINDOW_MS;

    const myResponses: MyResponse[] = mine
      .filter((p) => p.eventId === event.id && p.role !== 'attendee')
      .map((p) => {
        const person = actor.managed.find((m) => m.id === p.personId)!;
        return {
          personId: p.personId,
          firstName: person.firstName,
          relation: person.relation,
          role: p.role as MyResponse['role'],
          status: p.status,
          reason: p.reason,
          canRespond: regularOpen || overrideOpen,
          // bewusste Antworten tragen einen Zeitstempel und keine Abwesenheits-Verknüpfung (siehe participation.ts)
          automatic: p.respondedAt === null && p.absenceId === null && p.status !== 'pending',
          absent: p.absenceId !== null,
        };
      })
      .sort((a, b) => Number(a.relation === 'child') - Number(b.relation === 'child'));

    return {
      id: event.id,
      type: event.type,
      status: event.status,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      meetingAt: event.meetingAt?.toISOString() ?? null,
      meetingPoint: event.meetingPoint,
      location: row.facilityName ?? event.locationText,
      routeUrl: buildRouteUrl(event.locationUrl, row.facilityName ? null : event.locationText),
      cancelledReason: event.cancelledReason,
      team: row.team ? { id: row.team.id, name: row.team.name, badge: row.team.badge } : null,
      match: row.match
        ? {
            opponentName: row.match.opponentName,
            isHome: row.match.isHome,
            competition: row.match.competition,
            kind: row.match.kind as MatchKind,
            goalsFor: row.match.goalsFor,
            goalsAgainst: row.match.goalsAgainst,
          }
        : null,
      deadline: deadline?.toISOString() ?? null,
      responseRules: {
        allowMaybe: row.team?.allowMaybe ?? true,
        declineReasonRequired: row.team?.declineReasonRequired ?? false,
      },
      counts,
      myResponses,
      presence: presenceFor(
        actor,
        row,
        presenceRows.find((p) => p.eventId === event.id),
      ),
    };
  });
}

/**
 * „14 von 20 da“: Das Trainerteam sieht die erfasste Anwesenheit immer; Mitglieder der Mannschaft (und
 * Eltern) je nach Einstellung der Mannschaft (Standard: nur die Anzahl).
 */
function presenceFor(
  actor: Actor,
  row: EventRow,
  p: { total: number; present: number } | undefined,
): EventSummary['presence'] {
  if (!p || !row.team) return null;
  const staff = actorCan(actor, 'attendance.read', row.team) || canOverride(actor, row);
  const visibility = toAttendanceVisibility(row.team.attendanceVisibility);
  if (!staff && visibility === 'staff') return null;
  if (!staff && !isTeamMember(actor, row.team.id)) return null;
  return { present: Number(p.present), total: Number(p.total) };
}

export function toDeadlineRule(
  rule: typeof s.teamDeadlineRules.$inferSelect | undefined,
): DeadlineRule | null {
  if (!rule) return null;
  if (rule.kind === 'relative' && rule.minutesBefore !== null) {
    return { kind: 'relative', minutesBefore: rule.minutesBefore };
  }
  if (rule.kind === 'weekday_time' && rule.weekday !== null && rule.timeOfDay) {
    return { kind: 'weekday_time', weekday: rule.weekday, timeOfDay: rule.timeOfDay };
  }
  return null;
}

export async function loadVisibleEvent(db: Db, actor: Actor, eventId: string): Promise<EventRow> {
  const [row] = await fetchEventRows(
    db,
    and(eq(s.events.id, eventId), eq(s.events.clubId, actor.club.id)),
  );
  if (!row) throw notFound('Der Termin');

  if (row.team) {
    const [ownParticipation] = await db
      .select({ id: s.eventParticipants.id })
      .from(s.eventParticipants)
      .where(
        and(
          eq(s.eventParticipants.eventId, eventId),
          inArray(s.eventParticipants.personId, actor.managedIds),
        ),
      )
      .limit(1);
    const visible =
      isTeamMember(actor, row.team.id) ||
      !!ownParticipation ||
      actorCan(actor, 'events.manage', row.team) ||
      actorCan(actor, 'attendance.read', row.team);
    // Nicht sichtbare Termine werden wie nicht vorhandene behandelt.
    if (!visible) throw notFound('Der Termin');
  }
  return row;
}

export async function getEventDetail(
  db: Db,
  actor: Actor,
  eventId: string,
  now: Date,
): Promise<EventDetail> {
  const row = await loadVisibleEvent(db, actor, eventId);
  const [summary] = await summarizeEvents(db, actor, [row], now);

  const mayReadAttendance = row.team !== null && actorCan(actor, 'attendance.read', row.team);
  const mayReadReasons =
    row.team !== null &&
    (actorCan(actor, 'absences.read', row.team) ||
      actorCan(actor, 'attendance.override', row.team) ||
      // Einstellung der Mannschaft: Gründe für die ganze Mannschaft sichtbar
      (row.team.absenceReasonsVisibleTo === 'team' && isTeamMember(actor, row.team.id)));
  // Teilnehmerliste: Mitglieder der Mannschaft nur mit freigegebener Übersicht, das Trainerteam immer
  const seesList =
    row.team !== null &&
    (mayReadAttendance || (isTeamMember(actor, row.team.id) && mayOverview(actor, row)));
  const namedVisible =
    row.team !== null && toAttendanceVisibility(row.team.attendanceVisibility) === 'named';

  let participants: Participant[] = [];
  if (seesList) {
    const guestTeams = s.teams;
    const rows = await db
      .select({
        personId: s.eventParticipants.personId,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
        role: s.eventParticipants.role,
        status: s.eventParticipants.status,
        reason: s.eventParticipants.reason,
        guestFromTeam: guestTeams.badge,
        attended: s.eventParticipants.attended,
        avatar: s.persons.avatarUrl,
        absenceId: s.eventParticipants.absenceId,
        absenceKind: s.absences.kind,
        absenceEnd: s.absences.endsOn,
      })
      .from(s.eventParticipants)
      .innerJoin(s.persons, eq(s.persons.id, s.eventParticipants.personId))
      .leftJoin(s.absences, eq(s.absences.id, s.eventParticipants.absenceId))
      .leftJoin(guestTeams, eq(guestTeams.id, s.eventParticipants.guestFromTeamId))
      .where(eq(s.eventParticipants.eventId, eventId))
      .orderBy(asc(s.persons.lastName), asc(s.persons.firstName));

    // Rückennummern der Saison (Modul „Rückennummern“), nur aktuelle Mitgliedschaften der Mannschaft
    const numbers = new Map<string, number>();
    if (row.team && moduleEnabled(actor, 'jersey_numbers', row.team)) {
      const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
      const memberships = await db
        .select({ personId: s.teamMemberships.personId, n: s.teamMemberships.jerseyNumber })
        .from(s.teamMemberships)
        .where(
          and(
            eq(s.teamMemberships.teamId, row.team.id),
            or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
          ),
        );
      for (const m of memberships) if (m.n !== null) numbers.set(m.personId, m.n);
    }

    participants = rows.map((p) => ({
      personId: p.personId,
      name: `${p.firstName} ${p.lastName}`,
      role: p.role,
      status: p.status,
      // Gründe (z. B. Verletzung) sehen nur Verantwortliche und die Person selbst.
      reason: mayReadReasons || actor.managedIds.includes(p.personId) ? p.reason : null,
      guestFromTeam: p.guestFromTeam,
      avatarUrl: resolveMediaUrl(actor.links, p.avatar, now),
      // Wer da war, sehen Spieler nur, wenn die Mannschaft es namentlich freigibt
      attended:
        row.event.attendanceRecordedAt && (mayReadAttendance || namedVisible)
          ? p.attended === true
          : null,
      // Wer ausfällt, steht im Kader getrennt von den Absagen; Art und Ende nur für das Trainerteam
      jerseyNumber: numbers.get(p.personId) ?? null,
      absent: p.status === 'no' && p.absenceId !== null,
      absence:
        mayReadReasons && p.status === 'no' && p.absenceId !== null && p.absenceKind && p.absenceEnd
          ? { kind: p.absenceKind, endsOn: p.absenceEnd }
          : null,
    }));
  }

  let contactPerson: EventDetail['contactPerson'] = null;
  if (row.event.contactPersonId) {
    const [c] = await db
      .select({ firstName: s.persons.firstName, lastName: s.persons.lastName })
      .from(s.persons)
      .where(eq(s.persons.id, row.event.contactPersonId));
    if (c) contactPerson = { name: `${c.firstName} ${c.lastName}` };
  }

  // Gezielt eingeladene Mannschaften (Kürzel) und Zahl der Personen
  const audience = row.event.audience;
  const invitedBadges = audience?.teamIds.length
    ? (
        await db
          .select({ badge: s.teams.badge })
          .from(s.teams)
          .where(inArray(s.teams.id, audience.teamIds))
      ).map((t) => t.badge)
    : [];

  return {
    ...summary!,
    description: row.event.description,
    invited: audience ? { teams: invitedBadges.sort(), persons: audience.personIds.length } : null,
    contactPerson,
    participants,
    canManage: row.team !== null && actorCan(actor, 'events.manage', row.team),
    canEditClubEvent:
      row.team === null &&
      ['club_event', 'meeting', 'work_assignment'].includes(row.event.type) &&
      row.event.status === 'scheduled' &&
      (row.event.contactPersonId === actor.person.id ||
        can(
          actor.grants,
          'events.manage',
          row.event.orgUnitId ? { orgUnitId: row.event.orgUnitId } : {},
        )),
    editedAt: row.event.editedAt?.toISOString() ?? null,
    canOverride: canOverride(actor, row),
    program: row.event.program ?? [],
    carpool: await carpoolFor(db, actor, row, now),
    attendanceCheck:
      row.team !== null && row.event.status === 'scheduled'
        ? {
            recordedAt: row.event.attendanceRecordedAt?.toISOString() ?? null,
            canRecord:
              canOverride(actor, row) &&
              row.event.startsAt <= now &&
              (now <= correctionEnd(row.event.startsAt) || isFullAdmin(actor)),
            correctionUntil: correctionEnd(row.event.startsAt).toISOString(),
          }
        : null,
    attendance:
      row.team === null && (OPEN_EVENT_TYPES as readonly string[]).includes(row.event.type)
        ? await attendanceFor(db, actor, row.event.id)
        : null,
    shifts: (await shiftsFor(db, actor, [row.event.id])).get(row.event.id) ?? [],
    lastChange: await lastChangeOf(db, actor, eventId, now),
    edit:
      row.team !== null && actorCan(actor, 'events.manage', row.team)
        ? {
            facilityId: row.event.facilityId,
            locationText: row.event.locationText,
            locationUrl: row.event.locationUrl,
            seriesFollowing: row.event.seriesId
              ? await db
                  .select({ n: count() })
                  .from(s.events)
                  .where(
                    and(
                      eq(s.events.seriesId, row.event.seriesId),
                      eq(s.events.status, 'scheduled'),
                      gt(s.events.startsAt, row.event.startsAt),
                    ),
                  )
                  .then((r) => Number(r[0]?.n ?? 0))
              : 0,
          }
        : null,
  };
}

/** Ende der Korrekturfrist für die Anwesenheit (danach nur die Verwaltung). */
function correctionEnd(startsAt: Date): Date {
  return new Date(startsAt.getTime() + ATTENDANCE_CORRECTION_DAYS * 24 * 60 * 60 * 1000);
}

const CHANGE_RELEVANT_MS = 14 * 24 * 60 * 60 * 1000;

async function lastChangeOf(
  db: Db,
  actor: Actor,
  eventId: string,
  now: Date,
): Promise<EventDetail['lastChange']> {
  const [entry] = await db
    .select()
    .from(s.auditLog)
    .where(
      and(
        eq(s.auditLog.clubId, actor.club.id),
        eq(s.auditLog.entityId, eventId),
        eq(s.auditLog.action, 'event.updated'),
        gt(s.auditLog.createdAt, new Date(now.getTime() - CHANGE_RELEVANT_MS)),
      ),
    )
    .orderBy(desc(s.auditLog.createdAt))
    .limit(1);
  const items = (entry?.data?.changes ?? []) as EventChange[];
  return entry && items.length ? { at: entry.createdAt.toISOString(), items } : null;
}

/**
 * Anwesenheit nach dem Termin erfassen: `present` sind die Personen, die wirklich da waren.
 * Danach zählt für die Trainingsquote die Anwesenheit statt der Zusage.
 */
export async function recordAttendance(
  db: Db,
  actor: Actor,
  eventId: string,
  present: string[],
  now: Date,
): Promise<EventDetail> {
  const row = await loadVisibleEvent(db, actor, eventId);
  if (!canOverride(actor, row)) {
    throw forbidden('Die Anwesenheit erfasst das Trainerteam.');
  }
  if (row.event.status !== 'scheduled') {
    throw new HttpError(409, 'event_cancelled', 'Der Termin wurde abgesagt.');
  }
  if (row.event.startsAt > now) {
    throw new HttpError(409, 'not_started', 'Die Anwesenheit lässt sich erst ab Beginn erfassen.');
  }
  // Nach der Korrekturfrist ändert nur noch die Verwaltung – mit eigenem Eintrag im Änderungsprotokoll
  const late = now > correctionEnd(row.event.startsAt);
  if (late && !isFullAdmin(actor)) {
    throw forbidden(
      `Die Frist für Korrekturen (${ATTENDANCE_CORRECTION_DAYS} Tage) ist abgelaufen. Die Anwesenheit ändert jetzt nur noch der Admin.`,
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .update(s.eventParticipants)
      .set({ attended: false })
      .where(and(eq(s.eventParticipants.eventId, eventId), ne(s.eventParticipants.role, 'coach')));
    if (present.length) {
      await tx
        .update(s.eventParticipants)
        .set({ attended: true })
        .where(
          and(
            eq(s.eventParticipants.eventId, eventId),
            inArray(s.eventParticipants.personId, present),
          ),
        );
    }
    await tx.update(s.events).set({ attendanceRecordedAt: now }).where(eq(s.events.id, eventId));
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: late ? 'attendance.corrected_late' : 'attendance.recorded',
      entityType: 'event',
      entityId: eventId,
      data: { present: present.length, ...(late ? { late: true } : null) },
    });
  });
  return getEventDetail(db, actor, eventId, now);
}

/** Zu-/Absage für sich selbst, ein Kind oder (mit Trainerrechten) stellvertretend. */
export async function respondToEvent(
  db: Db,
  actor: Actor,
  input: {
    eventId: string;
    personId: string;
    /** „pending“ nimmt die Antwort zurück („Rückgängig“ in der App) */
    status: AttendanceStatus;
    reason?: string | null;
  },
  now: Date,
): Promise<EventSummary> {
  const row = await loadVisibleEvent(db, actor, input.eventId);
  const isOwn = actor.managedIds.includes(input.personId);
  const override = canOverride(actor, row);
  if (!isOwn && !override) throw forbidden('Du kannst nur für dich oder deine Kinder antworten.');

  const [participant] = await db
    .select()
    .from(s.eventParticipants)
    .where(
      and(
        eq(s.eventParticipants.eventId, input.eventId),
        eq(s.eventParticipants.personId, input.personId),
      ),
    );
  if (!participant) throw notFound('Die Teilnahme');

  if (row.event.status === 'cancelled') {
    throw new HttpError(409, 'event_cancelled', 'Der Termin wurde abgesagt.');
  }

  const [summary] = await summarizeEvents(db, actor, [row], now);
  const deadline = summary!.deadline ? new Date(summary!.deadline) : null;
  const regularOpen = isResponseOpen(now, row.event.startsAt, deadline);
  const overrideOpen =
    override && now.getTime() < row.event.startsAt.getTime() + OVERRIDE_WINDOW_MS;

  if (!regularOpen && !overrideOpen) {
    throw new HttpError(
      409,
      'deadline_passed',
      'Die Frist für Zu- und Absagen ist abgelaufen. Bitte wende dich an dein Trainerteam.',
    );
  }

  // Antwortregeln der Mannschaft (Paket E2); das Trainerteam darf stellvertretend immer eintragen
  if (isOwn && !override) {
    if (input.status === 'maybe' && row.team && !row.team.allowMaybe)
      throw new HttpError(
        400,
        'maybe_off',
        'Diese Mannschaft kennt „Unsicher“ nicht. Bitte sage zu oder ab.',
      );
    if (input.status === 'no' && row.team?.declineReasonRequired && !input.reason?.trim())
      throw new HttpError(400, 'reason_required', 'Bitte gib einen Grund für die Absage an.');
  }

  await db
    .update(s.eventParticipants)
    .set({
      status: input.status,
      reason:
        input.status === 'yes' || input.status === 'pending' ? null : input.reason?.trim() || null,
      respondedAt: input.status === 'pending' ? null : now,
      respondedByPersonId: actor.person.id,
      // Eine bewusste Antwort löst die Verknüpfung zur Abwesenheit
      absenceId: null,
    })
    .where(eq(s.eventParticipants.id, participant.id));

  if (!isOwn || !regularOpen) {
    await db.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'attendance.overridden',
      entityType: 'event_participant',
      entityId: participant.id,
      data: { eventId: input.eventId, personId: input.personId, status: input.status },
    });
  }

  // Nach dem Sammelhinweis erfährt das Trainerteam kurzfristige Absagen einzeln
  if (
    input.status === 'no' &&
    participant.status !== 'no' &&
    participant.role === 'player' &&
    isOwn &&
    row.team &&
    now >= digestAt(row.event.startsAt, deadline)
  ) {
    const person = actor.managed.find((m) => m.id === input.personId)!;
    const coaches = await coachUsers(
      db,
      row.team.id,
      toIsoDate(calendarDayOf(now, actor.club.timezone)),
    );
    await deliver(
      db,
      actor.club,
      coaches.filter((id) => id !== actor.user.id),
      {
        level: 'important',
        topic: 'responses',
        teamId: row.team.id,
        title: `Kurzfristige Absage: ${person.firstName} ${person.lastName}`,
        body: `${row.event.title}${input.reason?.trim() ? ` – ${input.reason.trim()}` : ''}`,
        link: `/events/${row.event.id}`,
      },
      now,
    );
  }

  const [updated] = await summarizeEvents(db, actor, [row], now);
  return updated!;
}
