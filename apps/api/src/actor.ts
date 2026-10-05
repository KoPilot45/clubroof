/**
 * Der „Actor“ bündelt alles, was für Rechte- und Sichtbarkeitsentscheidungen über den
 * angemeldeten Nutzer bekannt sein muss: Verein, eigene Person, verwaltete Kinder,
 * Mannschaftszugehörigkeiten, Rollen und Modulkonfiguration.
 */
import {
  can,
  resolveModule,
  type Grant,
  type ManagedPerson,
  type ModuleSetting,
  type Permission,
  type TeamFunction,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { forbidden } from './errors';
import type { SessionUser } from './auth/session';
import type { LinkSigner } from './storage/files';

type TeamRow = typeof s.teams.$inferSelect;

export type Membership = {
  teamId: string;
  personId: string;
  function: TeamFunction;
  team: TeamRow;
};

export type Actor = {
  user: SessionUser;
  club: typeof s.clubs.$inferSelect;
  person: typeof s.persons.$inferSelect;
  managed: ManagedPerson[];
  managedIds: string[];
  memberships: Membership[];
  /** Mannschaften, in denen der Nutzer selbst oder ein Kind Mitglied ist */
  teamIds: string[];
  /** Bereiche dieser Mannschaften */
  orgUnitIds: string[];
  grants: (Grant & { key: string; name: string })[];
  modules: ModuleSetting[];
  /** Signiert Datei- und Bildlinks (Schlüssel der laufenden API-Instanz) */
  links: LinkSigner;
};

export async function loadActor(
  db: Db,
  user: SessionUser,
  now: Date,
  links: LinkSigner,
): Promise<Actor> {
  const [person] = await db.select().from(s.persons).where(eq(s.persons.userId, user.id)).limit(1);
  if (!person) throw forbidden('Dein Konto ist keinem Verein zugeordnet.');
  if (person.membershipStatus === 'left') throw forbidden('Deine Mitgliedschaft ist beendet.');

  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.id, person.clubId));
  if (!club) throw forbidden('Dein Konto ist keinem Verein zugeordnet.');

  const children = await db
    .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.guardianships)
    .innerJoin(s.persons, eq(s.persons.id, s.guardianships.childPersonId))
    .where(eq(s.guardianships.guardianPersonId, person.id))
    .orderBy(s.persons.birthDate);

  const managed: ManagedPerson[] = [
    { id: person.id, firstName: person.firstName, lastName: person.lastName, relation: 'self' },
    ...children.map((c) => ({ ...c, relation: 'child' as const })),
  ];
  const managedIds = managed.map((m) => m.id);
  const today = now.toISOString().slice(0, 10);

  const membershipRows = await db
    .select({ membership: s.teamMemberships, team: s.teams })
    .from(s.teamMemberships)
    .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(
      and(
        inArray(s.teamMemberships.personId, managedIds),
        eq(s.seasons.isCurrent, true),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    )
    .orderBy(s.teams.sortOrder);

  const memberships: Membership[] = membershipRows.map((r) => ({
    teamId: r.team.id,
    personId: r.membership.personId,
    function: r.membership.function,
    team: r.team,
  }));

  const grantRows = await db
    .select({
      key: s.roles.key,
      name: s.roles.name,
      permissions: s.roles.permissions,
      scopeType: s.roleAssignments.scopeType,
      scopeId: s.roleAssignments.scopeId,
    })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .where(eq(s.roleAssignments.personId, person.id));

  const modules = (await db
    .select({
      moduleKey: s.moduleSettings.moduleKey,
      scopeType: s.moduleSettings.scopeType,
      scopeId: s.moduleSettings.scopeId,
      state: s.moduleSettings.state,
      level: s.moduleSettings.level,
      config: s.moduleSettings.config,
    })
    .from(s.moduleSettings)
    .where(eq(s.moduleSettings.clubId, club.id))) as ModuleSetting[];

  return {
    user,
    club,
    person,
    managed,
    managedIds,
    memberships,
    teamIds: [...new Set(memberships.map((m) => m.teamId))],
    orgUnitIds: [...new Set(memberships.map((m) => m.team.orgUnitId))],
    grants: grantRows,
    modules,
    links,
  };
}

/** Rechteprüfung für eine Mannschaft (Bereich wird automatisch berücksichtigt). */
export function actorCan(
  actor: Actor,
  permission: Permission,
  team?: { id: string; orgUnitId: string } | null,
): boolean {
  return can(actor.grants, permission, team ? { teamId: team.id, orgUnitId: team.orgUnitId } : {});
}

export function moduleEnabled(
  actor: Actor,
  moduleKey: string,
  team?: { id: string; orgUnitId: string } | null,
): boolean {
  return resolveModule(
    actor.modules,
    moduleKey,
    team ? { teamId: team.id, orgUnitId: team.orgUnitId } : {},
  ).enabled;
}
