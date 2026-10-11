/**
 * Bereichsübersicht für Sportliche Leitung, Jugendleitung und Vorstand (Paket BU): eine reine Übersicht über
 * Mannschaften mit Kader, Trainerteam, Trainingsbeteiligung und nächstem Spiel – kein Zugriff in die Mannschaft.
 * Keine Absagegründe, keine Kasse, keine Anwesenheitslisten.
 */
import {
  AREA_KEYS,
  addDays,
  at,
  calendarDayOf,
  participationLevel,
  toIsoDate,
  type AreaAccess,
  type AreaKey,
  type AreaOverview,
  type AreaTeamCard,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { Actor } from '../actor';
import { forbidden } from '../errors';

const DAY = 24 * 60 * 60 * 1000;

/** Rollen mit Blick auf die Bereiche; Vorstand, Sportliche Leitung und Admin gelten für den ganzen Verein. */
const CLUB_WIDE = new Set(['fulladmin', 'board', 'sports_director']);
const AREA_ROLES = new Set([...CLUB_WIDE, 'youth_director']);

export const areaOf = (kind: string): AreaKey =>
  kind === 'women' ? 'women' : kind === 'youth' ? 'youth' : 'seniors';

/** Bereiche (Organisationseinheiten), die die Person sehen darf; null ohne Zugriff. */
async function allowedUnits(db: Db, actor: Actor) {
  const grants = actor.grants.filter((g) => AREA_ROLES.has(g.key));
  if (grants.length === 0) return null;
  const units = await db.select().from(s.orgUnits).where(eq(s.orgUnits.clubId, actor.club.id));
  const wide = grants.some((g) => CLUB_WIDE.has(g.key) && g.scopeType === 'club');
  const direct = new Set(
    grants.filter((g) => g.scopeType === 'org_unit' && g.scopeId).map((g) => g.scopeId!),
  );
  // Unterbereiche gehören dazu
  const inScope = (id: string): boolean => {
    if (wide || direct.has(id)) return true;
    const parent = units.find((u) => u.id === id)?.parentId;
    return parent ? inScope(parent) : false;
  };
  const allowed = units.filter((u) => inScope(u.id));
  return allowed.length ? allowed : null;
}

export async function areaAccess(db: Db, actor: Actor): Promise<AreaAccess | null> {
  const units = await allowedUnits(db, actor);
  if (!units) return null;
  const kinds = new Set(units.map((u) => areaOf(u.kind)));
  const areas = AREA_KEYS.filter((a) => kinds.has(a));
  return areas.length ? { areas } : null;
}

/** Sortierung nach Altersklasse: Jugend A → G, Senioren 1. → 2. … → Alte Herren. */
function rank(card: { area: AreaKey; badge: string }): [number, number, string] {
  const areaRank = { seniors: 0, women: 1, youth: 2 }[card.area];
  const b = card.badge.trim().toUpperCase();
  if (card.area === 'youth') {
    // A1, A2, B1 … – Buchstabe A–G, dann Nummer
    const m = /^([A-G])\s*(\d*)/.exec(b);
    return [areaRank, m ? (m[1]!.charCodeAt(0) - 64) * 100 + Number(m[2] || 0) : 999, b];
  }
  const n = /^(\d+)\./.exec(b);
  if (n) return [areaRank, Number(n[1]), b];
  // Alte Herren und alles Übrige zuletzt
  return [areaRank, b === 'AH' ? 900 : 500, b];
}

export async function getAreaOverview(
  db: Db,
  actor: Actor,
  areaParam: AreaKey | 'all',
  now: Date,
): Promise<AreaOverview> {
  const units = await allowedUnits(db, actor);
  if (!units) throw forbidden('Die Bereichsübersicht sehen nur Leitung und Vorstand.');
  const areas = AREA_KEYS.filter((a) => units.some((u) => areaOf(u.kind) === a));
  const area = areaParam !== 'all' && areas.includes(areaParam) ? areaParam : 'all';
  const unitArea = new Map(units.map((u) => [u.id, areaOf(u.kind)]));

  const teams = (
    await db
      .select({ team: s.teams })
      .from(s.teams)
      .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
      .where(
        and(
          eq(s.teams.clubId, actor.club.id),
          eq(s.seasons.isCurrent, true),
          inArray(s.teams.orgUnitId, [...unitArea.keys()]),
        ),
      )
      .orderBy(asc(s.teams.sortOrder))
  )
    .map((r) => r.team)
    .filter((t) => area === 'all' || unitArea.get(t.orgUnitId) === area);
  const teamIds = teams.map((t) => t.id);
  const tz = actor.club.timezone;
  const today = toIsoDate(calendarDayOf(now, tz));

  if (teamIds.length === 0) {
    return {
      area,
      areas,
      summary: { teams: 0, players: 0, coaches: 0, matchesThisWeek: 0, trainingAverage: null },
      record: area === 'all' ? { won: 0, drawn: 0, lost: 0 } : null,
      teams: [],
    };
  }

  const monday = addDays(calendarDayOf(now, tz), -((calendarDayOf(now, tz).getUTCDay() + 6) % 7));
  const weekStart = at(monday, '00:00', tz);
  const weekEnd = at(addDays(monday, 7), '00:00', tz);

  const [members, absences, participation, matchesWeek, upcoming, results] = await Promise.all([
    db
      .select({
        teamId: s.teamMemberships.teamId,
        personId: s.teamMemberships.personId,
        function: s.teamMemberships.function,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
      })
      .from(s.teamMemberships)
      .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
      .where(
        and(
          inArray(s.teamMemberships.teamId, teamIds),
          inArray(s.teamMemberships.function, ['player', 'coach']),
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
    // Trainingsbeteiligung der letzten 4 Wochen: nur Einheiten mit erfasster Anwesenheit, gemeldete
    // Abwesenheiten (Spieler mit Abwesenheit) herausgerechnet
    db
      .select({
        teamId: s.events.teamId,
        sessions: sql<number>`count(distinct ${s.events.id})`,
        total: sql<number>`count(*) filter (where ${s.eventParticipants.absenceId} is null)`,
        attended: sql<number>`count(*) filter (where ${s.eventParticipants.absenceId} is null and ${s.eventParticipants.attended} is true)`,
      })
      .from(s.eventParticipants)
      .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
      .where(
        and(
          inArray(s.events.teamId, teamIds),
          eq(s.events.type, 'training'),
          eq(s.events.status, 'scheduled'),
          isNotNull(s.events.attendanceRecordedAt),
          lt(s.events.startsAt, now),
          gte(s.events.startsAt, new Date(now.getTime() - 28 * DAY)),
          eq(s.eventParticipants.role, 'player'),
        ),
      )
      .groupBy(s.events.teamId),
    db
      .select({ id: s.events.id })
      .from(s.events)
      .where(
        and(
          inArray(s.events.teamId, teamIds),
          inArray(s.events.type, ['match', 'tournament']),
          eq(s.events.status, 'scheduled'),
          gte(s.events.startsAt, weekStart),
          lt(s.events.startsAt, weekEnd),
        ),
      ),
    db
      .select({
        teamId: s.events.teamId,
        eventId: s.events.id,
        startsAt: s.events.startsAt,
        isHome: s.matchDetails.isHome,
        opponent: s.matchDetails.opponentName,
      })
      .from(s.events)
      .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
      .where(
        and(
          inArray(s.events.teamId, teamIds),
          eq(s.events.type, 'match'),
          eq(s.events.status, 'scheduled'),
          gt(s.events.startsAt, now),
        ),
      )
      .orderBy(asc(s.events.startsAt)),
    area === 'all'
      ? db
          .select({
            won: sql<number>`count(*) filter (where ${s.matchDetails.goalsFor} > ${s.matchDetails.goalsAgainst})`,
            drawn: sql<number>`count(*) filter (where ${s.matchDetails.goalsFor} = ${s.matchDetails.goalsAgainst})`,
            lost: sql<number>`count(*) filter (where ${s.matchDetails.goalsFor} < ${s.matchDetails.goalsAgainst})`,
          })
          .from(s.matchDetails)
          .innerJoin(s.events, eq(s.events.id, s.matchDetails.eventId))
          .innerJoin(s.teams, eq(s.teams.id, s.events.teamId))
          .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
          .where(
            and(
              inArray(s.events.teamId, teamIds),
              eq(s.events.status, 'scheduled'),
              lt(s.events.startsAt, now),
              gte(s.events.startsAt, sql`${s.seasons.startsOn}::timestamptz`),
              isNotNull(s.matchDetails.goalsFor),
              isNotNull(s.matchDetails.goalsAgainst),
            ),
          )
      : Promise.resolve(null),
  ]);

  // Nächstes Spiel je Mannschaft samt Rückmeldungen (zugesagt / abgesagt / offen)
  const nextByTeam = new Map<string, (typeof upcoming)[number]>();
  for (const u of upcoming) if (u.teamId && !nextByTeam.has(u.teamId)) nextByTeam.set(u.teamId, u);
  const nextIds = [...nextByTeam.values()].map((u) => u.eventId);
  const responses = nextIds.length
    ? await db
        .select({
          eventId: s.eventParticipants.eventId,
          status: s.eventParticipants.status,
          n: sql<number>`count(*)`,
        })
        .from(s.eventParticipants)
        .where(
          and(
            inArray(s.eventParticipants.eventId, nextIds),
            inArray(s.eventParticipants.role, ['player', 'guest_player']),
          ),
        )
        .groupBy(s.eventParticipants.eventId, s.eventParticipants.status)
    : [];

  const cards: AreaTeamCard[] = teams.map((team) => {
    const players = members.filter((m) => m.teamId === team.id && m.function === 'player');
    const coaches = members.filter((m) => m.teamId === team.id && m.function === 'coach');
    const absent = new Set(
      absences
        .filter(
          (a) =>
            players.some((p) => p.personId === a.personId) &&
            (!a.teamIds || a.teamIds.includes(team.id)),
        )
        .map((a) => a.personId),
    );
    const part = participation.find((p) => p.teamId === team.id);
    const sessions = Number(part?.sessions ?? 0);
    const percent =
      part && Number(part.total) > 0
        ? Math.round((Number(part.attended) / Number(part.total)) * 100)
        : null;
    const next = nextByTeam.get(team.id);
    const count = (status: string[]) =>
      responses
        .filter((r) => r.eventId === next?.eventId && status.includes(r.status))
        .reduce((sum, r) => sum + Number(r.n), 0);
    return {
      id: team.id,
      badge: team.badge,
      name: team.name,
      area: unitArea.get(team.orgUnitId)!,
      squad: { total: players.length, available: players.length - absent.size },
      coaches: coaches.map((c) => `${c.firstName} ${c.lastName}`),
      participation: { percent, sessions, level: participationLevel(percent, sessions) },
      nextMatch: next
        ? {
            startsAt: next.startsAt.toISOString(),
            isHome: next.isHome,
            opponent: next.opponent,
            yes: count(['yes']),
            no: count(['no']),
            open: count(['maybe', 'pending']),
          }
        : null,
    };
  });
  cards.sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2]);
  });

  const withData = cards.filter((c) => c.participation.level !== 'none');
  const rec = results?.[0];
  return {
    area,
    areas,
    summary: {
      teams: cards.length,
      players: cards.reduce((n, c) => n + c.squad.total, 0),
      coaches: new Set(members.filter((m) => m.function === 'coach').map((m) => m.personId)).size,
      matchesThisWeek: matchesWeek.length,
      trainingAverage:
        area === 'all' && withData.length
          ? Math.round(
              withData.reduce((n, c) => n + (c.participation.percent ?? 0), 0) / withData.length,
            )
          : null,
    },
    record: rec ? { won: Number(rec.won), drawn: Number(rec.drawn), lost: Number(rec.lost) } : null,
    teams: cards,
  };
}
