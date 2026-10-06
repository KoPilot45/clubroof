/**
 * Module und Update-Center (Konzept §8, §13).
 *  - Vereinsebene: Module ein-/ausschalten, neue Module „Einrichten / Später / Nicht verwenden“.
 *    Recht: `club.modules.manage`. Kernmodule sind immer aktiv.
 *  - Bereichsebene: Vorgabe für alle Mannschaften eines Bereichs (z. B. Jugend ohne Strafenkatalog);
 *    Recht `teams.manage` für den Bereich oder `club.modules.manage`.
 *  - Mannschaftsebene: Mannschaftsmodule (Statistik, Kasse …) je Mannschaft; Recht `teams.manage`
 *    für die Mannschaft oder `club.modules.manage`. Ist ein Modul im Verein aus, bleibt es in allen
 *    Mannschaften aus (Vererbung, siehe `resolveModule`).
 */
import {
  MODULES,
  can,
  resolveModule,
  type ModuleDecision,
  type ModuleDefinition,
  type ModuleEntry,
  type ModuleOverview,
  type ModuleSetting,
  type TeamModule,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, isNull } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';

const LATER_DAYS = 14;
const DEFS: readonly ModuleDefinition[] = MODULES;

type SettingRow = typeof s.moduleSettings.$inferSelect;

async function loadSettings(db: Db, actor: Actor): Promise<SettingRow[]> {
  return db.select().from(s.moduleSettings).where(eq(s.moduleSettings.clubId, actor.club.id));
}

const asSetting = (r: SettingRow): ModuleSetting => ({
  moduleKey: r.moduleKey,
  scopeType: r.scopeType,
  scopeId: r.scopeId,
  state: r.state,
  level: r.level,
  config: r.config,
});

function requireModuleAdmin(actor: Actor) {
  if (!actorCan(actor, 'club.modules.manage'))
    throw forbidden('Module verwaltet die Vereinsadministration.');
}

async function audit(
  db: Db,
  actor: Actor,
  label: string,
  now: Date,
  data: Record<string, unknown>,
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'module.changed',
    entityType: 'module_settings',
    data: { ...data, label },
    createdAt: now,
  });
}

export async function getModuleOverview(db: Db, actor: Actor, now: Date): Promise<ModuleOverview> {
  requireModuleAdmin(actor);
  const rows = await loadSettings(db, actor);
  const settings = rows.map(asSetting);
  const teams = await db
    .select({ id: s.teams.id, orgUnitId: s.teams.orgUnitId })
    .from(s.teams)
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(and(eq(s.teams.clubId, actor.club.id), eq(s.seasons.isCurrent, true)));

  const modules: ModuleEntry[] = DEFS.map((m) => {
    const club = rows.find((r) => r.moduleKey === m.key && r.scopeType === 'club');
    const snoozed = typeof club?.config.snoozedUntil === 'string' ? club.config.snoozedUntil : null;
    return {
      key: m.key,
      name: m.name,
      description: m.description,
      core: m.core === true,
      scopes: [...m.scopes],
      state: club ? club.state : 'new',
      declined: club?.config.declined === true,
      snoozedUntil: snoozed && new Date(snoozed) > now ? snoozed : null,
      enabledTeams: m.scopes.includes('team')
        ? teams.filter(
            (t) => resolveModule(settings, m.key, { teamId: t.id, orgUnitId: t.orgUnitId }).enabled,
          ).length
        : null,
    };
  });
  return {
    updates: modules.filter(
      (m) =>
        !m.core && m.state !== 'enabled' && m.state !== 'locked' && !m.declined && !m.snoozedUntil,
    ),
    modules,
  };
}

