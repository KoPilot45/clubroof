import type { MeResponse, MyTeam, TeamFunction } from '@clubroof/core';
import type { Actor } from '../actor';

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

export function buildMe(actor: Actor): MeResponse {
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
    });
  }

  return {
    user: { id: actor.user.id, email: actor.user.email, displayName: actor.user.displayName },
    person: {
      id: actor.person.id,
      firstName: actor.person.firstName,
      lastName: actor.person.lastName,
    },
    club: {
      id: actor.club.id,
      name: actor.club.name,
      shortName: actor.club.shortName,
      logoUrl: actor.club.logoUrl,
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
  };
}
