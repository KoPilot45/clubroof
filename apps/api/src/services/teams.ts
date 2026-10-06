/**
 * Team-Cockpit (Mappe S. 6–7, Konzept §4): Übersicht, Kader und Statistik einer Mannschaft.
 * Personenbezogene Details (Gründe, Quoten anderer) nur für Verantwortliche.
 */
import {
  calendarDayOf,
  resolveModule,
  toIsoDate,
  type MatchResult,
  type MyTeamCard,
  type PlayerStat,
  type RosterEntry,
  type SquadStatRow,
  type SquadStatus,
  type TeamHighlights,
  type TeamOverview,
  type TeamStats,
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
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { resolveMediaUrl } from '../storage/media-links';
import { actorCan, type Actor } from '../actor';
import { fetchEventRows, summarizeEvents } from './events';
import { loadTeamForActor, requireModule, type TeamRow } from './team-access';

const DAY = 24 * 60 * 60 * 1000;
const ABSENCE_LABELS = {
  vacation: 'Urlaub',
  injury: 'Verletzt',
  illness: 'Krank',
  school_work: 'Schule/Beruf',
  suspended: 'Gesperrt',
  other: 'Sonstiges',
} as const;

async function loadResults(
  db: Db,
  team: TeamRow,
  now: Date,
  limit?: number,
): Promise<MatchResult[]> {
  const query = db
    .select({ event: s.events, match: s.matchDetails })
    .from(s.events)
    .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
    .where(
      and(
        eq(s.events.teamId, team.id),
        eq(s.events.status, 'scheduled'),
        lt(s.events.startsAt, now),
        isNotNull(s.matchDetails.goalsFor),
        isNotNull(s.matchDetails.goalsAgainst),
      ),
    )
    .orderBy(desc(s.events.startsAt));
  const rows = limit ? await query.limit(limit) : await query;
  return rows.map(({ event, match }) => {
    const gf = match.goalsFor!;
    const ga = match.goalsAgainst!;
    return {
      eventId: event.id,
      startsAt: event.startsAt.toISOString(),
      opponentName: match.opponentName,
      isHome: match.isHome,
      goalsFor: gf,
      goalsAgainst: ga,
      outcome: gf > ga ? 'win' : gf === ga ? 'draw' : 'loss',
    };
  });
}

async function trainingRate(db: Db, team: TeamRow, now: Date): Promise<number | null> {
  const rows = await db
    .select({ status: s.eventParticipants.status, n: count() })
    .from(s.eventParticipants)
    .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
    .where(
      and(
        eq(s.events.teamId, team.id),
        eq(s.events.type, 'training'),
        eq(s.events.status, 'scheduled'),
        lt(s.events.startsAt, now),
        gte(s.events.startsAt, new Date(now.getTime() - 28 * DAY)),
        eq(s.eventParticipants.role, 'player'),
      ),
    )
    .groupBy(s.eventParticipants.status);
  const total = rows.reduce((sum, r) => sum + Number(r.n), 0);
  if (total === 0) return null;
  const yes = Number(rows.find((r) => r.status === 'yes')?.n ?? 0);
  return Math.round((yes / total) * 100);
}

function summarizeResults(results: MatchResult[], rate: number | null): TeamHighlights {
  return {
    played: results.length,
    won: results.filter((r) => r.outcome === 'win').length,
    drawn: results.filter((r) => r.outcome === 'draw').length,
    lost: results.filter((r) => r.outcome === 'loss').length,
    goalsFor: results.reduce((sum, r) => sum + r.goalsFor, 0),
    goalsAgainst: results.reduce((sum, r) => sum + r.goalsAgainst, 0),
    trainingRate: rate,
  };
}

async function squadStatus(db: Db, eventId: string): Promise<SquadStatus> {
  const rows = await db
    .select({
      status: s.eventParticipants.status,
      absent: sql<boolean>`${s.eventParticipants.absenceId} is not null`,
      n: count(),
    })
    .from(s.eventParticipants)
    .where(
      and(
        eq(s.eventParticipants.eventId, eventId),
        inArray(s.eventParticipants.role, ['player', 'guest_player']),
      ),
    )
    .groupBy(s.eventParticipants.status, sql`${s.eventParticipants.absenceId} is not null`);
  const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).reduce((acc, r) => acc + Number(r.n), 0);
  return {
    players: sum(() => true),
    available: sum((r) => r.status === 'yes' || r.status === 'maybe'),
    declined: sum((r) => r.status === 'no' && !r.absent),
    absent: sum((r) => r.status === 'no' && r.absent),
    pending: sum((r) => r.status === 'pending'),
  };
}

