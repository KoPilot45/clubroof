/**
 * Mannschaften verwalten und Saisonwechsel (Konzept §6–8, Mappe S. 10).
 *
 *  - Mannschaften anlegen/bearbeiten: `teams.manage` für den Bereich bzw. die Mannschaft
 *    (Sportliche Leitung vereinsweit, Jugendleitung für die Jugend). Neue Mannschaften erhalten die
 *    Module ihrer Vorlage.
 *  - Saisonwechsel (nur `teams.season.plan` auf Vereinsebene):
 *    1. „Vorbereiten“ legt die Folgesaison an und kopiert alle Mannschaften mit Modulen, Fristen,
 *       Trainerteams und Zusatzaufgaben (z. B. Kassenwart), auf Wunsch auch die Spieler.
 *       Bis zum Start kann alles angepasst werden; die laufende Saison bleibt unverändert.
 *    2. „Starten“ macht die Folgesaison zur laufenden. Mannschaftskasse und Mannschaftsdokumente
 *       gehen auf die Nachfolgemannschaft über, alte Zuordnungen und Aufgaben enden.
 */
import {
  addDays,
  calendarDayOf,
  can,
  scopesWith,
  templateModules,
  toIsoDate,
  type AdminTeam,
  type PrepareSeasonInput,
  type SeasonInfo,
  type TeamAdminOverview,
  type TeamDetailAdmin,
  type TeamInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gt, gte, inArray, isNull, max, ne, notInArray, or, sql } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { teamModules } from './modules';

type SeasonRow = typeof s.seasons.$inferSelect;
type TeamRow = typeof s.teams.$inferSelect;

const target = (t: { id: string; orgUnitId: string }) => ({ teamId: t.id, orgUnitId: t.orgUnitId });
const todayIso = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));
const toSeason = (r: SeasonRow): SeasonInfo => ({
  id: r.id,
  name: r.name,
  startsOn: r.startsOn,
  endsOn: r.endsOn,
  isCurrent: r.isCurrent,
});

function requireTeamAdmin(actor: Actor) {
  const scopes = scopesWith(actor.grants, 'teams.manage');
  const any = scopes.all || scopes.orgUnitIds.length > 0 || scopes.teamIds.length > 0;
  if (!any && !actorCan(actor, 'teams.season.plan'))
    throw forbidden('Mannschaften verwalten Sportliche Leitung und Jugendleitung.');
}

function requireSeasonPlanner(actor: Actor) {
  if (!actorCan(actor, 'teams.season.plan'))
    throw forbidden('Den Saisonwechsel steuert die Sportliche Leitung.');
}

async function seasons(
  db: Db,
  actor: Actor,
): Promise<{ current: SeasonRow; next: SeasonRow | null }> {
  const rows = await db
    .select()
    .from(s.seasons)
    .where(eq(s.seasons.clubId, actor.club.id))
    .orderBy(asc(s.seasons.startsOn));
  const current = rows.find((r) => r.isCurrent);
  if (!current) throw new HttpError(409, 'no_season', 'Es ist keine laufende Saison eingerichtet.');
  const next = rows.find((r) => !r.isCurrent && r.startsOn > current.startsOn) ?? null;
  return { current, next };
}

async function audit(
  db: Db | Parameters<Parameters<Db['transaction']>[0]>[0],
  actor: Actor,
  action: string,
  label: string,
  now: Date,
  entityId?: string,
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: 'team',
    entityId: entityId ?? null,
    data: { label },
    createdAt: now,
  });
}