export async function decideModule(
  db: Db,
  actor: Actor,
  key: string,
  decision: ModuleDecision,
  now: Date,
): Promise<ModuleOverview> {
  requireModuleAdmin(actor);
  const def = DEFS.find((m) => m.key === key);
  if (!def) throw notFound('Das Modul');
  if (def.core && decision !== 'enable')
    throw new HttpError(409, 'core_module', 'Kernmodule sind immer aktiv.');

  const [existing] = await db
    .select()
    .from(s.moduleSettings)
    .where(
      and(
        eq(s.moduleSettings.clubId, actor.club.id),
        eq(s.moduleSettings.moduleKey, key),
        eq(s.moduleSettings.scopeType, 'club'),
        isNull(s.moduleSettings.scopeId),
      ),
    );
  const base = existing?.config ?? {};
  const { snoozedUntil: _s, declined: _d, ...rest } = base;
  void _s;
  void _d;
  const next =
    decision === 'enable'
      ? {
          state: 'enabled' as const,
          level: existing?.level === 'off' ? 'basic' : (existing?.level ?? 'basic'),
          config: rest,
        }
      : decision === 'disable'
        ? { state: 'available' as const, level: existing?.level ?? 'basic', config: rest }
        : decision === 'later'
          ? {
              state: 'available' as const,
              level: existing?.level ?? 'basic',
              config: {
                ...rest,
                snoozedUntil: new Date(now.getTime() + LATER_DAYS * 86_400_000).toISOString(),
              },
            }
          : {
              state: 'available' as const,
              level: existing?.level ?? 'basic',
              config: { ...rest, declined: true },
            };

  if (existing) {
    await db
      .update(s.moduleSettings)
      .set({ state: next.state, level: next.level, config: next.config })
      .where(eq(s.moduleSettings.id, existing.id));
  } else {
    await db.insert(s.moduleSettings).values({
      clubId: actor.club.id,
      scopeType: 'club',
      scopeId: null,
      moduleKey: key,
      state: next.state,
      level: next.level,
      config: next.config,
    });
  }
  const verb = {
    enable: 'aktiviert',
    disable: 'ausgeschaltet',
    later: 'auf später verschoben',
    decline: 'nicht verwendet',
  }[decision];
  await audit(db, actor, `Modul ${verb}: ${def.name}`, now, { module: key, decision });
  return getModuleOverview(db, actor, now);
}

// ── Mannschaftsmodule ──────────────────────────────────────────────────────

async function loadTeam(db: Db, actor: Actor, teamId: string) {
  const [team] = await db
    .select()
    .from(s.teams)
    .where(and(eq(s.teams.id, teamId), eq(s.teams.clubId, actor.club.id)));
  if (!team) throw notFound('Die Mannschaft');
  return team;
}

export const mayConfigureTeam = (actor: Actor, team: { id: string; orgUnitId: string }) =>
  can(actor.grants, 'teams.manage', { teamId: team.id, orgUnitId: team.orgUnitId }) ||
  can(actor.grants, 'teams.modules.manage', { teamId: team.id, orgUnitId: team.orgUnitId }) ||
  actorCan(actor, 'club.modules.manage');

export async function teamModules(db: Db, actor: Actor, teamId: string): Promise<TeamModule[]> {
  const team = await loadTeam(db, actor, teamId);
  const rows = await loadSettings(db, actor);
  const settings = rows.map(asSetting);
  return DEFS.filter((m) => !m.core && m.scopes.includes('team')).map((m) => {
    const own = rows.find(
      (r) => r.moduleKey === m.key && r.scopeType === 'team' && r.scopeId === team.id,
    );
    return {
      key: m.key,
      name: m.name,
      description: m.description,
      clubEnabled: resolveModule(settings, m.key).enabled,
      lockedBy: !resolveModule(settings, m.key).enabled
        ? ('club' as const)
        : !resolveModule(settings, m.key, { orgUnitId: team.orgUnitId }).enabled
          ? ('unit' as const)
          : null,
      enabled: resolveModule(settings, m.key, { teamId: team.id, orgUnitId: team.orgUnitId })
        .enabled,
      inherited: !own,
    };
  });
}

export async function setTeamModule(
  db: Db,
  actor: Actor,
  teamId: string,
  key: string,
  enabled: boolean,
  now: Date,
): Promise<TeamModule[]> {
  const team = await loadTeam(db, actor, teamId);
  if (!mayConfigureTeam(actor, team))
    throw forbidden('Diese Mannschaft darfst du nicht einstellen.');
  const def = DEFS.find((m) => m.key === key && !m.core && m.scopes.includes('team'));
  if (!def) throw notFound('Das Modul');
  const settings = (await loadSettings(db, actor)).map(asSetting);
  if (enabled && !resolveModule(settings, key).enabled) {
    throw new HttpError(409, 'club_disabled', `„${def.name}“ ist im Verein ausgeschaltet.`);
  }
  if (enabled && !resolveModule(settings, key, { orgUnitId: team.orgUnitId }).enabled) {
    throw new HttpError(409, 'unit_disabled', `„${def.name}“ ist im Bereich ausgeschaltet.`);
  }
  const [own] = await db
    .select()
    .from(s.moduleSettings)
    .where(
      and(
        eq(s.moduleSettings.moduleKey, key),
        eq(s.moduleSettings.scopeType, 'team'),
        eq(s.moduleSettings.scopeId, team.id),
      ),
    );
  const state = enabled ? ('enabled' as const) : ('available' as const);
  const level = enabled ? (own?.level && own.level !== 'off' ? own.level : 'basic') : 'off';
  if (own) {
    await db.update(s.moduleSettings).set({ state, level }).where(eq(s.moduleSettings.id, own.id));
  } else {
    await db.insert(s.moduleSettings).values({
      clubId: actor.club.id,
      scopeType: 'team',
      scopeId: team.id,
      moduleKey: key,
      state,
      level,
      config: {},
    });
  }
  await audit(
    db,
    actor,
    `${def.name} ${enabled ? 'aktiviert' : 'ausgeschaltet'}: ${team.badge}`,
    now,
    {
      module: key,
      teamId: team.id,
    },
  );
  return teamModules(db, actor, teamId);
}

