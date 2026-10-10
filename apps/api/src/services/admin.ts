/**
 * Verwaltung (Mappe S. 8, Konzept §6–7): Mitglieder, Mannschaftszuordnung, Rollen/Zusatzaufgaben
 * und Audit-Log.
 *
 * Rechte (nur hier, serverseitig):
 *  - Mitglieder ansehen: `members.read` – auf Vereinsebene alle, sonst nur Mitglieder der
 *    Mannschaften im eigenen Geltungsbereich (z. B. Jugendleitung → Jugend) und deren Eltern.
 *  - Stammdaten, Ein-/Austritte, Mannschaftszuordnung: `members.manage` auf Vereinsebene.
 *  - Rollen vergeben: `club.roles.manage`. Niemand kann mehr Rechte vergeben, als er selbst auf
 *    Vereinsebene hat; der letzte Fulladmin kann nicht entfernt werden.
 *  - Audit-Log: `club.audit.read`.
 * Jede Änderung wird im Audit-Log festgehalten.
 */
import {
  SYSTEM_ROLES,
  TEAM_FUNCTIONS,
  addDays,
  calendarDayOf,
  isPermission,
  scopesWith,
  toIsoDate,
  type AddMembershipInput,
  type AdminOverview,
  type AdminPermissions,
  type AssignRoleInput,
  type SetIndividualPermissionsInput,
  type AuditEntry,
  type CreateMemberInput,
  type MemberDetail,
  type MemberListItem,
  type MemberRoleAssignment,
  type RoleCatalog,
  type TeamFunction,
  type UpdateMemberInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gt, gte, inArray, isNull, or } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';

type TeamRow = typeof s.teams.$inferSelect;

/** „B1 · B-Jugend“, aber „1. Mannschaft“ statt „1. · 1. Mannschaft“ */
const teamLabel = (t: { badge: string; name: string }) =>
  t.name.startsWith(t.badge) ? t.name : `${t.badge} · ${t.name}`;
type PersonRow = typeof s.persons.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const FUNCTION_LABELS: Record<TeamFunction, string> = {
  player: 'Spieler',
  coach: 'Trainer',
  assistant_coach: 'Co-Trainer',
  team_manager: 'Betreuer',
};

const STATUS_LABELS = { active: 'aktiv', inactive: 'passiv', left: 'ausgetreten' } as const;

export function adminPermissions(actor: Actor): AdminPermissions {
  const read = scopesWith(actor.grants, 'members.read');
  return {
    readMembers: read.all || read.orgUnitIds.length > 0 || read.teamIds.length > 0,
    manageMembers: actorCan(actor, 'members.manage'),
    manageRoles: actorCan(actor, 'club.roles.manage'),
    readAudit: actorCan(actor, 'club.audit.read'),
    manageModules: actorCan(actor, 'club.modules.manage'),
    manageTeams: (() => {
      const t = scopesWith(actor.grants, 'teams.manage');
      return t.all || t.orgUnitIds.length > 0 || t.teamIds.length > 0;
    })(),
    planSeason: actorCan(actor, 'teams.season.plan'),
    planEvents: (() => {
      const t = scopesWith(actor.grants, 'events.manage');
      return t.all || t.orgUnitIds.length > 0;
    })(),
    manageTransfers: (() => {
      const t = scopesWith(actor.grants, 'teams.transfers.manage');
      return t.all || t.orgUnitIds.length > 0 || t.teamIds.length > 0;
    })(),
  };
}

const today = (actor: Actor, now: Date) => calendarDayOf(now, actor.club.timezone);
const todayIso = (actor: Actor, now: Date) => toIsoDate(today(actor, now));
const name = (p: Pick<PersonRow, 'firstName' | 'lastName'>) => `${p.firstName} ${p.lastName}`;

export async function currentTeams(db: Db | Tx, actor: Actor): Promise<TeamRow[]> {
  const rows = await db
    .select({ team: s.teams })
    .from(s.teams)
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(and(eq(s.teams.clubId, actor.club.id), eq(s.seasons.isCurrent, true)))
    .orderBy(asc(s.teams.sortOrder));
  return rows.map((r) => r.team);
}

/** Aktuelle Mannschaftszugehörigkeiten (laufende Saison, nicht beendet). */
async function activeMemberships(db: Db | Tx, actor: Actor, now: Date, personIds?: string[]) {
  return db
    .select({ membership: s.teamMemberships, team: s.teams })
    .from(s.teamMemberships)
    .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(
      and(
        eq(s.teamMemberships.clubId, actor.club.id),
        eq(s.seasons.isCurrent, true),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, todayIso(actor, now))),
        personIds ? inArray(s.teamMemberships.personId, personIds) : undefined,
      ),
    )
    .orderBy(asc(s.teams.sortOrder));
}

