/**
 * Gastspielerbörse (Mappe S. 17, Konzept §6/§9):
 *  - Mannschaften melden Spielerbedarf für einen ihrer Termine.
 *  - Mannschaften bieten Spieler für einen Tag an.
 *  - Der Trainer der **abgebenden** Mannschaft wählt die Spieler aus; fremde Trainer fragen keine
 *    Einzelspieler direkt an. Nominierte erscheinen als Gastspieler im Termin und bekommen eine
 *    Benachrichtigung.
 *  - Andere Mannschaften sehen nur aggregierte Verfügbarkeit, nie Gründe (Datensparsamkeit).
 */
import {
  calendarDayOf,
  toIsoDate,
  type CreateDemandInput,
  type CreateOfferInput,
  type DemandCandidate,
  type DemandDetail,
  type ExchangeOverview,
  type ExchangeTeamRef,
  type PlayerDemand,
  type PlayerOffer,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, eq, gt, gte, inArray, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { notify, recipientsFor } from './event-admin';

type TeamRow = typeof s.teams.$inferSelect;
type EventRow = typeof s.events.$inferSelect;

const ABSENCE_LABELS = {
  vacation: 'Urlaub',
  injury: 'Verletzt',
  illness: 'Krank',
  school_work: 'Schule/Beruf',
  suspended: 'Gesperrt',
  other: 'Sonstiges',
} as const;
const DEFAULT_EVENT_MINUTES = 120;
const ref = (t: TeamRow): ExchangeTeamRef => ({ id: t.id, name: t.name, badge: t.badge });

async function currentTeams(db: Db, actor: Actor): Promise<TeamRow[]> {
  const rows = await db
    .select({ team: s.teams })
    .from(s.teams)
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(and(eq(s.teams.clubId, actor.club.id), eq(s.seasons.isCurrent, true)))
    .orderBy(asc(s.teams.sortOrder));
  return rows.map((r) => r.team);
}

/** Mannschaften, für die ich Bedarf melden und aus denen ich Spieler abstellen darf. */
function myExchangeTeams(actor: Actor, teams: TeamRow[]): TeamRow[] {
  if (!moduleEnabled(actor, 'player_exchange')) return [];
  return teams.filter(
    (t) => actorCan(actor, 'squad.demand.manage', t) && moduleEnabled(actor, 'guest_players', t),
  );
}

function requireExchange(actor: Actor, teams: TeamRow[]): TeamRow[] {
  if (!moduleEnabled(actor, 'player_exchange')) {
    throw forbidden('Die Gastspielerbörse ist für den Verein nicht aktiviert.');
  }
  const mine = myExchangeTeams(actor, teams);
  if (mine.length === 0)
    throw forbidden('Die Gastspielerbörse ist für Trainerteams und sportliche Leitung.');
  return mine;
}

const eventEnd = (e: Pick<EventRow, 'startsAt' | 'endsAt'>) =>
  e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000);

async function filledCounts(db: Db, demandIds: string[]): Promise<Map<string, number>> {
  if (demandIds.length === 0) return new Map();
  const rows = await db
    .select({ demandId: s.eventParticipants.demandId, n: count() })
    .from(s.eventParticipants)
    .where(
      and(inArray(s.eventParticipants.demandId, demandIds), ne(s.eventParticipants.status, 'no')),
    )
    .groupBy(s.eventParticipants.demandId);
  return new Map(rows.map((r) => [r.demandId!, Number(r.n)]));
}

