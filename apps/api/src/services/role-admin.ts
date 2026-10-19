/**
 * Eigene Rollen je Verein (Paket ROLLEN-VERWALTUNG): anlegen, ändern, löschen (archivieren) und wiederherstellen,
 * dazu die Rechtevorschau einer Person. Schutzregeln, serverseitig:
 *  - nur Admins mit `club.roles.manage`; man vergibt nur Rechte, die man selbst vereinsweit besitzt;
 *  - Standardrollen sind schreibgeschützt (nur kopieren);
 *  - vereinsweite Rechte (Verein, Vereinskasse, Mitglieder) gehören nicht in Abteilungs- oder Mannschaftsrollen;
 *  - Namen 3–40 Zeichen und eindeutig je Verein, der Schlüssel wird daraus abgeleitet.
 */
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  isClubOnlyPermission,
  isPermission,
  type EffectivePermissions,
  type RoleInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, inArray } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';

function requireManageRoles(actor: Actor) {
  if (!actorCan(actor, 'club.roles.manage'))
    throw forbidden('Rollen legen und ändern nur Admins an.');
}

async function audit(
  db: Db,
  actor: Actor,
  action: string,
  entityId: string,
  label: string,
  now: Date,
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: 'role',
    entityId,
    data: { label },
    createdAt: now,
  });
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);

function validate(actor: Actor, input: RoleInput) {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 40)
    throw new HttpError(400, 'invalid_name', 'Der Name braucht 3 bis 40 Zeichen.');
  const permissions = [...new Set(input.permissions)];
  if (permissions.some((p) => !isPermission(p)))
    throw new HttpError(400, 'invalid_permission', 'Unbekanntes Recht.');
  // Keine Rechteausweitung: nur Rechte vergeben, die man selbst vereinsweit hat
  if (permissions.some((p) => !actorCan(actor, p as never)))
    throw forbidden('Du kannst nur Rechte vergeben, die du selbst hast.');
  if (input.defaultScope !== 'club' && permissions.some(isClubOnlyPermission))
    throw new HttpError(
      400,
      'club_only',
      'Vereinsweite Rechte (Verein, Vereinskasse, Mitglieder) gehören nur in vereinsweite Rollen.',
    );
  return { name, permissions, description: input.description?.trim() || null };
}

async function loadCustom(db: Db, actor: Actor, key: string) {
  const [role] = await db
    .select()
    .from(s.roles)
    .where(and(eq(s.roles.clubId, actor.club.id), eq(s.roles.key, key)));
  if (!role) throw notFound('Die Rolle');
  if (role.isSystem)
    throw new HttpError(
      409,
      'system_role',
      'Standardrollen sind geschützt. Kopiere die Rolle und passe die Kopie an.',
    );
  return role;
}

async function uniqueKey(db: Db, clubId: string, name: string) {
  const rows = await db.select().from(s.roles).where(eq(s.roles.clubId, clubId));
  if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase() && !r.archivedAt))
    throw new HttpError(409, 'exists', 'Eine Rolle mit diesem Namen gibt es schon.');
  const base = `custom_${slug(name) || 'rolle'}`;
  const keys = new Set(rows.map((r) => r.key));
  let key = base;
  for (let i = 2; keys.has(key); i++) key = `${base}_${i}`;
  return key;
}

export async function createRole(db: Db, actor: Actor, input: RoleInput, now: Date) {
  requireManageRoles(actor);
  const v = validate(actor, input);
  const key = await uniqueKey(db, actor.club.id, v.name);
  const [row] = await db
    .insert(s.roles)
    .values({
      clubId: actor.club.id,
      key,
      name: v.name,
      description: v.description,
      isSystem: false,
      permissions: v.permissions,
      scopeDefault: input.defaultScope,
      knownPermissions: ALL_PERMISSIONS,
      createdAt: now,
    })
    .returning({ id: s.roles.id });
  await audit(
    db,
    actor,
    'role.created',
    row!.id,
    `Rolle angelegt: ${v.name} (${v.permissions.length} Rechte)`,
    now,
  );
  return key;
}

export async function updateRole(db: Db, actor: Actor, key: string, input: RoleInput, now: Date) {
  requireManageRoles(actor);
  const role = await loadCustom(db, actor, key);
  if (role.archivedAt) throw new HttpError(409, 'archived', 'Die Rolle ist gelöscht.');
  const v = validate(actor, input);
  if (v.name.toLowerCase() !== role.name.toLowerCase()) await uniqueKey(db, actor.club.id, v.name);
  // Wer die Rolle trägt und damit Rollen verwaltet, darf sich das Recht nicht selbst nehmen
  const mine = actor.grants.some((g) => g.key === key);
  if (
    mine &&
    role.permissions.includes('club.roles.manage') &&
    !v.permissions.includes('club.roles.manage')
  )
    throw new HttpError(409, 'self', 'Damit würdest du dich selbst aussperren.');
  // Bereichswechsel: bestehende Vergaben dürfen nicht gegen die Bereichsregel verstoßen
  if (input.defaultScope !== 'club' && v.permissions.some(isClubOnlyPermission))
    throw new HttpError(
      400,
      'club_only',
      'Vereinsweite Rechte gehören nur in vereinsweite Rollen.',
    );
  await db
    .update(s.roles)
    .set({
      name: v.name,
      description: v.description,
      permissions: v.permissions,
      scopeDefault: input.defaultScope,
      knownPermissions: ALL_PERMISSIONS,
    })
    .where(eq(s.roles.id, role.id));
  const added = v.permissions.filter((p) => !role.permissions.includes(p));
  const removed = role.permissions.filter((p) => !v.permissions.includes(p));
  await audit(
    db,
    actor,
    'role.updated',
    role.id,
    `Rolle geändert: ${v.name}${added.length ? `, +${added.join(', ')}` : ''}${removed.length ? `, −${removed.join(', ')}` : ''}`,
    now,
  );
}