// ── Bereichsmodule ─────────────────────────────────────────────────────────

async function loadUnit(db: Db, actor: Actor, unitId: string) {
  const [unit] = await db
    .select()
    .from(s.orgUnits)
    .where(and(eq(s.orgUnits.id, unitId), eq(s.orgUnits.clubId, actor.club.id)));
  if (!unit) throw notFound('Der Bereich');
  return unit;
}

const mayConfigureUnit = (actor: Actor, unitId: string) =>
  can(actor.grants, 'teams.manage', { orgUnitId: unitId }) ||
  actorCan(actor, 'club.modules.manage');

export async function unitModules(db: Db, actor: Actor, unitId: string): Promise<TeamModule[]> {
  const unit = await loadUnit(db, actor, unitId);
  if (!mayConfigureUnit(actor, unit.id))
    throw forbidden('Diesen Bereich darfst du nicht einstellen.');
  const rows = await loadSettings(db, actor);
  const settings = rows.map(asSetting);
  return DEFS.filter((m) => !m.core && m.scopes.includes('team')).map((m) => ({
    key: m.key,
    name: m.name,
    description: m.description,
    clubEnabled: resolveModule(settings, m.key).enabled,
    lockedBy: resolveModule(settings, m.key).enabled ? null : ('club' as const),
    enabled: resolveModule(settings, m.key, { orgUnitId: unit.id }).enabled,
    inherited: !rows.some(
      (r) => r.moduleKey === m.key && r.scopeType === 'org_unit' && r.scopeId === unit.id,
    ),
  }));
}

/** `enabled: null` übernimmt wieder die Vereinseinstellung. */
export async function setUnitModule(
  db: Db,
  actor: Actor,
  unitId: string,
  key: string,
  enabled: boolean | null,
  now: Date,
): Promise<TeamModule[]> {
  const unit = await loadUnit(db, actor, unitId);
  if (!mayConfigureUnit(actor, unit.id))
    throw forbidden('Diesen Bereich darfst du nicht einstellen.');
  const def = DEFS.find((m) => m.key === key && !m.core && m.scopes.includes('team'));
  if (!def) throw notFound('Das Modul');
  const settings = (await loadSettings(db, actor)).map(asSetting);
  if (enabled && !resolveModule(settings, key).enabled)
    throw new HttpError(409, 'club_disabled', `„${def.name}“ ist im Verein ausgeschaltet.`);
  const where = and(
    eq(s.moduleSettings.moduleKey, key),
    eq(s.moduleSettings.scopeType, 'org_unit'),
    eq(s.moduleSettings.scopeId, unit.id),
  );
  if (enabled === null) {
    await db.delete(s.moduleSettings).where(where);
  } else {
    const [own] = await db.select().from(s.moduleSettings).where(where);
    const state = enabled ? ('enabled' as const) : ('available' as const);
    const level = enabled ? 'basic' : 'off';
    if (own)
      await db
        .update(s.moduleSettings)
        .set({ state, level })
        .where(eq(s.moduleSettings.id, own.id));
    else
      await db.insert(s.moduleSettings).values({
        clubId: actor.club.id,
        scopeType: 'org_unit',
        scopeId: unit.id,
        moduleKey: key,
        state,
        level,
        config: {},
      });
  }
  await audit(
    db,
    actor,
    `${def.name} ${enabled === null ? 'wie Verein' : enabled ? 'aktiviert' : 'ausgeschaltet'}: ${unit.name}`,
    now,
    { module: key, orgUnitId: unit.id },
  );
  return unitModules(db, actor, unit.id);
}

/** Module einer Mannschaft für Trainerteam bzw. Verwaltung (Recht wie beim Einstellen). */
export async function teamModulesForCoach(
  db: Db,
  actor: Actor,
  teamId: string,
): Promise<TeamModule[]> {
  const team = await loadTeam(db, actor, teamId);
  if (!mayConfigureTeam(actor, team))
    throw forbidden('Die Module der Mannschaft stellt das Trainerteam ein.');
  return teamModules(db, actor, teamId);
}
