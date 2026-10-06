import {
  MODULES,
  type ColorMode,
  type MeResponse,
  type MyTeam,
  type TeamFunction,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, inArray } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { resolveMediaUrl } from '../storage/media-links';
import { loadScopeContext, targetsWith } from './scopes';
import { adminPermissions } from './admin';
import { newsPermissions } from './editorial';
import { canInvite } from './invitations';
import { twoFactorMissing } from './two-factor';

/** Rollen, die den Verwaltungsmodus öffnen (Trainer verwalten ihre Teams in der App selbst). */
const ADMIN_ROLES = new Set([
  'fulladmin',
  'board',
  'sports_director',
  'youth_director',
  'treasurer',
  'facility_manager',
  'member_admin',
  'referee_lead',
]);

export async function buildMe(db: Db, actor: Actor): Promise<MeResponse> {
  const ctx = await loadScopeContext(db, actor);
  const [userRow] = await db
    .select({ colorMode: s.users.colorMode })
    .from(s.users)
    .where(eq(s.users.id, actor.user.id));
  const colorMode: ColorMode =
    userRow?.colorMode === 'dark' || userRow?.colorMode === 'system' ? userRow.colorMode : 'light';
  const refereeModule = moduleEnabled(actor, 'referees');
  const isReferee =
    refereeModule &&
    (
      await db
        .select({ id: s.referees.personId })
        .from(s.referees)
        .where(and(inArray(s.referees.personId, actor.managedIds), eq(s.referees.active, true)))
        .limit(1)
    ).length > 0;
  const teams = new Map<string, MyTeam>();
  for (const m of actor.memberships) {
    const key = `${m.teamId}:${m.personId}`;
    const existing = teams.get(key);
    if (existing) {
      if (!existing.functions.includes(m.function)) existing.functions.push(m.function);
      continue;
    }
    teams.set(key, {
      id: m.team.id,
      name: m.team.name,
      badge: m.team.badge,
      ageGroup: m.team.ageGroup,
      league: m.team.league,
      participationMode: m.team.participationMode,
      personId: m.personId,
      functions: [m.function as TeamFunction],
      modules: MODULES.filter((mod) => moduleEnabled(actor, mod.key, m.team)).map((mod) => mod.key),
    });
  }

  return {
    user: {
      id: actor.user.id,
      email: actor.user.email,
      displayName: actor.user.displayName,
      colorMode,
    },
    person: {
      id: actor.person.id,
      firstName: actor.person.firstName,
      lastName: actor.person.lastName,
      avatarUrl: resolveMediaUrl(actor.links, actor.person.avatarUrl),
    },
    club: {
      id: actor.club.id,
      name: actor.club.name,
      shortName: actor.club.shortName,
      logoUrl: resolveMediaUrl(actor.links, actor.club.logoUrl),
      colorTheme: actor.club.colorTheme,
      colorMode: actor.club.colorMode,
      timezone: actor.club.timezone,
    },
    managedPersons: actor.managed,
    teams: [...teams.values()],
    roles: actor.grants.map((g) => ({
      key: g.key,
      name: g.name,
      scopeType: g.scopeType,
      scopeId: g.scopeId,
    })),
    canAdminister: actor.grants.some((g) => ADMIN_ROLES.has(g.key)),
    admin: adminPermissions(actor),
    news: newsPermissions(actor),
    create: {
      polls: targetsWith(actor, ctx, 'polls.manage'),
      documents: targetsWith(actor, ctx, 'documents.manage'),
    },
    canManageClub: actorCan(actor, 'club.settings.manage'),
    canInvite: canInvite(actor),
    security: {
      twoFactorEnabled: actor.user.twoFactorEnabled === true,
      twoFactorRequired: twoFactorMissing(actor),
    },
    referees: {
      manage: refereeModule && actorCan(actor, 'referees.manage'),
      active: isReferee,
    },
    equipment: { manage: actorCan(actor, 'facilities.manage') },
    clubModules: MODULES.filter((mod) => moduleEnabled(actor, mod.key)).map((mod) => mod.key),
  };
}

/** Persönliche Darstellung (hell, dunkel oder wie das Gerät). */
export async function setColorMode(
  db: Db,
  actor: Actor,
  colorMode: ColorMode,
): Promise<MeResponse> {
  await db.update(s.users).set({ colorMode }).where(eq(s.users.id, actor.user.id));
  return buildMe(db, actor);
}