export async function getTeamOverview(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date,
): Promise<TeamOverview> {
  const { team, permissions } = await loadTeamForActor(db, actor, teamId);

  const [nextRows, weekRows, lastResults, allResults, rate] = await Promise.all([
    fetchEventRows(
      db,
      and(
        eq(s.events.teamId, team.id),
        eq(s.events.status, 'scheduled'),
        gt(s.events.startsAt, now),
      ),
      1,
    ),
    fetchEventRows(
      db,
      and(
        eq(s.events.teamId, team.id),
        eq(s.events.type, 'training'),
        gt(s.events.startsAt, now),
        lte(s.events.startsAt, new Date(now.getTime() + 7 * DAY)),
      ),
    ),
    loadResults(db, team, now, 3),
    loadResults(db, team, now),
    trainingRate(db, team, now),
  ]);

  const [nextEvent] = await summarizeEvents(db, actor, nextRows, now);
  const trainingWeek = await summarizeEvents(db, actor, weekRows, now);

  return {
    team: {
      id: team.id,
      name: team.name,
      badge: team.badge,
      league: team.league,
      ageGroup: team.ageGroup,
    },
    permissions,
    nextEvent: nextEvent ?? null,
    squad: nextEvent ? await squadStatus(db, nextEvent.id) : null,
    lastResults,
    trainingWeek,
    highlights: summarizeResults(allResults, rate),
  };
}

export async function getRoster(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date,
): Promise<RosterEntry[]> {
  const { team } = await loadTeamForActor(db, actor, teamId);
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));

  const members = await db
    .select({ membership: s.teamMemberships, person: s.persons })
    .from(s.teamMemberships)
    .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
    .where(
      and(
        eq(s.teamMemberships.teamId, team.id),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    )
    .orderBy(
      asc(s.teamMemberships.function),
      asc(s.teamMemberships.jerseyNumber),
      asc(s.persons.lastName),
    );

  const personIds = members.map((m) => m.person.id);
  const absences = personIds.length
    ? await db
        .select()
        .from(s.absences)
        .where(
          and(
            inArray(s.absences.personId, personIds),
            lte(s.absences.startsOn, today),
            gte(s.absences.endsOn, today),
            or(isNull(s.absences.teamIds), sql`${team.id} = any(${s.absences.teamIds})`),
          ),
        )
    : [];

  const mayReadReasons =
    actorCan(actor, 'absences.read', team) || actorCan(actor, 'attendance.override', team);

  return members.map(({ membership, person }) => {
    const absence = absences.find((a) => a.personId === person.id);
    const ownOrAllowed = mayReadReasons || actor.managedIds.includes(person.id);
    return {
      personId: person.id,
      name: `${person.firstName} ${person.lastName}`,
      function: membership.function,
      jerseyNumber: membership.jerseyNumber,
      position: person.position,
      preferredFoot: person.preferredFoot,
      unavailable: !!absence,
      unavailableReason: absence && ownOrAllowed ? ABSENCE_LABELS[absence.kind] : null,
      unavailableUntil: absence && ownOrAllowed ? absence.endsOn : null,
      avatarUrl: resolveMediaUrl(actor.links, person.avatarUrl, now),
    };
  });
}