async function teamsOf(db: Db, actor: Actor, seasonId: string, now: Date): Promise<AdminTeam[]> {
  const today = todayIso(actor, now);
  const [teams, units, counts] = await Promise.all([
    db
      .select()
      .from(s.teams)
      .where(and(eq(s.teams.clubId, actor.club.id), eq(s.teams.seasonId, seasonId)))
      .orderBy(asc(s.teams.sortOrder)),
    db.select().from(s.orgUnits).where(eq(s.orgUnits.clubId, actor.club.id)),
    db
      .select({
        teamId: s.teamMemberships.teamId,
        fn: s.teamMemberships.function,
        n: sql<number>`count(distinct ${s.teamMemberships.personId})::int`,
      })
      .from(s.teamMemberships)
      .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
      .where(
        and(
          eq(s.teams.seasonId, seasonId),
          or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
        ),
      )
      .groupBy(s.teamMemberships.teamId, s.teamMemberships.function),
  ]);
  return teams.map((t) => {
    const own = counts.filter((c) => c.teamId === t.id);
    return {
      id: t.id,
      name: t.name,
      badge: t.badge,
      ageGroup: t.ageGroup,
      league: t.league,
      template: t.template,
      participationMode: t.participationMode,
      orgUnit: { id: t.orgUnitId, name: units.find((u) => u.id === t.orgUnitId)?.name ?? '' },
      seasonId: t.seasonId,
      players: own.filter((c) => c.fn === 'player').reduce((a, c) => a + c.n, 0),
      staff: own.filter((c) => c.fn !== 'player').reduce((a, c) => a + c.n, 0),
      canManage: can(actor.grants, 'teams.manage', target(t)),
    };
  });
}

export async function getTeamAdmin(db: Db, actor: Actor, now: Date): Promise<TeamAdminOverview> {
  requireTeamAdmin(actor);
  const { current, next } = await seasons(db, actor);
  const units = await db
    .select()
    .from(s.orgUnits)
    .where(eq(s.orgUnits.clubId, actor.club.id))
    .orderBy(asc(s.orgUnits.sortOrder));
  return {
    current: toSeason(current),
    next: next ? toSeason(next) : null,
    teams: await teamsOf(db, actor, current.id, now),
    nextTeams: next ? await teamsOf(db, actor, next.id, now) : [],
    orgUnits: units.map((u) => ({
      id: u.id,
      name: u.name,
      canManage: can(actor.grants, 'teams.manage', { orgUnitId: u.id }),
    })),
  };
}

async function loadTeam(db: Db, actor: Actor, id: string): Promise<TeamRow> {
  const [team] = await db
    .select()
    .from(s.teams)
    .where(and(eq(s.teams.id, id), eq(s.teams.clubId, actor.club.id)));
  if (!team) throw notFound('Die Mannschaft');
  return team;
}

export async function getTeamAdminDetail(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<TeamDetailAdmin> {
  requireTeamAdmin(actor);
  const team = await loadTeam(db, actor, id);
  const list = await teamsOf(db, actor, team.seasonId, now);
  return { ...list.find((t) => t.id === id)!, modules: await teamModules(db, actor, id) };
}

async function checkBadge(db: Db, seasonId: string, badge: string, exceptId?: string) {
  const [clash] = await db
    .select({ id: s.teams.id })
    .from(s.teams)
    .where(
      and(
        eq(s.teams.seasonId, seasonId),
        sql`lower(${s.teams.badge}) = lower(${badge})`,
        exceptId ? ne(s.teams.id, exceptId) : undefined,
      ),
    );
  if (clash)
    throw new HttpError(409, 'badge_taken', `Das Kürzel „${badge}“ ist in dieser Saison vergeben.`);
}

export async function createTeam(
  db: Db,
  actor: Actor,
  input: TeamInput,
  now: Date,
): Promise<TeamDetailAdmin> {
  const { current, next } = await seasons(db, actor);
  const seasonId = input.seasonId ?? current.id;
  if (seasonId !== current.id && seasonId !== next?.id)
    throw new HttpError(
      400,
      'invalid_season',
      'Mannschaften gibt es nur in der laufenden oder nächsten Saison.',
    );
  const [unit] = await db
    .select()
    .from(s.orgUnits)
    .where(and(eq(s.orgUnits.id, input.orgUnitId), eq(s.orgUnits.clubId, actor.club.id)));
  if (!unit) throw new HttpError(400, 'invalid_unit', 'Unbekannter Bereich.');
  if (!can(actor.grants, 'teams.manage', { orgUnitId: unit.id }))
    throw forbidden('In diesem Bereich darfst du keine Mannschaften anlegen.');
  await checkBadge(db, seasonId, input.badge.trim());

  const [{ last } = { last: 0 }] = await db
    .select({ last: max(s.teams.sortOrder) })
    .from(s.teams)
    .where(eq(s.teams.seasonId, seasonId));
  const id = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(s.teams)
      .values({
        clubId: actor.club.id,
        orgUnitId: unit.id,
        seasonId,
        name: input.name.trim(),
        badge: input.badge.trim(),
        ageGroup: input.ageGroup?.trim() || null,
        league: input.league?.trim() || null,
        template: input.template,
        participationMode: input.participationMode,
        sortOrder: (last ?? 0) + 1,
      })
      .returning({ id: s.teams.id });
    const modules = templateModules(input.template);
    if (modules.length) {
      await tx.insert(s.moduleSettings).values(
        modules.map((m) => ({
          clubId: actor.club.id,
          scopeType: 'team' as const,
          scopeId: team!.id,
          moduleKey: m.moduleKey,
          state: m.state,
          level: m.level,
          config: m.config,
        })),
      );
    }
    await audit(
      tx,
      actor,
      'team.created',
      `Mannschaft angelegt: ${input.badge.trim()} · ${input.name.trim()}`,
      now,
      team!.id,
    );
    return team!.id;
  });
  return getTeamAdminDetail(db, actor, id, now);
}

