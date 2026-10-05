/**
 * Spielbetrieb (Konzept §4, Mappe S. 4): Aufstellung/Nominierung und Spielbericht.
 *
 *  - Aufstellung: Trainerteam (`squad.manage`, Modul „Kader & Aufstellung“). Entwürfe sieht nur das
 *    Trainerteam; mit „Veröffentlichen“ sieht die Mannschaft die Aufstellung und die Nominierten
 *    (bzw. ihre Eltern) werden benachrichtigt. Wer abgesagt hat, kann nicht nominiert werden.
 *  - Spielbericht: Trainerteam (`events.manage`). Ergebnis, Tore mit Vorlage, Karten. Erst ein
 *    abgeschlossener Bericht zählt in der Statistik; die Anzahl der Tore muss zum Ergebnis passen.
 */
import {
  calendarDayOf,
  resolveModule,
  toIsoDate,
  type JerseyMode,
  type JerseySettings,
  type LineupCandidate,
  type LineupEntry,
  type MatchIncident,
  type MatchSheet,
  type SaveLineupInput,
  type SaveReportInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { notify, recipientsFor } from './event-admin';
import { loadTeamForActor } from './team-access';

const GOAL_KINDS = new Set(['goal', 'penalty_goal', 'own_goal']);
const MAX_SQUAD = 30;

type TeamRow = typeof s.teams.$inferSelect;

export function jerseyModeOf(actor: Actor, team: TeamRow): JerseyMode | null {
  const resolved = resolveModule(actor.modules, 'jersey_numbers', {
    teamId: team.id,
    orgUnitId: team.orgUnitId,
  });
  if (!resolved.enabled) return null;
  return resolved.config.mode === 'match' ? 'match' : 'season';
}

async function loadMatch(db: Db, actor: Actor, eventId: string) {
  const [row] = await db
    .select({ event: s.events, match: s.matchDetails, team: s.teams })
    .from(s.events)
    .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
    .innerJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .where(and(eq(s.events.id, eventId), eq(s.events.clubId, actor.club.id)));
  if (!row) throw notFound('Das Spiel');
  const [own] = await db
    .select({ id: s.eventParticipants.id })
    .from(s.eventParticipants)
    .where(
      and(
        eq(s.eventParticipants.eventId, eventId),
        inArray(s.eventParticipants.personId, actor.managedIds),
      ),
    );
  const visible =
    actor.teamIds.includes(row.team.id) || !!own || actorCan(actor, 'attendance.read', row.team);
  if (!visible) throw notFound('Das Spiel');
  return {
    ...row,
    canLineup: actorCan(actor, 'squad.manage', row.team) && moduleEnabled(actor, 'squad', row.team),
    canReport: actorCan(actor, 'events.manage', row.team),
  };
}

/** Spieler der Mannschaft und Gastspieler dieses Spiels mit ihrer Zu-/Absage. */
async function candidatesFor(db: Db, eventId: string): Promise<LineupCandidate[]> {
  const guestTeams = s.teams;
  const rows = await db
    .select({
      personId: s.eventParticipants.personId,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
      position: s.persons.position,
      status: s.eventParticipants.status,
      role: s.eventParticipants.role,
      guestFrom: guestTeams.badge,
      teamId: s.events.teamId,
    })
    .from(s.eventParticipants)
    .innerJoin(s.persons, eq(s.persons.id, s.eventParticipants.personId))
    .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
    .leftJoin(guestTeams, eq(guestTeams.id, s.eventParticipants.guestFromTeamId))
    .where(
      and(
        eq(s.eventParticipants.eventId, eventId),
        inArray(s.eventParticipants.role, ['player', 'guest_player']),
      ),
    )
    .orderBy(asc(s.persons.lastName), asc(s.persons.firstName));
  const teamId = rows[0]?.teamId;
  const jerseys = teamId
    ? await db
        .select({ personId: s.teamMemberships.personId, jersey: s.teamMemberships.jerseyNumber })
        .from(s.teamMemberships)
        .where(eq(s.teamMemberships.teamId, teamId))
    : [];
  return rows.map((r) => ({
    personId: r.personId,
    name: `${r.firstName} ${r.lastName}`,
    status: r.status,
    position: r.position,
    jerseyNumber: jerseys.find((j) => j.personId === r.personId)?.jersey ?? null,
    guestFrom: r.role === 'guest_player' ? (r.guestFrom ?? 'Gast') : null,
  }));
}

export async function getMatchSheet(db: Db, actor: Actor, eventId: string): Promise<MatchSheet> {
  const m = await loadMatch(db, actor, eventId);
  const manager = m.canLineup || m.canReport;
  const candidates = await candidatesFor(db, eventId);
  const [lineupRows, incidentRows] = await Promise.all([
    db.select().from(s.matchLineups).where(eq(s.matchLineups.eventId, eventId)),
    db
      .select()
      .from(s.matchIncidents)
      .where(eq(s.matchIncidents.eventId, eventId))
      .orderBy(asc(s.matchIncidents.minute), asc(s.matchIncidents.createdAt)),
  ]);
  const names = new Map(candidates.map((c) => [c.personId, c.name]));
  // Spieler, die nicht mehr in der Kandidatenliste stehen (z. B. Mannschaft gewechselt)
  const missing = [
    ...new Set(
      [
        ...lineupRows.map((l) => l.personId),
        ...incidentRows.flatMap((i) => [i.personId, i.assistPersonId]),
      ].filter((id): id is string => !!id && !names.has(id)),
    ),
  ];
  if (missing.length) {
    const extra = await db
      .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
      .from(s.persons)
      .where(inArray(s.persons.id, missing));
    for (const p of extra) names.set(p.id, `${p.firstName} ${p.lastName}`);
  }
  const ref = (id: string | null) => (id ? { id, name: names.get(id) ?? 'Unbekannt' } : null);

  const published = m.match.lineupPublishedAt !== null;
  const entries: LineupEntry[] = lineupRows
    .map((l) => {
      const c = candidates.find((x) => x.personId === l.personId);
      return {
        personId: l.personId,
        name: names.get(l.personId) ?? 'Unbekannt',
        role: l.role,
        position: l.position,
        jerseyNumber: l.jerseyNumber ?? c?.jerseyNumber ?? null,
        guestFrom: c?.guestFrom ?? null,
      };
    })
    .sort(
      (a, b) =>
        Number(a.role !== 'starter') - Number(b.role !== 'starter') ||
        (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99) ||
        a.name.localeCompare(b.name),
    );
  const completed = m.match.reportCompletedAt !== null;
  const incidents: MatchIncident[] = incidentRows.map((i) => ({
    id: i.id,
    kind: i.kind,
    minute: i.minute,
    person: ref(i.personId),
    assist: ref(i.assistPersonId),
  }));

  return {
    eventId,
    title: m.event.title,
    startsAt: m.event.startsAt.toISOString(),
    opponentName: m.match.opponentName,
    isHome: m.match.isHome,
    goalsFor: m.match.goalsFor,
    goalsAgainst: m.match.goalsAgainst,
    jerseyMode: jerseyModeOf(actor, m.team),
    lineup: published || manager ? { published, entries } : null,
    candidates: m.canLineup ? candidates : null,
    report: completed || m.canReport ? { completed, incidents } : null,
    can: { editLineup: m.canLineup, editReport: m.canReport },
  };
}

export async function saveLineup(
  db: Db,
  actor: Actor,
  eventId: string,
  input: SaveLineupInput,
  now: Date,
): Promise<MatchSheet> {
  const m = await loadMatch(db, actor, eventId);
  if (!m.canLineup) throw forbidden('Die Aufstellung macht das Trainerteam.');
  if (m.event.status === 'cancelled')
    throw new HttpError(409, 'cancelled', 'Das Spiel ist abgesagt.');
  if (input.entries.length > MAX_SQUAD)
    throw new HttpError(400, 'too_many', `Höchstens ${MAX_SQUAD} Spieler im Kader.`);
  const ids = input.entries.map((e) => e.personId);
  if (new Set(ids).size !== ids.length)
    throw new HttpError(400, 'duplicate', 'Ein Spieler steht doppelt in der Aufstellung.');
  if (input.entries.filter((e) => e.role === 'starter').length > 11)
    throw new HttpError(400, 'too_many_starters', 'In der Startelf stehen höchstens 11 Spieler.');

  const candidates = await candidatesFor(db, eventId);
  for (const e of input.entries) {
    const c = candidates.find((x) => x.personId === e.personId);
    if (!c) throw new HttpError(400, 'not_in_team', 'Nur Spieler der Mannschaft oder Gastspieler.');
    if (c.status === 'no')
      throw new HttpError(409, 'declined', `${c.name} hat für das Spiel abgesagt.`);
  }
  const jerseyMode = jerseyModeOf(actor, m.team);
  const numbers = input.entries.map((e) => e.jerseyNumber).filter((n): n is number => n != null);
  if (new Set(numbers).size !== numbers.length)
    throw new HttpError(400, 'jersey_duplicate', 'Eine Rückennummer ist doppelt vergeben.');

  const before = await db
    .select({ personId: s.matchLineups.personId })
    .from(s.matchLineups)
    .where(eq(s.matchLineups.eventId, eventId));
  const wasPublished = m.match.lineupPublishedAt !== null;

  await db.transaction(async (tx) => {
    await tx.delete(s.matchLineups).where(eq(s.matchLineups.eventId, eventId));
    if (input.entries.length) {
      await tx.insert(s.matchLineups).values(
        input.entries.map((e) => ({
          clubId: actor.club.id,
          eventId,
          personId: e.personId,
          role: e.role,
          position: e.position?.trim() || null,
          jerseyNumber: jerseyMode ? (e.jerseyNumber ?? null) : null,
        })),
      );
    }
    if (input.publish && !wasPublished) {
      await tx
        .update(s.matchDetails)
        .set({ lineupPublishedAt: now })
        .where(eq(s.matchDetails.eventId, eventId));
    }
  });

  // Benachrichtigen: beim ersten Veröffentlichen alle Nominierten, danach nur neu Hinzugekommene
  if (input.publish) {
    const previously = new Set(wasPublished ? before.map((b) => b.personId) : []);
    const fresh = input.entries.filter((e) => !previously.has(e.personId));
    for (const role of ['starter', 'substitute'] as const) {
      const people = fresh.filter((e) => e.role === role).map((e) => e.personId);
      await notify(
        db,
        actor,
        await recipientsFor(db, people, actor.user.id),
        {
          level: 'important',
          title: `Nominiert: ${m.event.title}`,
          body: role === 'starter' ? 'Du stehst in der Startelf.' : 'Du bist im Kader (Bank).',
          link: `/events/${eventId}`,
        },
        now,
      );
    }
  }
  return getMatchSheet(db, actor, eventId);
}

export async function saveReport(
  db: Db,
  actor: Actor,
  eventId: string,
  input: SaveReportInput,
  now: Date,
): Promise<MatchSheet> {
  const m = await loadMatch(db, actor, eventId);
  if (!m.canReport) throw forbidden('Den Spielbericht schreibt das Trainerteam.');
  if (m.event.status === 'cancelled')
    throw new HttpError(409, 'cancelled', 'Das Spiel ist abgesagt.');
  if (m.event.startsAt > now)
    throw new HttpError(409, 'not_started', 'Der Spielbericht ist erst nach Anpfiff möglich.');

  const lineup = await db
    .select({ personId: s.matchLineups.personId })
    .from(s.matchLineups)
    .where(eq(s.matchLineups.eventId, eventId));
  const candidates = await candidatesFor(db, eventId);
  // Mit Aufstellung zählen nur Spieler im Kader, sonst alle Spieler und Gastspieler des Spiels
  const allowed = new Set(
    lineup.length ? lineup.map((l) => l.personId) : candidates.map((c) => c.personId),
  );
  for (const i of input.incidents) {
    const needsPerson = i.kind !== 'own_goal';
    if (needsPerson && (!i.personId || !allowed.has(i.personId)))
      throw new HttpError(400, 'invalid_player', 'Bitte einen Spieler aus dem Kader wählen.');
    if (!needsPerson && (i.personId || i.assistPersonId))
      throw new HttpError(400, 'own_goal', 'Beim Eigentor des Gegners gibt es keinen Torschützen.');
    if (i.assistPersonId && (!GOAL_KINDS.has(i.kind) || !allowed.has(i.assistPersonId)))
      throw new HttpError(
        400,
        'invalid_assist',
        'Vorlagen gibt es nur bei Toren von Kaderspielern.',
      );
    if (i.assistPersonId && i.assistPersonId === i.personId)
      throw new HttpError(400, 'invalid_assist', 'Torschütze und Vorlage müssen verschieden sein.');
  }
  const goals = input.incidents.filter((i) => GOAL_KINDS.has(i.kind)).length;
  if (input.complete && goals !== input.goalsFor) {
    throw new HttpError(
      400,
      'goals_mismatch',
      `Erfasst sind ${goals} Tore, das Ergebnis nennt ${input.goalsFor}. Bitte angleichen.`,
    );
  }
  const firstCompletion = input.complete && m.match.reportCompletedAt === null;

  await db.transaction(async (tx) => {
    await tx
      .update(s.matchDetails)
      .set({
        goalsFor: input.goalsFor,
        goalsAgainst: input.goalsAgainst,
        reportCompletedAt: input.complete ? (m.match.reportCompletedAt ?? now) : null,
      })
      .where(eq(s.matchDetails.eventId, eventId));
    await tx.delete(s.matchIncidents).where(eq(s.matchIncidents.eventId, eventId));
    if (input.incidents.length) {
      await tx.insert(s.matchIncidents).values(
        input.incidents.map((i) => ({
          clubId: actor.club.id,
          eventId,
          kind: i.kind,
          personId: i.personId ?? null,
          assistPersonId: i.assistPersonId ?? null,
          minute: i.minute ?? null,
          createdAt: now,
        })),
      );
    }
  });

  if (firstCompletion) {
    const team = await db
      .select({ personId: s.eventParticipants.personId })
      .from(s.eventParticipants)
      .where(eq(s.eventParticipants.eventId, eventId));
    const score = m.match.isHome
      ? `${input.goalsFor}:${input.goalsAgainst}`
      : `${input.goalsAgainst}:${input.goalsFor}`;
    await notify(
      db,
      actor,
      await recipientsFor(
        db,
        team.map((t) => t.personId),
        actor.user.id,
      ),
      {
        level: 'info',
        title: `Spielbericht: ${m.event.title} ${score}`,
        body: `${goals} Tore erfasst`,
        link: `/events/${eventId}`,
      },
      now,
    );
  }
  return getMatchSheet(db, actor, eventId);
}

// ── Rückennummern ─────────────────────────────────────────────────────────────

export async function getJerseys(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date,
): Promise<JerseySettings> {
  const { team } = await loadTeamForActor(db, actor, teamId);
  const players = await currentPlayers(db, actor, team, now);
  return {
    mode: jerseyModeOf(actor, team),
    numbers: players.map((p) => ({
      personId: p.personId,
      name: p.name,
      jerseyNumber: p.jerseyNumber,
    })),
    canEdit: actorCan(actor, 'squad.manage', team),
  };
}

async function currentPlayers(db: Db, actor: Actor, team: TeamRow, now: Date) {
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const rows = await db
    .select({ membership: s.teamMemberships, person: s.persons })
    .from(s.teamMemberships)
    .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
    .where(
      and(
        eq(s.teamMemberships.teamId, team.id),
        eq(s.teamMemberships.function, 'player'),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    )
    .orderBy(asc(s.teamMemberships.jerseyNumber), asc(s.persons.lastName));
  return rows.map((r) => ({
    membershipId: r.membership.id,
    personId: r.person.id,
    name: `${r.person.firstName} ${r.person.lastName}`,
    jerseyNumber: r.membership.jerseyNumber,
  }));
}

export async function saveJerseys(
  db: Db,
  actor: Actor,
  teamId: string,
  input: {
    mode: JerseyMode | 'off';
    numbers?: { personId: string; jerseyNumber: number | null }[];
  },
  now: Date,
): Promise<JerseySettings> {
  const { team } = await loadTeamForActor(db, actor, teamId);
  if (!actorCan(actor, 'squad.manage', team))
    throw forbidden('Rückennummern vergibt das Trainerteam.');
  const settings = actor.modules;
  if (input.mode !== 'off' && !resolveModule(settings, 'jersey_numbers').enabled)
    throw new HttpError(409, 'club_disabled', 'Rückennummern sind im Verein ausgeschaltet.');

  const players = await currentPlayers(db, actor, team, now);
  const numbers = input.numbers ?? [];
  for (const n of numbers) {
    if (!players.some((p) => p.personId === n.personId))
      throw new HttpError(400, 'not_in_team', 'Nur Spieler der Mannschaft.');
  }
  // Doppelte Nummern verhindern (geänderte und unveränderte zusammen betrachtet)
  const changed = new Map(numbers.map((n) => [n.personId, n.jerseyNumber]));
  const final = players.map((p) =>
    changed.has(p.personId) ? changed.get(p.personId)! : p.jerseyNumber,
  );
  const used = final.filter((n): n is number => n != null);
  if (new Set(used).size !== used.length)
    throw new HttpError(400, 'jersey_duplicate', 'Eine Rückennummer ist doppelt vergeben.');

  await db.transaction(async (tx) => {
    const [own] = await tx
      .select()
      .from(s.moduleSettings)
      .where(
        and(
          eq(s.moduleSettings.moduleKey, 'jersey_numbers'),
          eq(s.moduleSettings.scopeType, 'team'),
          eq(s.moduleSettings.scopeId, team.id),
        ),
      );
    const values =
      input.mode === 'off'
        ? { state: 'available' as const, level: 'off' as const, config: own?.config ?? {} }
        : {
            state: 'enabled' as const,
            level: 'basic' as const,
            config: { ...(own?.config ?? {}), mode: input.mode },
          };
    if (own) {
      await tx.update(s.moduleSettings).set(values).where(eq(s.moduleSettings.id, own.id));
    } else {
      await tx.insert(s.moduleSettings).values({
        clubId: actor.club.id,
        scopeType: 'team',
        scopeId: team.id,
        moduleKey: 'jersey_numbers',
        ...values,
      });
    }
    for (const n of numbers) {
      const p = players.find((x) => x.personId === n.personId)!;
      await tx
        .update(s.teamMemberships)
        .set({ jerseyNumber: n.jerseyNumber })
        .where(eq(s.teamMemberships.id, p.membershipId));
    }
  });
  // Modulzustand des Actors ist für diese Anfrage veraltet → frisch berechnen
  const fresh = await db
    .select()
    .from(s.moduleSettings)
    .where(eq(s.moduleSettings.clubId, actor.club.id));
  return getJerseys(
    db,
    { ...actor, modules: fresh.map((m) => ({ ...m })) as Actor['modules'] },
    teamId,
    now,
  );
}