/** Vorbereitete Folgesaison (falls vorhanden) mit ihren Mannschaften. */
async function upcomingSeason(db: Db | Tx, actor: Actor) {
  const rows = await db
    .select()
    .from(s.seasons)
    .where(eq(s.seasons.clubId, actor.club.id))
    .orderBy(asc(s.seasons.startsOn));
  const current = rows.find((r) => r.isCurrent);
  const next = current
    ? rows.find((r) => !r.isCurrent && r.startsOn > current.startsOn)
    : undefined;
  if (!next) return null;
  const teams = await db
    .select()
    .from(s.teams)
    .where(eq(s.teams.seasonId, next.id))
    .orderBy(asc(s.teams.sortOrder));
  return { season: next, teams };
}

/** Zuordnungen in der vorbereiteten Folgesaison. */
async function upcomingMemberships(db: Db | Tx, actor: Actor, personIds: string[]) {
  const next = await upcomingSeason(db, actor);
  if (!next || next.teams.length === 0) return [];
  return db
    .select({ membership: s.teamMemberships, team: s.teams })
    .from(s.teamMemberships)
    .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
    .where(
      and(
        inArray(
          s.teamMemberships.teamId,
          next.teams.map((t) => t.id),
        ),
        isNull(s.teamMemberships.validTo),
        inArray(s.teamMemberships.personId, personIds),
      ),
    )
    .orderBy(asc(s.teams.sortOrder));
}

/**
 * Personen, die der Nutzer in der Verwaltung sehen darf. `null` = alle (Vereinsebene).
 * Wirft 403 ohne jedes Leserecht.
 */
async function visiblePersonIds(db: Db, actor: Actor, now: Date): Promise<Set<string> | null> {
  const read = scopesWith(actor.grants, 'members.read');
  if (read.all) return null;
  if (!adminPermissions(actor).readMembers) {
    throw forbidden('Die Mitgliederverwaltung ist für Vorstand und Mitgliederverwaltung.');
  }
  const teams = (await currentTeams(db, actor)).filter((t) => actorCan(actor, 'members.read', t));
  if (teams.length === 0) return new Set();
  const members = await db
    .select({ personId: s.teamMemberships.personId })
    .from(s.teamMemberships)
    .where(
      and(
        inArray(
          s.teamMemberships.teamId,
          teams.map((t) => t.id),
        ),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, todayIso(actor, now))),
      ),
    );
  const ids = new Set(members.map((m) => m.personId));
  if (ids.size > 0) {
    const guardians = await db
      .select({ id: s.guardianships.guardianPersonId })
      .from(s.guardianships)
      .where(inArray(s.guardianships.childPersonId, [...ids]));
    for (const g of guardians) ids.add(g.id);
  }
  return ids;
}

export function requireManageMembers(actor: Actor) {
  if (!actorCan(actor, 'members.manage'))
    throw forbidden('Stammdaten pflegt nur die Mitgliederverwaltung.');
}

function requireManageRoles(actor: Actor) {
  if (!actorCan(actor, 'club.roles.manage'))
    throw forbidden('Rollen und Aufgaben vergibt nur die Vereinsadministration.');
}

async function audit(
  db: Db | Tx,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  label: string,
  now: Date,
  data: Record<string, unknown> = {},
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType,
    entityId,
    data: { ...data, label },
    createdAt: now,
  });
}

// ── Übersicht ───────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'announcement.published': 'News veröffentlicht',
  'club.created': 'Verein angelegt',
  'module.enabled': 'Modul aktiviert',
  'role.assigned': 'Rolle vergeben',
  'role.revoked': 'Rolle entzogen',
  'attendance.overridden': 'Rückmeldung stellvertretend geändert',
  'cash.booked': 'Kassenbuchung erfasst',
  'event.cancelled': 'Termin abgesagt',
  'event.updated': 'Termin geändert',
  'facility.blocked': 'Platz gesperrt',
  'facility.unblocked': 'Platzsperrung aufgehoben',
  'guest.nominated': 'Gastspieler abgestellt',
};

async function auditEntries(db: Db, actor: Actor, limit: number): Promise<AuditEntry[]> {
  const rows = await db
    .select({ entry: s.auditLog, actorName: s.users.displayName })
    .from(s.auditLog)
    .leftJoin(s.users, eq(s.users.id, s.auditLog.actorUserId))
    .where(eq(s.auditLog.clubId, actor.club.id))
    .orderBy(desc(s.auditLog.createdAt))
    .limit(limit);
  return rows.map(({ entry, actorName }) => {
    const data = entry.data ?? {};
    const label =
      typeof data.label === 'string'
        ? data.label
        : `${ACTION_LABELS[entry.action] ?? entry.action}${
            typeof data.reason === 'string' ? ` (${data.reason})` : ''
          }`;
    return { id: entry.id, at: entry.createdAt.toISOString(), actor: actorName, label };
  });
}