async function loadDemands(db: Db, actor: Actor, teams: TeamRow[], now: Date, onlyId?: string) {
  const mine = myExchangeTeams(actor, teams);
  const rows = await db
    .select({
      demand: s.playerDemands,
      team: s.teams,
      event: s.events,
      facility: s.facilities.name,
    })
    .from(s.playerDemands)
    .innerJoin(s.teams, eq(s.teams.id, s.playerDemands.teamId))
    .innerJoin(s.events, eq(s.events.id, s.playerDemands.eventId))
    .leftJoin(s.facilities, eq(s.facilities.id, s.events.facilityId))
    .where(
      and(
        eq(s.playerDemands.clubId, actor.club.id),
        onlyId ? eq(s.playerDemands.id, onlyId) : undefined,
        eq(s.playerDemands.status, 'open'),
        eq(s.events.status, 'scheduled'),
        gt(s.events.startsAt, now),
      ),
    )
    .orderBy(asc(s.events.startsAt));
  const filled = await filledCounts(
    db,
    rows.map((r) => r.demand.id),
  );
  const demands: PlayerDemand[] = rows.map((r) => {
    const f = filled.get(r.demand.id) ?? 0;
    const isMine = mine.some((t) => t.id === r.team.id);
    const fulfilled = f >= r.demand.count;
    return {
      id: r.demand.id,
      team: ref(r.team),
      event: {
        id: r.event.id,
        title: r.event.title,
        type: r.event.type,
        startsAt: r.event.startsAt.toISOString(),
        location: r.facility ?? r.event.locationText,
      },
      count: r.demand.count,
      filled: f,
      positions: r.demand.positions,
      note: r.demand.note,
      status: fulfilled ? 'fulfilled' : 'open',
      createdAt: r.demand.createdAt.toISOString(),
      mine: isMine,
      canNominate: !fulfilled && mine.some((t) => t.id !== r.team.id),
    };
  });
  return { demands, rows, mine };
}

export async function getOverview(db: Db, actor: Actor, now: Date): Promise<ExchangeOverview> {
  const teams = await currentTeams(db, actor);
  const mine = requireExchange(actor, teams);
  const { demands } = await loadDemands(db, actor, teams, now);

  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const offerRows = await db
    .select({ offer: s.playerOffers, team: s.teams })
    .from(s.playerOffers)
    .innerJoin(s.teams, eq(s.teams.id, s.playerOffers.teamId))
    .where(
      and(
        eq(s.playerOffers.clubId, actor.club.id),
        eq(s.playerOffers.status, 'open'),
        gte(s.playerOffers.day, today),
      ),
    )
    .orderBy(asc(s.playerOffers.day));
  const offers: PlayerOffer[] = offerRows.map(({ offer, team }) => ({
    id: offer.id,
    team: ref(team),
    day: offer.day,
    count: offer.count,
    note: offer.note,
    mine: mine.some((t) => t.id === team.id),
  }));

  return {
    myTeams: mine.map(ref),
    demands,
    offers,
    summary: {
      openDemands: demands.filter((d) => d.status === 'open').length,
      offeringTeams: new Set(offers.map((o) => o.team.id)).size,
      forYou: demands.filter((d) => d.canNominate && !d.mine).length,
    },
  };
}

/** Zustand der Spieler für den Zeitraum eines Termins: abwesend, anderweitig im Einsatz, schon nominiert. */
async function playerStates(
  db: Db,
  actor: Actor,
  event: EventRow,
  playerIds: string[],
): Promise<Map<string, { state: DemandCandidate['state']; hint: string | null }>> {
  const result = new Map<string, { state: DemandCandidate['state']; hint: string | null }>();
  if (playerIds.length === 0) return result;
  const day = toIsoDate(calendarDayOf(event.startsAt, actor.club.timezone));

  const [absences, busy, nominated] = await Promise.all([
    db
      .select()
      .from(s.absences)
      .where(
        and(
          inArray(s.absences.personId, playerIds),
          lte(s.absences.startsOn, day),
          gte(s.absences.endsOn, day),
        ),
      ),
    db
      .select({
        personId: s.eventParticipants.personId,
        title: s.events.title,
        badge: s.teams.badge,
      })
      .from(s.eventParticipants)
      .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
      .leftJoin(s.teams, eq(s.teams.id, s.events.teamId))
      .where(
        and(
          inArray(s.eventParticipants.personId, playerIds),
          eq(s.eventParticipants.status, 'yes'),
          ne(s.eventParticipants.role, 'coach'),
          ne(s.eventParticipants.role, 'attendee'),
          ne(s.events.id, event.id),
          eq(s.events.status, 'scheduled'),
          lt(s.events.startsAt, eventEnd(event)),
          sql`coalesce(${s.events.endsAt}, ${s.events.startsAt} + interval '120 minutes') > ${event.startsAt.toISOString()}::timestamptz`,
        ),
      ),
    db
      .select({ personId: s.eventParticipants.personId })
      .from(s.eventParticipants)
      .where(
        and(
          eq(s.eventParticipants.eventId, event.id),
          inArray(s.eventParticipants.personId, playerIds),
        ),
      ),
  ]);

  for (const id of playerIds) {
    const absence = absences.find((a) => a.personId === id);
    const overlap = busy.find((b) => b.personId === id);
    if (nominated.some((n) => n.personId === id))
      result.set(id, { state: 'nominated', hint: 'Bereits eingetragen' });
    else if (absence)
      result.set(id, { state: 'absent', hint: `Abwesend: ${ABSENCE_LABELS[absence.kind]}` });
    else if (overlap)
      result.set(id, {
        state: 'busy',
        hint: `Spielt selbst: ${overlap.badge ? `${overlap.badge} ` : ''}${overlap.title}`,
      });
    else result.set(id, { state: 'available', hint: null });
  }
  return result;
}