export async function getTeamStats(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date,
): Promise<TeamStats> {
  const { team, permissions } = await loadTeamForActor(db, actor, teamId);
  requireModule(actor, 'statistics', team);
  const level = resolveModule(actor.modules, 'statistics', {
    teamId: team.id,
    orgUnitId: team.orgUnitId,
  }).level;

  const [results, rate, rows] = await Promise.all([
    loadResults(db, team, now),
    trainingRate(db, team, now),
    db
      .select({
        personId: s.eventParticipants.personId,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
        type: s.events.type,
        status: s.eventParticipants.status,
        n: count(),
      })
      .from(s.eventParticipants)
      .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
      .innerJoin(s.persons, eq(s.persons.id, s.eventParticipants.personId))
      .where(
        and(
          eq(s.events.teamId, team.id),
          eq(s.events.status, 'scheduled'),
          lt(s.events.startsAt, now),
          eq(s.eventParticipants.role, 'player'),
          inArray(s.events.type, ['training', 'match', 'tournament']),
        ),
      )
      .groupBy(
        s.eventParticipants.personId,
        s.persons.firstName,
        s.persons.lastName,
        s.events.type,
        s.eventParticipants.status,
      ),
  ]);

  const byPerson = new Map<string, PlayerStat>();
  for (const r of rows) {
    const stat =
      byPerson.get(r.personId) ??
      byPerson
        .set(r.personId, {
          personId: r.personId,
          name: `${r.firstName} ${r.lastName}`,
          trainings: 0,
          trainingsAttended: 0,
          trainingRate: null,
          matchesAttended: 0,
        })
        .get(r.personId)!;
    const n = Number(r.n);
    if (r.type === 'training') {
      stat.trainings += n;
      if (r.status === 'yes') stat.trainingsAttended += n;
    } else if (r.status === 'yes') {
      stat.matchesAttended += n;
    }
  }
  const players = [...byPerson.values()]
    .map((p) => ({
      ...p,
      trainingRate: p.trainings ? Math.round((p.trainingsAttended / p.trainings) * 100) : null,
    }))
    // Datensparsamkeit: Quoten anderer nur für Verantwortliche
    .filter((p) => permissions.readAttendance || actor.managedIds.includes(p.personId))
    .sort(
      (a, b) => (b.trainingRate ?? -1) - (a.trainingRate ?? -1) || a.name.localeCompare(b.name),
    );

  const squad = await squadTable(db, actor, team, now, byPerson, permissions.readAttendance);

  return {
    highlights: summarizeResults(results, rate),
    results,
    players,
    squad,
    showsTrainingRates: permissions.readAttendance,
    level: level === 'off' ? 'basic' : level,
  };
}

/**
 * Kader-Statistik: alle Spieler der Mannschaft mit Einsätzen (veröffentlichte Aufstellungen
 * vergangener Spiele) sowie Toren, Vorlagen und Karten aus abgeschlossenen Spielberichten.
 * Sportliche Werte sieht die ganze Mannschaft; Trainingsquoten nur das Trainerteam (bzw. die eigene).
 */