export async function updateTeam(
  db: Db,
  actor: Actor,
  id: string,
  input: Partial<Omit<TeamInput, 'seasonId' | 'orgUnitId'>>,
  now: Date,
): Promise<TeamDetailAdmin> {
  const team = await loadTeam(db, actor, id);
  if (!can(actor.grants, 'teams.manage', target(team)))
    throw forbidden('Diese Mannschaft darfst du nicht bearbeiten.');
  if (input.badge !== undefined) await checkBadge(db, team.seasonId, input.badge.trim(), id);
  const patch: Partial<typeof s.teams.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.badge !== undefined) patch.badge = input.badge.trim();
  if (input.ageGroup !== undefined) patch.ageGroup = input.ageGroup?.trim() || null;
  if (input.league !== undefined) patch.league = input.league?.trim() || null;
  if (input.template !== undefined) patch.template = input.template;
  if (input.participationMode !== undefined) patch.participationMode = input.participationMode;
  if (Object.keys(patch).length) {
    await db.update(s.teams).set(patch).where(eq(s.teams.id, id));
    await audit(
      db,
      actor,
      'team.updated',
      `Mannschaft geändert: ${patch.badge ?? team.badge}`,
      now,
      id,
    );
  }
  return getTeamAdminDetail(db, actor, id, now);
}

export async function deleteTeam(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  const team = await loadTeam(db, actor, id);
  if (!can(actor.grants, 'teams.manage', target(team)))
    throw forbidden('Diese Mannschaft darfst du nicht löschen.');
  const [[events], [members], [accounts]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.events)
      .where(eq(s.events.teamId, id)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.teamMemberships)
      .where(eq(s.teamMemberships.teamId, id)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.cashAccounts)
      .where(eq(s.cashAccounts.teamId, id)),
  ]);
  if (events!.n > 0 || members!.n > 0 || accounts!.n > 0) {
    throw new HttpError(
      409,
      'team_in_use',
      'Die Mannschaft hat bereits Mitglieder, Termine oder eine Kasse und kann nicht gelöscht werden.',
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(s.moduleSettings)
      .where(and(eq(s.moduleSettings.scopeType, 'team'), eq(s.moduleSettings.scopeId, id)));
    await tx
      .delete(s.roleAssignments)
      .where(and(eq(s.roleAssignments.scopeType, 'team'), eq(s.roleAssignments.scopeId, id)));
    await tx.delete(s.teams).where(eq(s.teams.id, id));
    await audit(
      tx,
      actor,
      'team.deleted',
      `Mannschaft gelöscht: ${team.badge} · ${team.name}`,
      now,
      id,
    );
  });
}

// ── Saisonwechsel ────────────────────────────────────────────────────────────

function nextSeasonDates(current: SeasonRow) {
  const startYear = Number(current.startsOn.slice(0, 4)) + 1;
  const shift = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
  return {
    name: `${startYear}/${String(startYear + 1).slice(2)}`,
    startsOn: shift(current.startsOn),
    endsOn: shift(current.endsOn),
  };
}

