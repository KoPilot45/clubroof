/**
 * „Mannschaft bearbeiten“ für das Trainerteam (Festlegung 10.10.2026): Kader pflegen (hinzufügen,
 * entfernen, Funktion, Rückennummer), Co-Trainer und Betreuer ernennen sowie das Mannschaftsprofil
 * (Treffpunkt-Regeln, DFBnet-Schreibweisen). Der Trainer selbst (Funktion `coach`) und die
 * Vereinsrollen bleiben der Administration vorbehalten.
 */
import {
  type AddTeamMemberInput,
  type TeamCandidate,
  type TeamFunction,
  type TeamManage,
  type TeamProfile,
  type UpdateTeamMemberInput,
  calendarDayOf,
  toIsoDate,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gte, ilike, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { addMembershipCore, endMembershipCore, syncFutureParticipation } from './admin';
import { loadTeamForActor } from './team-access';

const todayIso = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));
const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

async function loadManaged(db: Db, actor: Actor, teamId: string) {
  const { team } = await loadTeamForActor(db, actor, teamId);
  if (!actorCan(actor, 'squad.manage', team))
    throw forbidden('Den Kader bearbeitet nur das Trainerteam der Mannschaft.');
  return team;
}

/** Antwortfristen als Stunden vor Beginn; Wochentagsregeln (z. B. „Freitag 18 Uhr“) erscheinen als leer. */
async function deadlineHours(db: Db, teamId: string) {
  const rules = await db
    .select()
    .from(s.teamDeadlineRules)
    .where(eq(s.teamDeadlineRules.teamId, teamId));
  const hours = (type: 'training' | 'match') => {
    const rule = rules.find((r) => r.eventType === type && r.kind === 'relative');
    return rule?.minutesBefore != null ? Math.round(rule.minutesBefore / 60) : null;
  };
  return { training: hours('training'), match: hours('match') };
}

export async function loadProfile(db: Db, team: typeof s.teams.$inferSelect): Promise<TeamProfile> {
  const d = await deadlineHours(db, team.id);
  return { ...profileOf(team), trainingDeadlineHours: d.training, matchDeadlineHours: d.match };
}

export function profileOf(
  team: typeof s.teams.$inferSelect,
): Omit<TeamProfile, 'trainingDeadlineHours' | 'matchDeadlineHours'> {
  return {
    matchMeetingMinutes: team.matchMeetingMinutes,
    trainingMeetingMinutes: team.trainingMeetingMinutes,
    defaultMeetingPoint: team.defaultMeetingPoint,
    importAliases: team.importAliases,
    leaguePosition: team.leaguePosition,
  };
}

async function activeRows(db: Db, actor: Actor, teamId: string, now: Date) {
  const day = todayIso(actor, now);
  return db
    .select({ membership: s.teamMemberships, person: s.persons })
    .from(s.teamMemberships)
    .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
    .where(
      and(
        eq(s.teamMemberships.teamId, teamId),
        lte(s.teamMemberships.validFrom, day),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, day)),
      ),
    )
    .orderBy(asc(s.persons.lastName), asc(s.persons.firstName));
}

async function audit(db: Db, actor: Actor, action: string, id: string, label: string, now: Date) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: 'team',
    entityId: id,
    data: { label },
    createdAt: now,
  });
}

export async function getTeamManage(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date,
): Promise<TeamManage> {
  const { team } = await loadTeamForActor(db, actor, teamId);
  const canManageSquad = actorCan(actor, 'squad.manage', team);
  const canEditProfile = actorCan(actor, 'events.manage', team);
  if (!canManageSquad && !canEditProfile)
    throw forbidden('Die Mannschaft bearbeitet nur das Trainerteam.');
  const rows = await activeRows(db, actor, team.id, now);
  const treasurers = new Set(
    (
      await db
        .select({ personId: s.roleAssignments.personId })
        .from(s.roleAssignments)
        .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
        .where(
          and(
            eq(s.roleAssignments.clubId, actor.club.id),
            eq(s.roles.key, 'treasurer'),
            eq(s.roleAssignments.scopeType, 'team'),
            eq(s.roleAssignments.scopeId, team.id),
          ),
        )
    ).map((r) => r.personId),
  );
  const order: Record<TeamFunction, number> = {
    coach: 0,
    assistant_coach: 1,
    team_manager: 2,
    player: 3,
  };
  return {
    team: { id: team.id, name: team.name, badge: team.badge },
    profile: await loadProfile(db, team),
    members: rows
      .map(({ membership, person }) => ({
        membershipId: membership.id,
        personId: person.id,
        name: fullName(person),
        function: membership.function,
        jerseyNumber: membership.jerseyNumber,
        isTreasurer: treasurers.has(person.id),
        isMe: person.id === actor.person.id,
      }))
      .sort((a, b) => order[a.function] - order[b.function]),
    canManageSquad,
    canEditProfile,
  };
}