/** Löschen heißt archivieren: Personen werden auf eine andere Rolle umgestellt oder verlieren die Rolle. */
export async function deleteRole(
  db: Db,
  actor: Actor,
  key: string,
  moveToKey: string | null,
  now: Date,
) {
  requireManageRoles(actor);
  const role = await loadCustom(db, actor, key);
  if (role.archivedAt) return;
  if (actor.grants.some((g) => g.key === key) && role.permissions.includes('club.roles.manage'))
    throw new HttpError(409, 'self', 'Damit würdest du dich selbst aussperren.');
  const holders = await db
    .select()
    .from(s.roleAssignments)
    .where(eq(s.roleAssignments.roleId, role.id));
  if (moveToKey) {
    const [target] = await db
      .select()
      .from(s.roles)
      .where(and(eq(s.roles.clubId, actor.club.id), eq(s.roles.key, moveToKey)));
    if (!target || target.archivedAt || target.id === role.id)
      throw new HttpError(400, 'invalid_role', 'Unbekannte Zielrolle.');
    if (target.permissions.some((p) => !isPermission(p) || !actorCan(actor, p)))
      throw forbidden('Du kannst keine Rolle vergeben, die mehr Rechte hat als du selbst.');
    const existing = await db
      .select()
      .from(s.roleAssignments)
      .where(eq(s.roleAssignments.roleId, target.id));
    for (const h of holders) {
      const dup = existing.some(
        (e) => e.personId === h.personId && e.scopeType === h.scopeType && e.scopeId === h.scopeId,
      );
      if (!dup)
        await db.insert(s.roleAssignments).values({
          clubId: h.clubId,
          personId: h.personId,
          roleId: target.id,
          scopeType: h.scopeType,
          scopeId: h.scopeId,
        });
    }
  }
  if (holders.length)
    await db.delete(s.roleAssignments).where(eq(s.roleAssignments.roleId, role.id));
  await db.update(s.roles).set({ archivedAt: now }).where(eq(s.roles.id, role.id));
  await audit(
    db,
    actor,
    'role.deleted',
    role.id,
    `Rolle gelöscht: ${role.name} (${holders.length} Vergaben ${moveToKey ? 'umgestellt' : 'entzogen'})`,
    now,
  );
}

export async function restoreRole(db: Db, actor: Actor, key: string, now: Date) {
  requireManageRoles(actor);
  const role = await loadCustom(db, actor, key);
  if (!role.archivedAt) return;
  await uniqueKey(db, actor.club.id, role.name);
  await db.update(s.roles).set({ archivedAt: null }).where(eq(s.roles.id, role.id));
  await audit(db, actor, 'role.restored', role.id, `Rolle wiederhergestellt: ${role.name}`, now);
}

/** „Was darf diese Person?“ – jedes Recht mit seinen Quellen. */
export async function effectivePermissions(
  db: Db,
  actor: Actor,
  personId: string,
): Promise<EffectivePermissions> {
  if (!actorCan(actor, 'club.roles.manage') && !actorCan(actor, 'members.read'))
    throw forbidden('Die Rechtevorschau sehen Vorstand und Administration.');
  const [person] = await db
    .select()
    .from(s.persons)
    .where(and(eq(s.persons.id, personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw notFound('Das Mitglied');
  const rows = await db
    .select({ a: s.roleAssignments, role: s.roles })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .where(eq(s.roleAssignments.personId, personId));
  const scopeIds = rows.map((r) => r.a.scopeId).filter((x): x is string => !!x);
  const units = scopeIds.length
    ? await db.select().from(s.orgUnits).where(inArray(s.orgUnits.id, scopeIds))
    : [];
  const teams = scopeIds.length
    ? await db.select().from(s.teams).where(inArray(s.teams.id, scopeIds))
    : [];
  const scopeLabel = (type: string, id: string | null) =>
    type === 'club'
      ? 'Verein'
      : (units.find((u) => u.id === id)?.name ?? teams.find((t) => t.id === id)?.name ?? '');
  const [individual] = await db
    .select({ permissions: s.personPermissions.permissions })
    .from(s.personPermissions)
    .where(eq(s.personPermissions.personId, personId));
  const sources = new Map<string, string[]>();
  const add = (p: string, source: string) => sources.set(p, [...(sources.get(p) ?? []), source]);
  for (const r of rows)
    for (const p of r.role.permissions)
      add(p, `${r.role.name} (${scopeLabel(r.a.scopeType, r.a.scopeId)})`);
  for (const p of individual?.permissions ?? []) add(p, 'Individuelle Rechte');
  return {
    personName: `${person.firstName} ${person.lastName}`,
    permissions: ALL_PERMISSIONS.filter((p) => sources.has(p)).map((p) => ({
      key: p,
      label: PERMISSIONS[p],
      sources: sources.get(p)!,
    })),
  };
}