export async function prepareSeason(
  db: Db,
  actor: Actor,
  input: PrepareSeasonInput,
  now: Date,
): Promise<TeamAdminOverview> {
  requireSeasonPlanner(actor);
  const { current, next } = await seasons(db, actor);
  if (next)
    throw new HttpError(409, 'season_exists', `Die Saison ${next.name} ist bereits vorbereitet.`);
  const dates = nextSeasonDates(current);
  const today = todayIso(actor, now);

  await db.transaction(async (tx) => {
    const [season] = await tx
      .insert(s.seasons)
      .values({ clubId: actor.club.id, ...dates, isCurrent: false })
      .returning();
    const oldTeams = await tx
      .select()
      .from(s.teams)
      .where(eq(s.teams.seasonId, current.id))
      .orderBy(asc(s.teams.sortOrder));
    const map = new Map<string, string>();
    for (const t of oldTeams) {
      const [copy] = await tx
        .insert(s.teams)
        .values({
          clubId: t.clubId,
          orgUnitId: t.orgUnitId,
          seasonId: season!.id,
          name: t.name,
          badge: t.badge,
          ageGroup: t.ageGroup,
          league: t.league,
          template: t.template,
          participationMode: t.participationMode,
          sortOrder: t.sortOrder,
          previousTeamId: t.id,
        })
        .returning({ id: s.teams.id });
      map.set(t.id, copy!.id);
    }
    const oldIds = [...map.keys()];
    if (oldIds.length === 0) return;

    const [modules, rules, memberships, assignments] = await Promise.all([
      tx
        .select()
        .from(s.moduleSettings)
        .where(
          and(eq(s.moduleSettings.scopeType, 'team'), inArray(s.moduleSettings.scopeId, oldIds)),
        ),
      tx.select().from(s.teamDeadlineRules).where(inArray(s.teamDeadlineRules.teamId, oldIds)),
      tx
        .select()
        .from(s.teamMemberships)
        .where(
          and(
            inArray(s.teamMemberships.teamId, oldIds),
            or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
          ),
        ),
      tx
        .select()
        .from(s.roleAssignments)
        .where(
          and(eq(s.roleAssignments.scopeType, 'team'), inArray(s.roleAssignments.scopeId, oldIds)),
        ),
    ]);
    if (modules.length) {
      await tx.insert(s.moduleSettings).values(
        modules.map(({ id: _id, createdAt: _c, updatedAt: _u, ...m }) => ({
          ...m,
          scopeId: map.get(m.scopeId!)!,
        })),
      );
    }
    if (rules.length) {
      await tx
        .insert(s.teamDeadlineRules)
        .values(rules.map(({ id: _id, ...r }) => ({ ...r, teamId: map.get(r.teamId)! })));
    }
    const carried = memberships.filter((m) => input.copyPlayers || m.function !== 'player');
    if (carried.length) {
      await tx
        .insert(s.teamMemberships)
        .values(
          carried.map(({ id: _id, createdAt: _c, ...m }) => ({
            ...m,
            teamId: map.get(m.teamId)!,
            validFrom: dates.startsOn,
            validTo: null,
          })),
        )
        .onConflictDoNothing();
    }
    if (assignments.length) {
      await tx.insert(s.roleAssignments).values(
        assignments.map(({ id: _id, createdAt: _c, ...a }) => ({
          ...a,
          scopeId: map.get(a.scopeId!)!,
        })),
      );
    }
    await audit(
      tx,
      actor,
      'season.prepared',
      `Saison ${dates.name} vorbereitet (${oldIds.length} Mannschaften${input.copyPlayers ? ', mit Spielern' : ', Trainerteams'})`,
      now,
    );
  });
  return getTeamAdmin(db, actor, now);
}