/** Suche in der Vereinsliste (nur Name und Mitgliedsnummer) nach Personen, die noch nicht im Kader sind. */
export async function searchCandidates(
  db: Db,
  actor: Actor,
  teamId: string,
  q: string,
  now: Date,
): Promise<TeamCandidate[]> {
  const team = await loadManaged(db, actor, teamId);
  const term = q.trim();
  if (term.length < 2) return [];
  const inTeam = (await activeRows(db, actor, team.id, now)).map((r) => r.person.id);
  const like = `%${term.replace(/[%_]/g, '')}%`;
  const rows = await db
    .select({
      id: s.persons.id,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
      memberNumber: s.persons.memberNumber,
    })
    .from(s.persons)
    .where(
      and(
        eq(s.persons.clubId, actor.club.id),
        ne(s.persons.membershipStatus, 'left'),
        or(
          ilike(s.persons.firstName, like),
          ilike(s.persons.lastName, like),
          ilike(s.persons.memberNumber, like),
        ),
      ),
    )
    .orderBy(asc(s.persons.lastName), asc(s.persons.firstName))
    .limit(40);
  return rows
    .filter((r) => !inTeam.includes(r.id))
    .slice(0, 20)
    .map((r) => ({ personId: r.id, name: fullName(r), memberNumber: r.memberNumber }));
}

async function checkJersey(
  db: Db,
  actor: Actor,
  teamId: string,
  number: number | null | undefined,
  now: Date,
  exceptMembershipId?: string,
) {
  if (number == null) return;
  const taken = (await activeRows(db, actor, teamId, now)).some(
    (r) =>
      r.membership.function === 'player' &&
      r.membership.jerseyNumber === number &&
      r.membership.id !== exceptMembershipId,
  );
  if (taken) throw new HttpError(409, 'jersey_taken', 'Diese Rückennummer ist schon vergeben.');
}

