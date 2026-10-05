/**
 * Vereinseinstellungen (Fulladmin, `club.settings.manage`): Name, Kurzname, Farbe, Darstellung,
 * Bereiche und die Vorgabe zur 2-Faktor-Anmeldung.
 */
import type { ClubSettings, OrgUnitKind, UpdateClubInput } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, eq } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';

function requireSettings(actor: Actor) {
  if (!actorCan(actor, 'club.settings.manage'))
    throw forbidden('Die Vereinseinstellungen ändert die Vereinsadministration.');
}

async function audit(db: Db, actor: Actor, label: string, now: Date) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'club.updated',
    entityType: 'club',
    entityId: actor.club.id,
    data: { label },
    createdAt: now,
  });
}

export async function getClubSettings(db: Db, actor: Actor): Promise<ClubSettings> {
  requireSettings(actor);
  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.id, actor.club.id));
  const units = await db
    .select({ unit: s.orgUnits, teams: count(s.teams.id) })
    .from(s.orgUnits)
    .leftJoin(s.teams, eq(s.teams.orgUnitId, s.orgUnits.id))
    .where(eq(s.orgUnits.clubId, actor.club.id))
    .groupBy(s.orgUnits.id)
    .orderBy(asc(s.orgUnits.sortOrder));
  return {
    name: club!.name,
    shortName: club!.shortName,
    colorTheme: club!.colorTheme,
    colorMode: club!.colorMode,
    requireTwoFactor: club!.requireTwoFactor,
    canRequireTwoFactor: actor.user.twoFactorEnabled === true,
    orgUnits: units.map((u) => ({
      id: u.unit.id,
      name: u.unit.name,
      kind: u.unit.kind as OrgUnitKind,
      teams: Number(u.teams),
    })),
  };
}

export async function updateClub(
  db: Db,
  actor: Actor,
  input: UpdateClubInput,
  now: Date,
): Promise<ClubSettings> {
  requireSettings(actor);
  if (input.requireTwoFactor && !actor.user.twoFactorEnabled) {
    throw new HttpError(
      409,
      'own_two_factor',
      'Richte zuerst selbst die 2-Faktor-Anmeldung ein, bevor du sie für alle verlangst.',
    );
  }
  const patch: Partial<typeof s.clubs.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.shortName !== undefined) patch.shortName = input.shortName.trim();
  if (input.colorTheme !== undefined) patch.colorTheme = input.colorTheme;
  if (input.colorMode !== undefined) patch.colorMode = input.colorMode;
  if (input.requireTwoFactor !== undefined) patch.requireTwoFactor = input.requireTwoFactor;
  if (Object.keys(patch).length) {
    await db.update(s.clubs).set(patch).where(eq(s.clubs.id, actor.club.id));
    const what = [
      patch.name || patch.shortName ? 'Name' : null,
      patch.colorTheme || patch.colorMode ? 'Design' : null,
      patch.requireTwoFactor !== undefined
        ? `2-Faktor-Pflicht ${patch.requireTwoFactor ? 'an' : 'aus'}`
        : null,
    ].filter(Boolean);
    await audit(db, actor, `Vereinseinstellungen geändert: ${what.join(', ')}`, now);
  }
  return getClubSettings(db, actor);
}

export async function addOrgUnit(
  db: Db,
  actor: Actor,
  input: { name: string; kind: OrgUnitKind },
  now: Date,
): Promise<ClubSettings> {
  requireSettings(actor);
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(s.orgUnits)
    .where(eq(s.orgUnits.clubId, actor.club.id));
  await db.insert(s.orgUnits).values({
    clubId: actor.club.id,
    name: input.name.trim(),
    kind: input.kind,
    sortOrder: Number(n),
  });
  await audit(db, actor, `Bereich angelegt: ${input.name.trim()}`, now);
  return getClubSettings(db, actor);
}

export async function renameOrgUnit(db: Db, actor: Actor, id: string, name: string, now: Date) {
  requireSettings(actor);
  const updated = await db
    .update(s.orgUnits)
    .set({ name: name.trim() })
    .where(and(eq(s.orgUnits.id, id), eq(s.orgUnits.clubId, actor.club.id)))
    .returning({ id: s.orgUnits.id });
  if (!updated.length) throw notFound('Der Bereich');
  await audit(db, actor, `Bereich umbenannt: ${name.trim()}`, now);
  return getClubSettings(db, actor);
}

export async function deleteOrgUnit(db: Db, actor: Actor, id: string, now: Date) {
  requireSettings(actor);
  const settings = await getClubSettings(db, actor);
  const unit = settings.orgUnits.find((u) => u.id === id);
  if (!unit) throw notFound('Der Bereich');
  if (unit.teams > 0)
    throw new HttpError(
      409,
      'in_use',
      'Der Bereich hat Mannschaften und kann nicht gelöscht werden.',
    );
  const [assigned] = await db
    .select({ id: s.roleAssignments.id })
    .from(s.roleAssignments)
    .where(and(eq(s.roleAssignments.scopeType, 'org_unit'), eq(s.roleAssignments.scopeId, id)))
    .limit(1);
  if (assigned)
    throw new HttpError(
      409,
      'in_use',
      'Für den Bereich sind noch Rollen vergeben (z. B. Jugendleitung).',
    );
  await db.delete(s.orgUnits).where(eq(s.orgUnits.id, id));
  await audit(db, actor, `Bereich gelöscht: ${unit.name}`, now);
  return getClubSettings(db, actor);
}