async function squadTable(
  db: Db,
  actor: Actor,
  team: TeamRow,
  now: Date,
  training: Map<string, PlayerStat>,
  showAllRates: boolean,
): Promise<SquadStatRow[]> {
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const members = await db
    .select({ membership: s.teamMemberships, person: s.persons })
    .from(s.teamMemberships)
    .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
    .where(
      and(
        eq(s.teamMemberships.teamId, team.id),
        eq(s.teamMemberships.function, 'player'),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    );
  const matchIds = (
    await db
      .select({ id: s.events.id })
      .from(s.events)
      .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
      .where(
        and(
          eq(s.events.teamId, team.id),
          eq(s.events.status, 'scheduled'),
          lt(s.events.startsAt, now),
          isNotNull(s.matchDetails.lineupPublishedAt),
        ),
      )
  ).map((r) => r.id);
  const [lineups, incidents] = matchIds.length
    ? await Promise.all([
        db
          .select({ personId: s.matchLineups.personId, role: s.matchLineups.role })
          .from(s.matchLineups)
          .where(inArray(s.matchLineups.eventId, matchIds)),
        db
          .select({ incident: s.matchIncidents })
          .from(s.matchIncidents)
          .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.matchIncidents.eventId))
          .where(
            and(
              inArray(s.matchIncidents.eventId, matchIds),
              isNotNull(s.matchDetails.reportCompletedAt),
            ),
          )
          .then((rows) => rows.map((r) => r.incident)),
      ])
    : [[], []];

  return members
    .map(({ membership, person }) => {
      const own = lineups.filter((l) => l.personId === person.id);
      const mine = (kinds: string[]) =>
        incidents.filter((i) => i.personId === person.id && kinds.includes(i.kind)).length;
      const rate = training.get(person.id);
      const visible = showAllRates || actor.managedIds.includes(person.id);
      return {
        personId: person.id,
        name: `${person.firstName} ${person.lastName}`,
        jerseyNumber: membership.jerseyNumber,
        position: person.position,
        appearances: own.length,
        starts: own.filter((l) => l.role === 'starter').length,
        goals: mine(['goal', 'penalty_goal']),
        assists: incidents.filter((i) => i.assistPersonId === person.id).length,
        yellow: mine(['yellow']),
        yellowRed: mine(['yellow_red']),
        red: mine(['red']),
        trainingRate:
          visible && rate?.trainings
            ? Math.round((rate.trainingsAttended / rate.trainings) * 100)
            : null,
      };
    })
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name));
}

/** Kennzahlen je Mannschaft, die ich verantworte (Verkaufsmappe S. 6 „Meine Teams“). */
export async function getMyTeams(db: Db, actor: Actor, now: Date): Promise<MyTeamCard[]> {
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const teams = (
    await db
      .select({ team: s.teams })
      .from(s.teams)
      .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
      .where(and(eq(s.teams.clubId, actor.club.id), eq(s.seasons.isCurrent, true)))
      .orderBy(asc(s.teams.sortOrder))
  )
    .map((r) => r.team)
    .filter((t) => actor.teamIds.includes(t.id) && actorCan(actor, 'events.manage', t));
  if (teams.length === 0) return [];
  const teamIds = teams.map((t) => t.id);

  const [members, absences, tasks] = await Promise.all([
    db
      .select({ teamId: s.teamMemberships.teamId, personId: s.teamMemberships.personId })
      .from(s.teamMemberships)
      .where(
        and(
          inArray(s.teamMemberships.teamId, teamIds),
          eq(s.teamMemberships.function, 'player'),
          lte(s.teamMemberships.validFrom, today),
          or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
        ),
      ),
    db
      .select({ personId: s.absences.personId, teamIds: s.absences.teamIds })
      .from(s.absences)
      .where(
        and(
          eq(s.absences.clubId, actor.club.id),
          lte(s.absences.startsOn, today),
          gte(s.absences.endsOn, today),
        ),
      ),
    db
      .select({ teamId: s.teamTasks.teamId, n: count() })
      .from(s.teamTasks)
      .where(and(inArray(s.teamTasks.teamId, teamIds), isNull(s.teamTasks.doneAt)))
      .groupBy(s.teamTasks.teamId),
  ]);

  return Promise.all(
    teams.map(async (team) => {
      const rows = await fetchEventRows(
        db,
        and(
          eq(s.events.teamId, team.id),
          eq(s.events.status, 'scheduled'),
          gt(s.events.startsAt, now),
        ),
        1,
      );
      const [next] = await summarizeEvents(db, actor, rows, now);
      const players = new Set(members.filter((m) => m.teamId === team.id).map((m) => m.personId));
      const absent = new Set(
        absences
          .filter((a) => players.has(a.personId) && (!a.teamIds || a.teamIds.includes(team.id)))
          .map((a) => a.personId),
      );
      return {
        team: { id: team.id, badge: team.badge, name: team.name },
        nextEvent: next
          ? {
              id: next.id,
              title: next.title,
              type: next.type,
              startsAt: next.startsAt,
              counts: next.counts,
            }
          : null,
        absentToday: absent.size,
        openTasks: Number(tasks.find((t) => t.teamId === team.id)?.n ?? 0),
      };
    }),
  );
}