export async function addTeamMember(
  db: Db,
  actor: Actor,
  teamId: string,
  input: AddTeamMemberInput,
  now: Date,
) {
  const team = await loadManaged(db, actor, teamId);
  if ((input.function as string) === 'coach')
    throw forbidden('Den Trainer einer Mannschaft bestimmt die Vereinsverwaltung.');
  await checkJersey(db, actor, team.id, input.jerseyNumber, now);
  const [person] = await db
    .select({ id: s.persons.id })
    .from(s.persons)
    .where(and(eq(s.persons.id, input.personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw notFound('Die Person');
  // Spielt die Person schon woanders als Stammspieler, ist diese Mannschaft keine Hauptmannschaft
  const elsewhere = await db
    .select({ id: s.teamMemberships.id })
    .from(s.teamMemberships)
    .where(
      and(
        eq(s.teamMemberships.personId, input.personId),
        eq(s.teamMemberships.function, 'player'),
        eq(s.teamMemberships.isPrimaryTeam, true),
        lte(s.teamMemberships.validFrom, todayIso(actor, now)),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, todayIso(actor, now))),
        ne(s.teamMemberships.teamId, team.id),
      ),
    );
  await addMembershipCore(
    db,
    actor,
    input.personId,
    {
      teamId: team.id,
      function: input.function,
      jerseyNumber: input.jerseyNumber ?? null,
      isPrimary: elsewhere.length === 0,
    },
    now,
  );
}

export async function updateTeamMember(
  db: Db,
  actor: Actor,
  teamId: string,
  membershipId: string,
  input: UpdateTeamMemberInput,
  now: Date,
) {
  const team = await loadManaged(db, actor, teamId);
  const row = (await activeRows(db, actor, team.id, now)).find(
    (r) => r.membership.id === membershipId,
  );
  if (!row) throw notFound('Die Zuordnung');
  const current = row.membership.function;
  if (current === 'coach' || (input.function as string) === 'coach')
    throw forbidden('Den Trainer einer Mannschaft bestimmt die Vereinsverwaltung.');
  const fn = input.function ?? current;
  const jersey =
    fn !== 'player'
      ? null
      : input.jerseyNumber === undefined
        ? row.membership.jerseyNumber
        : input.jerseyNumber;
  await checkJersey(db, actor, team.id, jersey, now, membershipId);
  await db.transaction(async (tx) => {
    await tx
      .update(s.teamMemberships)
      .set({ function: fn, jerseyNumber: jersey })
      .where(eq(s.teamMemberships.id, membershipId));
    if (fn !== current) {
      // Rolle im Termin (Spieler ↔ Trainerteam) angleichen
      await tx.delete(s.eventParticipants).where(
        and(
          eq(s.eventParticipants.personId, row.person.id),
          inArray(
            s.eventParticipants.eventId,
            tx
              .select({ id: s.events.id })
              .from(s.events)
              .where(and(eq(s.events.teamId, team.id), eq(s.events.status, 'scheduled'))),
          ),
          eq(s.eventParticipants.role, current === 'player' ? 'player' : 'coach'),
        ),
      );
      await syncFutureParticipation(tx, actor, team, row.person.id, fn, now);
    }
  });
  await audit(
    db,
    actor,
    'team.member_updated',
    team.id,
    `${team.badge}: ${fullName(row.person)} bearbeitet${fn !== current ? ` (${fn})` : ''}`,
    now,
  );
}

export async function removeTeamMember(
  db: Db,
  actor: Actor,
  teamId: string,
  membershipId: string,
  now: Date,
) {
  const team = await loadManaged(db, actor, teamId);
  const row = (await activeRows(db, actor, team.id, now)).find(
    (r) => r.membership.id === membershipId,
  );
  if (!row) throw notFound('Die Zuordnung');
  if (row.membership.function === 'coach')
    throw forbidden('Den Trainer einer Mannschaft bestimmt die Vereinsverwaltung.');
  if (row.person.id === actor.person.id)
    throw forbidden('Du kannst dich nicht selbst aus dem Kader nehmen.');
  await endMembershipCore(db, actor, row.person.id, membershipId, now);
}

export async function updateTeamProfile(
  db: Db,
  actor: Actor,
  teamId: string,
  input: Partial<TeamProfile>,
  now: Date,
): Promise<TeamProfile> {
  const { team } = await loadTeamForActor(db, actor, teamId);
  if (!actorCan(actor, 'events.manage', team))
    throw forbidden('Das Mannschaftsprofil bearbeitet nur das Trainerteam.');
  const patch: Partial<typeof s.teams.$inferInsert> = {};
  if (input.matchMeetingMinutes !== undefined)
    patch.matchMeetingMinutes = input.matchMeetingMinutes;
  if (input.trainingMeetingMinutes !== undefined)
    patch.trainingMeetingMinutes = input.trainingMeetingMinutes;
  if (input.defaultMeetingPoint !== undefined)
    patch.defaultMeetingPoint = input.defaultMeetingPoint?.trim() || null;
  if (input.leaguePosition !== undefined) patch.leaguePosition = input.leaguePosition;
  if (input.importAliases !== undefined)
    patch.importAliases = [...new Set(input.importAliases.map((a) => a.trim()).filter(Boolean))];
  // Antwortfristen: je Terminart eine relative Regel; leer löscht sie
  const deadlines = [
    ['training', input.trainingDeadlineHours],
    ['match', input.matchDeadlineHours],
  ] as const;
  const deadlinesChanged = deadlines.some(([, v]) => v !== undefined);
  for (const [eventType, hours] of deadlines) {
    if (hours === undefined) continue;
    if (hours === null) {
      await db
        .delete(s.teamDeadlineRules)
        .where(
          and(
            eq(s.teamDeadlineRules.teamId, team.id),
            eq(s.teamDeadlineRules.eventType, eventType),
          ),
        );
    } else {
      await db
        .insert(s.teamDeadlineRules)
        .values({
          clubId: team.clubId,
          teamId: team.id,
          eventType,
          kind: 'relative',
          minutesBefore: hours * 60,
          weekday: null,
          timeOfDay: null,
        })
        .onConflictDoUpdate({
          target: [s.teamDeadlineRules.teamId, s.teamDeadlineRules.eventType],
          set: { kind: 'relative', minutesBefore: hours * 60, weekday: null, timeOfDay: null },
        });
    }
  }
  if (Object.keys(patch).length === 0 && !deadlinesChanged) return loadProfile(db, team);
  const [updated] =
    Object.keys(patch).length > 0
      ? await db
          .update(s.teams)
          .set({ ...patch, updatedAt: now })
          .where(eq(s.teams.id, team.id))
          .returning()
      : [team];
  await audit(db, actor, 'team.profile', team.id, `${team.badge}: Mannschaftsprofil geändert`, now);
  return loadProfile(db, updated!);
}