async function activePlayers(db: Db, teamIds: string[], day: string) {
  if (teamIds.length === 0) return [];
  return db
    .select({ membership: s.teamMemberships, person: s.persons })
    .from(s.teamMemberships)
    .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
    .where(
      and(
        inArray(s.teamMemberships.teamId, teamIds),
        eq(s.teamMemberships.function, 'player'),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, day)),
      ),
    )
    .orderBy(asc(s.persons.lastName), asc(s.persons.firstName));
}

export async function getDemand(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<DemandDetail> {
  const teams = await currentTeams(db, actor);
  const mine = requireExchange(actor, teams);
  const { demands, rows } = await loadDemands(db, actor, teams, now, id);
  const demand = demands[0];
  const row = rows[0];
  if (!demand || !row) throw notFound('Der Bedarf');
  const day = toIsoDate(calendarDayOf(row.event.startsAt, actor.club.timezone));

  // Eingetragene Gastspieler
  const guests = await db
    .select({
      personId: s.persons.id,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
      status: s.eventParticipants.status,
      fromTeamId: s.eventParticipants.guestFromTeamId,
    })
    .from(s.eventParticipants)
    .innerJoin(s.persons, eq(s.persons.id, s.eventParticipants.personId))
    .where(eq(s.eventParticipants.demandId, id));
  const badgeOf = new Map(teams.map((t) => [t.id, t.badge]));

  // Aggregierte Verfügbarkeit der übrigen Mannschaften (nur Zahlen)
  const others = teams.filter((t) => t.id !== demand.team.id);
  const otherPlayers = await activePlayers(
    db,
    others.map((t) => t.id),
    day,
  );
  const otherStates = await playerStates(db, actor, row.event, [
    ...new Set(otherPlayers.map((p) => p.person.id)),
  ]);
  const availability = others
    .map((t) => {
      const own = otherPlayers.filter((p) => p.membership.teamId === t.id);
      return {
        team: ref(t),
        players: own.length,
        available: own.filter((p) => otherStates.get(p.person.id)?.state === 'available').length,
      };
    })
    .filter((a) => a.players > 0);

  // Kandidaten aus meinen Mannschaften
  const myOthers = mine.filter((t) => t.id !== demand.team.id);
  const myPlayers = await activePlayers(
    db,
    myOthers.map((t) => t.id),
    day,
  );
  const myStates = await playerStates(db, actor, row.event, [
    ...new Set(myPlayers.map((p) => p.person.id)),
  ]);
  const candidates = myOthers.map((t) => ({
    team: ref(t),
    players: myPlayers
      .filter((p) => p.membership.teamId === t.id)
      .map((p): DemandCandidate => {
        const st = myStates.get(p.person.id)!;
        return {
          personId: p.person.id,
          name: `${p.person.firstName} ${p.person.lastName}`,
          position: p.person.position,
          jerseyNumber: p.membership.jerseyNumber,
          state: st.state,
          hint: st.hint,
        };
      }),
  }));

  return {
    ...demand,
    guests: guests.map((g) => ({
      personId: g.personId,
      name: `${g.firstName} ${g.lastName}`,
      fromTeam: (g.fromTeamId && badgeOf.get(g.fromTeamId)) || '',
      status: g.status,
      canWithdraw: demand.mine || mine.some((t) => t.id === g.fromTeamId),
    })),
    availability,
    candidates,
  };
}

// ── Bedarf melden ───────────────────────────────────────────────────────────

export async function createDemand(
  db: Db,
  actor: Actor,
  input: CreateDemandInput,
  now: Date,
): Promise<DemandDetail> {
  const teams = await currentTeams(db, actor);
  const mine = requireExchange(actor, teams);
  const team = mine.find((t) => t.id === input.teamId);
  if (!team) throw forbidden('Für diese Mannschaft darfst du keinen Spielerbedarf melden.');

  const [event] = await db
    .select()
    .from(s.events)
    .where(
      and(
        eq(s.events.id, input.eventId),
        eq(s.events.teamId, team.id),
        eq(s.events.clubId, actor.club.id),
      ),
    );
  if (!event)
    throw new HttpError(400, 'invalid_event', 'Der Termin gehört nicht zu dieser Mannschaft.');
  if (event.status !== 'scheduled' || event.startsAt <= now) {
    throw new HttpError(
      400,
      'event_closed',
      'Für diesen Termin kann kein Bedarf mehr gemeldet werden.',
    );
  }
  const [existing] = await db
    .select({ id: s.playerDemands.id })
    .from(s.playerDemands)
    .where(and(eq(s.playerDemands.eventId, event.id), eq(s.playerDemands.status, 'open')));
  if (existing)
    throw new HttpError(
      409,
      'demand_exists',
      'Für diesen Termin gibt es bereits einen offenen Bedarf.',
    );

  const [created] = await db
    .insert(s.playerDemands)
    .values({
      clubId: actor.club.id,
      teamId: team.id,
      eventId: event.id,
      count: input.count,
      positions: input.positions ?? [],
      note: input.note?.trim() || null,
      createdByPersonId: actor.person.id,
      createdAt: now,
    })
    .returning();

  // Gezielt informieren: Trainerteams von Mannschaften, die für diesen Tag Spieler angeboten haben
  const day = toIsoDate(calendarDayOf(event.startsAt, actor.club.timezone));
  const offering = await db
    .select({ teamId: s.playerOffers.teamId })
    .from(s.playerOffers)
    .where(
      and(
        eq(s.playerOffers.clubId, actor.club.id),
        eq(s.playerOffers.day, day),
        eq(s.playerOffers.status, 'open'),
        ne(s.playerOffers.teamId, team.id),
      ),
    );
  if (offering.length) {
    const coaches = await db
      .select({ personId: s.teamMemberships.personId })
      .from(s.teamMemberships)
      .where(
        and(
          inArray(
            s.teamMemberships.teamId,
            offering.map((o) => o.teamId),
          ),
          inArray(s.teamMemberships.function, ['coach', 'assistant_coach']),
        ),
      );
    const recipients = await recipientsFor(
      db,
      [...new Set(coaches.map((c) => c.personId))],
      actor.user.id,
    );
    await notify(
      db,
      actor,
      recipients,
      {
        level: 'action',
        topic: 'exchange',
        title: `Spielerbedarf: ${team.badge} sucht ${input.count} ${input.count === 1 ? 'Spieler' : 'Spieler'}`,
        body: `${event.title} – dein Team hat Spieler für diesen Tag angeboten.`,
        link: `/exchange/${created!.id}`,
      },
      now,
    );
  }
  return getDemand(db, actor, created!.id, now);
}

export async function cancelDemand(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  const teams = await currentTeams(db, actor);
  const mine = requireExchange(actor, teams);
  const [row] = await db
    .select()
    .from(s.playerDemands)
    .where(and(eq(s.playerDemands.id, id), eq(s.playerDemands.clubId, actor.club.id)));
  if (!row || !mine.some((t) => t.id === row.teamId)) throw notFound('Der Bedarf');

  const guests = await db
    .select({ personId: s.eventParticipants.personId })
    .from(s.eventParticipants)
    .where(eq(s.eventParticipants.demandId, id));
  await db.transaction(async (tx) => {
    await tx.update(s.playerDemands).set({ status: 'cancelled' }).where(eq(s.playerDemands.id, id));
    await tx.delete(s.eventParticipants).where(eq(s.eventParticipants.demandId, id));
  });
  const recipients = await recipientsFor(
    db,
    guests.map((g) => g.personId),
    actor.user.id,
  );
  await notify(
    db,
    actor,
    recipients,
    {
      level: 'important',
      topic: 'exchange',
      title: 'Gastspieleinsatz entfällt',
      body: 'Der Spielerbedarf wurde zurückgezogen – du musst nicht aushelfen.',
      link: '/notifications',
    },
    now,
  );
}

// ── Spieler nominieren ──────────────────────────────────────────────────────

export async function nominate(
  db: Db,
  actor: Actor,
  demandId: string,
  input: { personId: string; fromTeamId: string },
  now: Date,
): Promise<DemandDetail> {
  const teams = await currentTeams(db, actor);
  const mine = requireExchange(actor, teams);
  const fromTeam = mine.find((t) => t.id === input.fromTeamId);
  if (!fromTeam) throw forbidden('Du kannst nur Spieler deiner eigenen Mannschaften abstellen.');

  const { demands, rows } = await loadDemands(db, actor, teams, now, demandId);
  const demand = demands[0];
  const row = rows[0];
  if (!demand || !row) throw notFound('Der Bedarf');
  if (demand.team.id === fromTeam.id) {
    throw new HttpError(
      400,
      'own_team',
      'Spieler der eigenen Mannschaft brauchen keinen Gastspieleinsatz.',
    );
  }

  const day = toIsoDate(calendarDayOf(row.event.startsAt, actor.club.timezone));
  const players = await activePlayers(db, [fromTeam.id], day);
  const player = players.find((p) => p.person.id === input.personId);
  if (!player)
    throw new HttpError(400, 'invalid_player', 'Der Spieler gehört nicht zu deiner Mannschaft.');

  const states = await playerStates(db, actor, row.event, [input.personId]);
  const st = states.get(input.personId)!;
  if (st.state === 'nominated')
    throw new HttpError(409, 'already_nominated', 'Der Spieler ist bereits eingetragen.');
  if (st.state === 'absent')
    throw new HttpError(
      409,
      'player_absent',
      `${player.person.firstName} ist an diesem Tag abwesend.`,
    );
  if (st.state === 'busy')
    throw new HttpError(
      409,
      'player_busy',
      `${player.person.firstName} ist zur selben Zeit anderweitig im Einsatz.`,
    );

  await db.transaction(async (tx) => {
    // Bedarf sperren, damit nie mehr Spieler als benötigt nominiert werden
    await tx
      .select({ id: s.playerDemands.id })
      .from(s.playerDemands)
      .where(eq(s.playerDemands.id, demandId))
      .for('update');
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(s.eventParticipants)
      .where(and(eq(s.eventParticipants.demandId, demandId), ne(s.eventParticipants.status, 'no')));
    if (Number(n) >= demand.count)
      throw new HttpError(409, 'demand_filled', 'Der Bedarf ist bereits gedeckt.');
    await tx.insert(s.eventParticipants).values({
      clubId: actor.club.id,
      eventId: row.event.id,
      personId: input.personId,
      role: 'guest_player',
      status: 'pending',
      guestFromTeamId: fromTeam.id,
      demandId,
      createdAt: now,
    });
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'guest.nominated',
      entityType: 'player_demand',
      entityId: demandId,
      data: { personId: input.personId, fromTeam: fromTeam.badge, toTeam: demand.team.badge },
      createdAt: now,
    });
  });

  // Spieler (und Eltern) informieren, dann das anfragende Trainerteam
  const playerRecipients = await recipientsFor(db, [input.personId], actor.user.id);
  await notify(
    db,
    actor,
    playerRecipients,
    {
      level: 'important',
      topic: 'exchange',
      title: `Du wurdest als Gastspieler vorgemerkt`,
      body: `${demand.team.badge}: ${row.event.title} – bitte gib Bescheid, ob du kannst.`,
      link: `/events/${row.event.id}`,
    },
    now,
  );
  const requesters = await db
    .select({ personId: s.teamMemberships.personId })
    .from(s.teamMemberships)
    .where(
      and(
        eq(s.teamMemberships.teamId, demand.team.id),
        inArray(s.teamMemberships.function, ['coach', 'assistant_coach']),
      ),
    );
  await notify(
    db,
    actor,
    await recipientsFor(
      db,
      requesters.map((r) => r.personId),
      actor.user.id,
    ),
    {
      level: 'info',
      topic: 'exchange',
      title: `${fromTeam.badge} stellt ${player.person.firstName} ${player.person.lastName} ab`,
      body: `Für ${row.event.title}. Der Spieler muss noch zusagen.`,
      link: `/exchange/${demandId}`,
    },
    now,
  );
  return getDemand(db, actor, demandId, now);
}