export async function getAdminOverview(db: Db, actor: Actor, now: Date): Promise<AdminOverview> {
  const can = adminPermissions(actor);
  if (
    !can.readMembers &&
    !can.manageRoles &&
    !can.readAudit &&
    !can.manageModules &&
    !can.manageTeams &&
    !can.planSeason &&
    !can.manageTransfers
  ) {
    throw forbidden('Die Verwaltung ist für Vorstand, Leitung und Administration.');
  }
  const visible = can.readMembers ? await visiblePersonIds(db, actor, now) : new Set<string>();
  const persons = (
    await db
      .select({ id: s.persons.id, status: s.persons.membershipStatus, userId: s.persons.userId })
      .from(s.persons)
      .where(eq(s.persons.clubId, actor.club.id))
  ).filter((p) => visible === null || visible.has(p.id));
  const inTeam = new Set(
    (await activeMemberships(db, actor, now)).map((m) => m.membership.personId),
  );
  // Eltern ohne eigene Mannschaft zählen nicht als „ohne Mannschaft“
  const guardianIds = new Set(
    (
      await db
        .select({ id: s.guardianships.guardianPersonId })
        .from(s.guardianships)
        .where(eq(s.guardianships.clubId, actor.club.id))
    ).map((g) => g.id),
  );
  const roleHolders = new Set(
    (
      await db
        .select({ id: s.roleAssignments.personId })
        .from(s.roleAssignments)
        .where(eq(s.roleAssignments.clubId, actor.club.id))
    ).map((r) => r.id),
  );
  const teams = await currentTeams(db, actor);

  return {
    can,
    members: {
      active: persons.filter((p) => p.status === 'active').length,
      inactive: persons.filter((p) => p.status === 'inactive').length,
      left: persons.filter((p) => p.status === 'left').length,
      withoutTeam: persons.filter(
        (p) =>
          p.status === 'active' &&
          !inTeam.has(p.id) &&
          !guardianIds.has(p.id) &&
          !roleHolders.has(p.id),
      ).length,
    },
    teams:
      visible === null
        ? teams.length
        : teams.filter((t) => actorCan(actor, 'members.read', t)).length,
    accounts: persons.filter((p) => p.userId).length,
    recentActivity: can.readAudit ? await auditEntries(db, actor, 8) : [],
  };
}

export async function listAudit(db: Db, actor: Actor): Promise<AuditEntry[]> {
  if (!actorCan(actor, 'club.audit.read'))
    throw forbidden('Das Audit-Log ist dem Vorstand vorbehalten.');
  return auditEntries(db, actor, 200);
}

// ── Mitglieder ──────────────────────────────────────────────────────────────

export async function listMembers(
  db: Db,
  actor: Actor,
  filter: {
    q?: string;
    status?: string;
    teamId?: string;
    withoutTeam?: boolean;
    /** Rolle (Schlüssel, z. B. `coach`) oder `any` (alle Rollenträger) bzw. `individual` */
    roleKey?: string;
    /** Funktion in einer Mannschaft; `coaches` = Trainer und Co-Trainer */
    teamFunction?: string;
    account?: 'yes' | 'no';
  },
  now: Date,
): Promise<MemberListItem[]> {
  const visible = await visiblePersonIds(db, actor, now);
  const persons = (
    await db
      .select()
      .from(s.persons)
      .where(eq(s.persons.clubId, actor.club.id))
      .orderBy(asc(s.persons.lastName), asc(s.persons.firstName))
  ).filter((p) => visible === null || visible.has(p.id));

  const memberships = await activeMemberships(db, actor, now);
  const roles = await db
    .select({ personId: s.roleAssignments.personId, name: s.roles.name, key: s.roles.key })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .where(eq(s.roleAssignments.clubId, actor.club.id));
  const individual = new Set(
    (
      await db
        .select({ personId: s.personPermissions.personId })
        .from(s.personPermissions)
        .where(eq(s.personPermissions.clubId, actor.club.id))
    ).map((r) => r.personId),
  );

  const guardianIds = filter.withoutTeam
    ? new Set(
        (
          await db
            .select({ id: s.guardianships.guardianPersonId })
            .from(s.guardianships)
            .where(eq(s.guardianships.clubId, actor.club.id))
        ).map((g) => g.id),
      )
    : new Set<string>();
  const q = filter.q?.trim().toLowerCase();
  return persons
    .map((p) => {
      const own = memberships.filter((m) => m.membership.personId === p.id);
      return {
        person: p,
        teamIds: own.map((m) => m.team.id),
        item: {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          memberNumber: p.memberNumber,
          status: p.membershipStatus,
          teams: own.map((m) => ({ badge: m.team.badge, function: m.membership.function })),
          roles: [
            ...new Set([
              ...roles.filter((r) => r.personId === p.id).map((r) => r.name),
              ...(individual.has(p.id) ? ['Individuelle Rechte'] : []),
            ]),
          ],
          hasAccount: p.userId !== null,
        } satisfies MemberListItem,
      };
    })
    .filter(
      ({ person, teamIds, item }) =>
        (!q ||
          `${person.firstName} ${person.lastName}`.toLowerCase().includes(q) ||
          `${person.lastName} ${person.firstName}`.toLowerCase().includes(q) ||
          (person.memberNumber ?? '').toLowerCase().includes(q)) &&
        (!filter.status || person.membershipStatus === filter.status) &&
        (!filter.teamId || teamIds.includes(filter.teamId)) &&
        (!filter.account || (filter.account === 'yes') === item.hasAccount) &&
        (!filter.teamFunction ||
          memberships.some(
            (m) =>
              m.membership.personId === person.id &&
              (!filter.teamId || m.team.id === filter.teamId) &&
              (filter.teamFunction === 'coaches'
                ? m.membership.function === 'coach' || m.membership.function === 'assistant_coach'
                : m.membership.function === filter.teamFunction),
          )) &&
        (!filter.roleKey ||
          (filter.roleKey === 'any'
            ? item.roles.length > 0
            : filter.roleKey === 'individual'
              ? individual.has(person.id)
              : roles.some((r) => r.personId === person.id && r.key === filter.roleKey))) &&
        // „Ohne Mannschaft“: weder Mannschaft noch Aufgabe noch Elternteil eines Mitglieds
        (!filter.withoutTeam ||
          (teamIds.length === 0 && item.roles.length === 0 && !guardianIds.has(person.id))),
    )
    .map((x) => x.item);
}