export async function startSeason(
  db: Db,
  actor: Actor,
  seasonId: string,
  now: Date,
): Promise<TeamAdminOverview> {
  requireSeasonPlanner(actor);
  const { current, next } = await seasons(db, actor);
  if (!next || next.id !== seasonId)
    throw new HttpError(
      409,
      'not_prepared',
      'Diese Saison ist nicht als nächste Saison vorbereitet.',
    );
  const today = todayIso(actor, now);
  const yesterday = toIsoDate(addDays(calendarDayOf(now, actor.club.timezone), -1));

  await db.transaction(async (tx) => {
    const newTeams = await tx.select().from(s.teams).where(eq(s.teams.seasonId, next.id));
    const oldTeams = await tx
      .select({ id: s.teams.id })
      .from(s.teams)
      .where(eq(s.teams.seasonId, current.id));
    const oldIds = oldTeams.map((t) => t.id);

    for (const t of newTeams) {
      if (!t.previousTeamId) continue;
      // Kasse samt persönlicher Konten und Mannschaftsdokumente gehen auf die Nachfolgemannschaft über
      const [hasAccount] = await tx
        .select({ id: s.cashAccounts.id })
        .from(s.cashAccounts)
        .where(eq(s.cashAccounts.teamId, t.id));
      if (!hasAccount) {
        await tx
          .update(s.cashAccounts)
          .set({ teamId: t.id })
          .where(eq(s.cashAccounts.teamId, t.previousTeamId));
      }
      await tx
        .update(s.documents)
        .set({ scopeId: t.id })
        .where(and(eq(s.documents.scopeType, 'team'), eq(s.documents.scopeId, t.previousTeamId)));
    }

    if (oldIds.length) {
      // Alte Zuordnungen enden gestern; Aufgaben für alte Mannschaften entfallen
      await tx
        .update(s.teamMemberships)
        .set({ validTo: yesterday })
        .where(
          and(
            inArray(s.teamMemberships.teamId, oldIds),
            or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
          ),
        );
      await tx
        .delete(s.roleAssignments)
        .where(
          and(eq(s.roleAssignments.scopeType, 'team'), inArray(s.roleAssignments.scopeId, oldIds)),
        );
    }
    // Startet die Saison vor dem offiziellen Termin, gelten die neuen Zuordnungen ab heute
    const newIds = newTeams.map((t) => t.id);
    if (newIds.length) {
      await tx
        .update(s.teamMemberships)
        .set({ validFrom: today })
        .where(
          and(
            inArray(s.teamMemberships.teamId, newIds),
            sql`${s.teamMemberships.validFrom} > ${today}`,
          ),
        );
    }
    // Künftige Termine wandern mit; Teilnehmerlisten folgen dem neuen Kader (Gastspieler bleiben)
    for (const t of newTeams) {
      if (!t.previousTeamId) continue;
      const moved = await tx
        .update(s.events)
        .set({ teamId: t.id })
        .where(and(eq(s.events.teamId, t.previousTeamId), gt(s.events.startsAt, now)))
        .returning({ id: s.events.id, status: s.events.status });
      // Offener Spielerbedarf und Angebote der Gastspielerbörse gehören ebenfalls zur Nachfolgemannschaft
      await tx
        .update(s.playerDemands)
        .set({ teamId: t.id })
        .where(eq(s.playerDemands.teamId, t.previousTeamId));
      await tx
        .update(s.playerOffers)
        .set({ teamId: t.id })
        .where(eq(s.playerOffers.teamId, t.previousTeamId));
      const scheduled = moved.filter((e) => e.status === 'scheduled').map((e) => e.id);
      if (scheduled.length === 0) continue;
      const members = await tx
        .select({ personId: s.teamMemberships.personId, fn: s.teamMemberships.function })
        .from(s.teamMemberships)
        .where(and(eq(s.teamMemberships.teamId, t.id), isNull(s.teamMemberships.validTo)));
      const memberIds = [...new Set(members.map((m) => m.personId))];
      await tx
        .delete(s.eventParticipants)
        .where(
          and(
            inArray(s.eventParticipants.eventId, scheduled),
            inArray(s.eventParticipants.role, ['player', 'coach']),
            memberIds.length ? notInArray(s.eventParticipants.personId, memberIds) : undefined,
          ),
        );
      if (memberIds.length) {
        const isPlayer = (id: string) =>
          members.some((m) => m.personId === id && m.fn === 'player');
        await tx
          .insert(s.eventParticipants)
          .values(
            scheduled.flatMap((eventId) =>
              memberIds.map((personId) => ({
                clubId: actor.club.id,
                eventId,
                personId,
                role: isPlayer(personId) ? ('player' as const) : ('coach' as const),
                status:
                  isPlayer(personId) && t.participationMode === 'active_response'
                    ? ('pending' as const)
                    : ('yes' as const),
              })),
            ),
          )
          .onConflictDoNothing();
      }
    }

    await tx.update(s.seasons).set({ isCurrent: false }).where(eq(s.seasons.id, current.id));
    await tx.update(s.seasons).set({ isCurrent: true }).where(eq(s.seasons.id, next.id));
    await audit(tx, actor, 'season.started', `Saison ${next.name} gestartet`, now);
  });
  return getTeamAdmin(db, actor, now);
}