export async function withdrawNomination(
  db: Db,
  actor: Actor,
  demandId: string,
  personId: string,
  now: Date,
): Promise<DemandDetail> {
  const teams = await currentTeams(db, actor);
  const mine = requireExchange(actor, teams);
  const [row] = await db
    .select({ participant: s.eventParticipants, demand: s.playerDemands })
    .from(s.eventParticipants)
    .innerJoin(s.playerDemands, eq(s.playerDemands.id, s.eventParticipants.demandId))
    .where(
      and(
        eq(s.eventParticipants.demandId, demandId),
        eq(s.eventParticipants.personId, personId),
        eq(s.playerDemands.clubId, actor.club.id),
      ),
    );
  if (!row) throw notFound('Die Nominierung');
  const allowed =
    mine.some((t) => t.id === row.demand.teamId) ||
    mine.some((t) => t.id === row.participant.guestFromTeamId);
  if (!allowed) throw notFound('Die Nominierung');

  await db.delete(s.eventParticipants).where(eq(s.eventParticipants.id, row.participant.id));
  await notify(
    db,
    actor,
    await recipientsFor(db, [personId], actor.user.id),
    {
      level: 'important',
      topic: 'exchange',
      title: 'Gastspieleinsatz entfällt',
      body: 'Dein Trainerteam hat die Nominierung zurückgenommen.',
      link: '/notifications',
    },
    now,
  );
  return getDemand(db, actor, demandId, now);
}