async function scopeLabels(db: Db | Tx, actor: Actor) {
  const [units, teams] = await Promise.all([
    db.select().from(s.orgUnits).where(eq(s.orgUnits.clubId, actor.club.id)),
    currentTeams(db, actor),
  ]);
  return (scopeType: string, scopeId: string | null) => {
    if (scopeType === 'club') return 'Verein';
    if (scopeType === 'org_unit') return units.find((u) => u.id === scopeId)?.name ?? 'Bereich';
    const team = teams.find((t) => t.id === scopeId);
    return team ? teamLabel(team) : 'Mannschaft (Vorsaison)';
  };
}

async function loadPerson(db: Db | Tx, actor: Actor, personId: string): Promise<PersonRow> {
  const [person] = await db
    .select()
    .from(s.persons)
    .where(and(eq(s.persons.id, personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw notFound('Das Mitglied');
  return person;
}

export async function getMember(
  db: Db,
  actor: Actor,
  personId: string,
  now: Date,
): Promise<MemberDetail> {
  const visible = await visiblePersonIds(db, actor, now);
  if (visible !== null && !visible.has(personId)) throw notFound('Das Mitglied');
  const person = await loadPerson(db, actor, personId);

  const [memberships, upcoming, roleRows, guardians, children, label] = await Promise.all([
    activeMemberships(db, actor, now, [personId]),
    upcomingMemberships(db, actor, [personId]),
    db
      .select({ assignment: s.roleAssignments, role: s.roles })
      .from(s.roleAssignments)
      .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
      .where(eq(s.roleAssignments.personId, personId)),
    db
      .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
      .from(s.guardianships)
      .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
      .where(eq(s.guardianships.childPersonId, personId)),
    db
      .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
      .from(s.guardianships)
      .innerJoin(s.persons, eq(s.persons.id, s.guardianships.childPersonId))
      .where(eq(s.guardianships.guardianPersonId, personId)),
    scopeLabels(db, actor),
  ]);

  const roles: MemberRoleAssignment[] = roleRows.map(({ assignment, role }) => ({
    id: assignment.id,
    roleKey: role.key,
    roleName: role.name,
    scopeType: assignment.scopeType,
    scopeId: assignment.scopeId,
    scopeLabel: label(assignment.scopeType, assignment.scopeId),
  }));

  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    birthDate: person.birthDate,
    email: person.email,
    phone: person.phone,
    memberNumber: person.memberNumber,
    memberSince: person.memberSince,
    status: person.membershipStatus,
    hasAccount: person.userId !== null,
    guardians: guardians.map((g) => ({ id: g.id, name: name(g) })),
    children: children.map((c) => ({ id: c.id, name: name(c) })),
    memberships: [
      ...memberships.map((m) => ({ ...m, upcoming: false })),
      ...upcoming.map((m) => ({ ...m, upcoming: true })),
    ].map(({ membership, team, upcoming: isUpcoming }) => ({
      upcoming: isUpcoming,
      id: membership.id,
      team: { id: team.id, name: team.name, badge: team.badge },
      function: membership.function,
      jerseyNumber: membership.jerseyNumber,
      isPrimary: membership.isPrimaryTeam,
      validFrom: membership.validFrom,
    })),
    roles,
    individualPermissions:
      (
        await db
          .select({ permissions: s.personPermissions.permissions })
          .from(s.personPermissions)
          .where(eq(s.personPermissions.personId, personId))
      )[0]?.permissions ?? [],
    can: adminPermissions(actor),
  };
}

const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);

export async function createMember(
  db: Db,
  actor: Actor,
  input: CreateMemberInput,
  now: Date,
): Promise<MemberDetail> {
  requireManageMembers(actor);
  const [person] = await db
    .insert(s.persons)
    .values({
      clubId: actor.club.id,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthDate: input.birthDate ?? null,
      email: clean(input.email)?.toLowerCase() ?? null,
      phone: clean(input.phone) ?? null,
      memberNumber: clean(input.memberNumber) ?? null,
      memberSince: input.memberSince ?? todayIso(actor, now),
    })
    .returning();
  await audit(
    db,
    actor,
    'member.created',
    'person',
    person!.id,
    `Mitglied angelegt: ${name(person!)}`,
    now,
  );
  return getMember(db, actor, person!.id, now);
}

async function fulladminAssignments(db: Db | Tx, actor: Actor) {
  return db
    .select({ id: s.roleAssignments.id, personId: s.roleAssignments.personId })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .where(
      and(
        eq(s.roleAssignments.clubId, actor.club.id),
        eq(s.roles.key, 'fulladmin'),
        eq(s.roleAssignments.scopeType, 'club'),
      ),
    );
}

/** Zukünftige Termine einer Mannschaft für ein neues Mitglied öffnen bzw. beim Verlassen räumen. */
export async function syncFutureParticipation(
  tx: Tx,
  actor: Actor,
  team: TeamRow,
  personId: string,
  fn: TeamFunction | null,
  now: Date,
) {
  const events = await tx
    .select({ id: s.events.id })
    .from(s.events)
    .where(
      and(
        eq(s.events.teamId, team.id),
        eq(s.events.status, 'scheduled'),
        gt(s.events.startsAt, now),
      ),
    );
  if (events.length === 0) return;
  const ids = events.map((e) => e.id);
  if (fn === null) {
    // Nur eigene Teilnahme entfernen, Gastspieler-Einsätze bleiben bestehen
    await tx
      .delete(s.eventParticipants)
      .where(
        and(
          inArray(s.eventParticipants.eventId, ids),
          eq(s.eventParticipants.personId, personId),
          inArray(s.eventParticipants.role, ['player', 'coach']),
        ),
      );
    return;
  }
  const isPlayer = fn === 'player';
  await tx
    .insert(s.eventParticipants)
    .values(
      ids.map((eventId) => ({
        clubId: actor.club.id,
        eventId,
        personId,
        role: isPlayer ? ('player' as const) : ('coach' as const),
        status:
          isPlayer && team.participationMode === 'active_response'
            ? ('pending' as const)
            : ('yes' as const),
      })),
    )
    .onConflictDoNothing();
}

async function endMembershipsOf(tx: Tx, actor: Actor, personId: string, now: Date) {
  const rows = await activeMemberships(tx, actor, now, [personId]);
  const yesterday = toIsoDate(addDays(today(actor, now), -1));
  for (const { membership, team } of rows) {
    if (membership.validFrom >= todayIso(actor, now)) {
      await tx.delete(s.teamMemberships).where(eq(s.teamMemberships.id, membership.id));
    } else {
      await tx
        .update(s.teamMemberships)
        .set({ validTo: yesterday })
        .where(eq(s.teamMemberships.id, membership.id));
    }
    await syncFutureParticipation(tx, actor, team, personId, null, now);
  }
  return rows;
}

export async function updateMember(
  db: Db,
  actor: Actor,
  personId: string,
  input: UpdateMemberInput,
  now: Date,
): Promise<MemberDetail> {
  requireManageMembers(actor);
  const person = await loadPerson(db, actor, personId);
  const patch: Partial<typeof s.persons.$inferInsert> = {};
  if (input.firstName !== undefined) patch.firstName = input.firstName.trim();
  if (input.lastName !== undefined) patch.lastName = input.lastName.trim();
  if (input.birthDate !== undefined) patch.birthDate = input.birthDate;
  if (input.email !== undefined) patch.email = clean(input.email)?.toLowerCase() ?? null;
  if (input.phone !== undefined) patch.phone = clean(input.phone) ?? null;
  if (input.memberNumber !== undefined) patch.memberNumber = clean(input.memberNumber) ?? null;
  if (input.memberSince !== undefined) patch.memberSince = input.memberSince;
  const leaving = input.status === 'left' && person.membershipStatus !== 'left';
  if (input.status !== undefined) patch.membershipStatus = input.status;

  if (leaving) {
    if (personId === actor.person.id)
      throw new HttpError(409, 'self', 'Den eigenen Austritt trägt eine andere Person ein.');
    const admins = await fulladminAssignments(db, actor);
    if (
      admins.some((a) => a.personId === personId) &&
      admins.every((a) => a.personId === personId)
    ) {
      throw new HttpError(409, 'last_admin', 'Der letzte Fulladmin kann nicht austreten.');
    }
  }
  if (Object.keys(patch).length === 0) return getMember(db, actor, personId, now);

  await db.transaction(async (tx) => {
    await tx.update(s.persons).set(patch).where(eq(s.persons.id, personId));
    const changed = Object.keys(patch).filter((k) => k !== 'membershipStatus');
    if (changed.length) {
      await audit(
        tx,
        actor,
        'member.updated',
        'person',
        personId,
        `Stammdaten geändert: ${name({ ...person, ...patch })}`,
        now,
        {
          fields: changed,
        },
      );
    }
    if (input.status !== undefined && input.status !== person.membershipStatus) {
      await audit(
        tx,
        actor,
        'member.status',
        'person',
        personId,
        `Status: ${name(person)} ist jetzt ${STATUS_LABELS[input.status]}`,
        now,
      );
    }
    if (leaving) {
      // Austritt: Mannschaften beenden, Aufgaben entziehen, Anmeldungen beenden
      await endMembershipsOf(tx, actor, personId, now);
      await tx.delete(s.roleAssignments).where(eq(s.roleAssignments.personId, personId));
      if (person.userId) await tx.delete(s.sessions).where(eq(s.sessions.userId, person.userId));
    }
  });
  return getMember(db, actor, personId, now);
}

export async function addMembershipCore(
  db: Db,
  actor: Actor,
  personId: string,
  input: AddMembershipInput,
  now: Date,
): Promise<void> {
  if (!TEAM_FUNCTIONS.includes(input.function))
    throw new HttpError(400, 'validation', 'Unbekannte Funktion.');
  const person = await loadPerson(db, actor, personId);
  if (person.membershipStatus === 'left')
    throw new HttpError(
      409,
      'left',
      'Ausgetretene Mitglieder können keiner Mannschaft zugeordnet werden.',
    );
  const next = await upcomingSeason(db, actor);
  const currentTeam = (await currentTeams(db, actor)).find((t) => t.id === input.teamId);
  const nextTeam = next?.teams.find((t) => t.id === input.teamId);
  const team = currentTeam ?? nextTeam;
  if (!team)
    throw new HttpError(
      400,
      'invalid_team',
      'Die Mannschaft gibt es weder in der laufenden noch in der nächsten Saison.',
    );
  const existing = [
    ...(await activeMemberships(db, actor, now, [personId])),
    ...(await upcomingMemberships(db, actor, [personId])),
  ].find((m) => m.team.id === team.id && m.membership.function === input.function);
  if (existing)
    throw new HttpError(
      409,
      'exists',
      'Die Person ist dort bereits mit dieser Funktion eingetragen.',
    );

  // In der nächsten Saison gilt die Zuordnung ab Saisonbeginn
  const from =
    nextTeam && next && next.season.startsOn > todayIso(actor, now)
      ? next.season.startsOn
      : todayIso(actor, now);
  await db.transaction(async (tx) => {
    // Am selben Tag beendet und wieder hinzugefügt → bestehende Zeile reaktivieren
    const [sameDay] = await tx
      .select({ id: s.teamMemberships.id })
      .from(s.teamMemberships)
      .where(
        and(
          eq(s.teamMemberships.teamId, team.id),
          eq(s.teamMemberships.personId, personId),
          eq(s.teamMemberships.function, input.function),
          eq(s.teamMemberships.validFrom, from),
        ),
      );
    if (sameDay) {
      await tx
        .update(s.teamMemberships)
        .set({ validTo: null, jerseyNumber: input.jerseyNumber ?? null })
        .where(eq(s.teamMemberships.id, sameDay.id));
    } else {
      await tx.insert(s.teamMemberships).values({
        clubId: actor.club.id,
        teamId: team.id,
        personId,
        function: input.function,
        jerseyNumber: input.function === 'player' ? (input.jerseyNumber ?? null) : null,
        isPrimaryTeam: input.isPrimary ?? true,
        validFrom: from,
      });
    }
    if (currentTeam) await syncFutureParticipation(tx, actor, team, personId, input.function, now);
    await audit(
      tx,
      actor,
      'membership.added',
      'person',
      personId,
      `${name(person)} → ${team.badge}${nextTeam ? ` (Saison ${next!.season.name})` : ''} (${FUNCTION_LABELS[input.function]})`,
      now,
    );
  });
}

export async function addMembership(
  db: Db,
  actor: Actor,
  personId: string,
  input: AddMembershipInput,
  now: Date,
): Promise<MemberDetail> {
  requireManageMembers(actor);
  await addMembershipCore(db, actor, personId, input, now);
  return getMember(db, actor, personId, now);
}

export async function endMembershipCore(
  db: Db,
  actor: Actor,
  personId: string,
  membershipId: string,
  now: Date,
): Promise<void> {
  const person = await loadPerson(db, actor, personId);
  const current = (await activeMemberships(db, actor, now, [personId])).find(
    (m) => m.membership.id === membershipId,
  );
  const row =
    current ??
    (await upcomingMemberships(db, actor, [personId])).find(
      (m) => m.membership.id === membershipId,
    );
  if (!row) throw notFound('Die Mannschaftszuordnung');
  await db.transaction(async (tx) => {
    if (row.membership.validFrom >= todayIso(actor, now)) {
      await tx.delete(s.teamMemberships).where(eq(s.teamMemberships.id, membershipId));
    } else {
      await tx
        .update(s.teamMemberships)
        .set({ validTo: toIsoDate(addDays(today(actor, now), -1)) })
        .where(eq(s.teamMemberships.id, membershipId));
    }
    // Weitere Funktion in derselben Mannschaft (z. B. Spielertrainer)? Dann Termine behalten.
    if (current) {
      const stillIn = (await activeMemberships(tx, actor, now, [personId])).find(
        (m) => m.team.id === row.team.id,
      );
      await syncFutureParticipation(
        tx,
        actor,
        row.team,
        personId,
        stillIn?.membership.function ?? null,
        now,
      );
    }
    await audit(
      tx,
      actor,
      'membership.ended',
      'person',
      personId,
      `${name(person)} verlässt ${row.team.badge} (${FUNCTION_LABELS[row.membership.function]})`,
      now,
    );
  });
}

export async function endMembership(
  db: Db,
  actor: Actor,
  personId: string,
  membershipId: string,
  now: Date,
): Promise<MemberDetail> {
  requireManageMembers(actor);
  await endMembershipCore(db, actor, personId, membershipId, now);
  return getMember(db, actor, personId, now);
}

// ── Rollen & Zusatzaufgaben ─────────────────────────────────────────────────

export async function getRoleCatalog(db: Db, actor: Actor): Promise<RoleCatalog> {
  if (!actorCan(actor, 'club.roles.manage') && !actorCan(actor, 'members.read')) {
    throw forbidden('Die Rollenübersicht ist für Vorstand und Administration.');
  }
  const [roles, assignments, units, teams, label] = await Promise.all([
    db
      .select()
      .from(s.roles)
      .where(eq(s.roles.clubId, actor.club.id))
      .orderBy(asc(s.roles.createdAt)),
    db
      .select({ assignment: s.roleAssignments, person: s.persons })
      .from(s.roleAssignments)
      .innerJoin(s.persons, eq(s.persons.id, s.roleAssignments.personId))
      .where(eq(s.roleAssignments.clubId, actor.club.id))
      .orderBy(asc(s.persons.lastName)),
    db
      .select()
      .from(s.orgUnits)
      .where(eq(s.orgUnits.clubId, actor.club.id))
      .orderBy(asc(s.orgUnits.sortOrder)),
    currentTeams(db, actor),
    scopeLabels(db, actor),
  ]);
  const next = await upcomingSeason(db, actor);
  return {
    roles: roles.map((r) => ({
      key: r.key,
      name: r.name,
      description: r.description,
      defaultScope: SYSTEM_ROLES.find((x) => x.key === r.key)?.defaultScope ?? 'club',
      permissions: r.permissions,
      holders: assignments
        .filter((a) => a.assignment.roleId === r.id)
        .map((a) => ({
          assignmentId: a.assignment.id,
          personId: a.person.id,
          name: name(a.person),
          scopeLabel: label(a.assignment.scopeType, a.assignment.scopeId),
        })),
    })),
    scopes: [
      { type: 'club', id: null, label: 'Verein' },
      ...units.map((u) => ({ type: 'org_unit' as const, id: u.id, label: u.name })),
      ...teams.map((t) => ({ type: 'team' as const, id: t.id, label: teamLabel(t) })),
    ],
    teams: [
      ...teams.map((t) => ({ id: t.id, name: t.name, badge: t.badge })),
      // Für die Kaderplanung: Mannschaften der vorbereiteten Folgesaison
      ...(next?.teams ?? []).map((t) => ({
        id: t.id,
        name: `${t.name} (Saison ${next!.season.name})`,
        badge: t.badge,
      })),
    ],
  };
}

export async function assignRole(
  db: Db,
  actor: Actor,
  personId: string,
  input: AssignRoleInput,
  now: Date,
): Promise<MemberDetail> {
  requireManageRoles(actor);
  const person = await loadPerson(db, actor, personId);
  if (person.membershipStatus === 'left')
    throw new HttpError(409, 'left', 'Ausgetretene Mitglieder erhalten keine Aufgaben.');
  const [role] = await db
    .select()
    .from(s.roles)
    .where(and(eq(s.roles.clubId, actor.club.id), eq(s.roles.key, input.roleKey)));
  if (!role) throw new HttpError(400, 'invalid_role', 'Unbekannte Rolle.');

  // Keine Rechteausweitung: nur Rollen vergeben, deren Rechte man selbst vereinsweit hat
  const missing = role.permissions.filter((p) => !isPermission(p) || !actorCan(actor, p));
  if (missing.length > 0) {
    throw forbidden('Du kannst keine Rolle vergeben, die mehr Rechte hat als du selbst.');
  }

  const scopeId = input.scopeType === 'club' ? null : (input.scopeId ?? null);
  if (input.scopeType !== 'club') {
    if (!scopeId)
      throw new HttpError(400, 'scope_required', 'Bitte wähle Bereich oder Mannschaft.');
    const valid =
      input.scopeType === 'org_unit'
        ? (
            await db
              .select({ id: s.orgUnits.id })
              .from(s.orgUnits)
              .where(and(eq(s.orgUnits.id, scopeId), eq(s.orgUnits.clubId, actor.club.id)))
          ).length > 0
        : (await currentTeams(db, actor)).some((t) => t.id === scopeId);
    if (!valid) throw new HttpError(400, 'invalid_scope', 'Unbekannter Geltungsbereich.');
  }
  if (role.key === 'fulladmin' && input.scopeType !== 'club') {
    throw new HttpError(400, 'invalid_scope', 'Fulladmin gilt immer für den ganzen Verein.');
  }

  const [duplicate] = await db
    .select({ id: s.roleAssignments.id })
    .from(s.roleAssignments)
    .where(
      and(
        eq(s.roleAssignments.personId, personId),
        eq(s.roleAssignments.roleId, role.id),
        eq(s.roleAssignments.scopeType, input.scopeType),
        scopeId ? eq(s.roleAssignments.scopeId, scopeId) : isNull(s.roleAssignments.scopeId),
      ),
    );
  if (duplicate) throw new HttpError(409, 'exists', 'Diese Aufgabe ist bereits vergeben.');

  const label = (await scopeLabels(db, actor))(input.scopeType, scopeId);
  const [created] = await db
    .insert(s.roleAssignments)
    .values({
      clubId: actor.club.id,
      personId,
      roleId: role.id,
      scopeType: input.scopeType,
      scopeId,
    })
    .returning({ id: s.roleAssignments.id });
  await audit(
    db,
    actor,
    'role.assigned',
    'role_assignment',
    created!.id,
    `Rolle vergeben: ${role.name} (${label}) an ${name(person)}`,
    now,
    { personId, roleKey: role.key, scopeType: input.scopeType, scopeId },
  );
  return getMember(db, actor, personId, now);
}

export async function setIndividualPermissions(
  db: Db,
  actor: Actor,
  personId: string,
  input: SetIndividualPermissionsInput,
  now: Date,
): Promise<MemberDetail> {
  requireManageRoles(actor);
  const person = await loadPerson(db, actor, personId);
  if (person.membershipStatus === 'left')
    throw new HttpError(409, 'left', 'Ausgetretene Mitglieder erhalten keine Rechte.');
  if (personId === actor.person.id)
    throw forbidden('Die eigenen individuellen Rechte kann nur eine andere Person ändern.');
  const wanted = [...new Set(input.permissions)];
  if (wanted.some((p) => !isPermission(p)))
    throw new HttpError(400, 'invalid_permission', 'Unbekanntes Recht.');
  const [current] = await db
    .select({ permissions: s.personPermissions.permissions })
    .from(s.personPermissions)
    .where(eq(s.personPermissions.personId, personId));
  const before = current?.permissions ?? [];
  const changed = [
    ...wanted.filter((p) => !before.includes(p)),
    ...before.filter((p) => !wanted.includes(p)),
  ];
  // Keine Rechteausweitung: nur Rechte ändern, die man selbst vereinsweit hat
  if (changed.some((p) => !isPermission(p) || !actorCan(actor, p)))
    throw forbidden('Du kannst nur Rechte vergeben oder entziehen, die du selbst hast.');
  if (changed.length === 0) return getMember(db, actor, personId, now);
  if (wanted.length === 0) {
    await db.delete(s.personPermissions).where(eq(s.personPermissions.personId, personId));
  } else {
    await db
      .insert(s.personPermissions)
      .values({ clubId: actor.club.id, personId, permissions: wanted, updatedAt: now })
      .onConflictDoUpdate({
        target: s.personPermissions.personId,
        set: { permissions: wanted, updatedAt: now },
      });
  }
  await audit(
    db,
    actor,
    'role.individual',
    'person',
    personId,
    `Individuelle Rechte geändert für ${name(person)}: ${changed
      .map((p) => `${wanted.includes(p) ? '+' : '−'}${p}`)
      .join(', ')}`,
    now,
    { personId, permissions: wanted },
  );
  return getMember(db, actor, personId, now);
}

export async function revokeRole(
  db: Db,
  actor: Actor,
  personId: string,
  assignmentId: string,
  now: Date,
): Promise<MemberDetail> {
  requireManageRoles(actor);
  const person = await loadPerson(db, actor, personId);
  const [row] = await db
    .select({ assignment: s.roleAssignments, role: s.roles })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .where(
      and(
        eq(s.roleAssignments.id, assignmentId),
        eq(s.roleAssignments.personId, personId),
        eq(s.roleAssignments.clubId, actor.club.id),
      ),
    );
  if (!row) throw notFound('Die Rolle');

  if (row.role.key === 'fulladmin') {
    if (personId === actor.person.id)
      throw new HttpError(
        409,
        'self',
        'Die eigene Fulladmin-Rolle kann nur ein anderer Fulladmin entziehen.',
      );
    const admins = await fulladminAssignments(db, actor);
    if (admins.length <= 1)
      throw new HttpError(409, 'last_admin', 'Der Verein braucht mindestens einen Fulladmin.');
  }
  // Ohne diese Rolle dürfte man keine Rollen mehr vergeben → nicht bei sich selbst entfernen
  if (personId === actor.person.id && row.role.permissions.includes('club.roles.manage')) {
    throw new HttpError(409, 'self', 'Damit würdest du dich selbst aussperren.');
  }

  const label = (await scopeLabels(db, actor))(row.assignment.scopeType, row.assignment.scopeId);
  await db.delete(s.roleAssignments).where(eq(s.roleAssignments.id, assignmentId));
  await audit(
    db,
    actor,
    'role.revoked',
    'role_assignment',
    assignmentId,
    `Rolle entzogen: ${row.role.name} (${label}) von ${name(person)}`,
    now,
    { personId, roleKey: row.role.key },
  );
  return getMember(db, actor, personId, now);
}
