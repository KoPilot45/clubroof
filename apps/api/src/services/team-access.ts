import type { TeamPermissions } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { forbidden, notFound } from '../errors';

export type TeamRow = typeof s.teams.$inferSelect;

export function teamPermissions(actor: Actor, team: TeamRow): TeamPermissions {
  return {
    manageEvents: actorCan(actor, 'events.manage', team),
    overrideAttendance: actorCan(actor, 'attendance.override', team),
    readAttendance: actorCan(actor, 'attendance.read', team),
    readCash: actorCan(actor, 'cash.read', team),
    manageCash: actorCan(actor, 'cash.manage', team),
    manageDemand: actorCan(actor, 'squad.demand.manage', team),
    manageModules:
      actorCan(actor, 'teams.modules.manage', team) ||
      actorCan(actor, 'teams.manage', team) ||
      actorCan(actor, 'club.modules.manage'),
  };
}

/**
 * Lädt eine Mannschaft, wenn der Nutzer (oder ein Kind) Mitglied ist oder Rechte für sie hat.
 * Andere Mannschaften gelten als nicht vorhanden.
 */
export async function loadTeamForActor(db: Db, actor: Actor, teamId: string) {
  const [team] = await db
    .select()
    .from(s.teams)
    .where(and(eq(s.teams.id, teamId), eq(s.teams.clubId, actor.club.id)));
  if (!team) throw notFound('Die Mannschaft');
  const permissions = teamPermissions(actor, team);
  const isMember = actor.teamIds.includes(team.id);
  if (!isMember && !Object.values(permissions).some(Boolean)) throw notFound('Die Mannschaft');
  return { team, permissions, isMember };
}

export function requireModule(actor: Actor, moduleKey: string, team: TeamRow) {
  if (!moduleEnabled(actor, moduleKey, team)) {
    throw forbidden('Diese Funktion ist für die Mannschaft nicht aktiviert.');
  }
}