// ── Angebote ────────────────────────────────────────────────────────────────

export async function createOffer(
  db: Db,
  actor: Actor,
  input: CreateOfferInput,
  now: Date,
): Promise<ExchangeOverview> {
  const teams = await currentTeams(db, actor);
  const mine = requireExchange(actor, teams);
  const team = mine.find((t) => t.id === input.teamId);
  if (!team) throw forbidden('Für diese Mannschaft darfst du keine Spieler anbieten.');
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  if (input.day < today) throw new HttpError(400, 'in_past', 'Der Tag liegt in der Vergangenheit.');
  await db.insert(s.playerOffers).values({
    clubId: actor.club.id,
    teamId: team.id,
    day: input.day,
    count: input.count,
    note: input.note?.trim() || null,
    createdByPersonId: actor.person.id,
    createdAt: now,
  });
  return getOverview(db, actor, now);
}

export async function deleteOffer(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<ExchangeOverview> {
  const teams = await currentTeams(db, actor);
  const mine = requireExchange(actor, teams);
  const [offer] = await db
    .select()
    .from(s.playerOffers)
    .where(and(eq(s.playerOffers.id, id), eq(s.playerOffers.clubId, actor.club.id)));
  if (!offer || !mine.some((t) => t.id === offer.teamId)) throw notFound('Das Angebot');
  await db.delete(s.playerOffers).where(eq(s.playerOffers.id, id));
  return getOverview(db, actor, now);
}
