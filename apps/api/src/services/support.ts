/**
 * Support-Zugriff und Admin-Wiederherstellung (Mandantenbetrieb). Der Betreiber sieht Vereinsdaten nie von sich aus:
 * Erst die Freigabe eines Admins (zeitlich begrenzt, widerrufbar) öffnet eine schreibgeschützte Sicht auf
 * Einstellungen und Protokoll – ohne Personen-, Kassen- oder Termindaten. Jeder Abruf steht in beiden Protokollen.
 */
import type { AdminRecoveryInfo, ClubStatus, SupportAccess, SupportView } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, count, desc, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { generateToken, hashToken } from '../auth/session';
import { HttpError, forbidden, notFound } from '../errors';
import { deliver } from '../notify/deliver';
import type { Mailer } from '../security/mailer';
import { codeHash, generateCode } from './codes';
import { logOperator } from './operator';

const HOUR = 3600_000;
const RECOVERY_WAIT_HOURS = 48;
const INVITE_DAYS = 14;
export const SUPPORT_HOURS = [1, 24, 168] as const;

function requireSettings(actor: Actor) {
  if (!actorCan(actor, 'club.settings.manage'))
    throw forbidden('Das dürfen nur Administration und Vorstand.');
}

function recoveryOf(row: typeof s.adminRecoveries.$inferSelect, now: Date): AdminRecoveryInfo {
  return {
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    email: row.email,
    notBefore: row.notBefore.toISOString(),
    status: row.completedAt
      ? 'completed'
      : row.objectedAt
        ? 'objected'
        : row.notBefore <= now
          ? 'ready'
          : 'waiting',
    createdAt: row.createdAt.toISOString(),
  };
}

async function openRecoveries(db: Db, clubId: string, now: Date) {
  const rows = await db
    .select()
    .from(s.adminRecoveries)
    .where(and(eq(s.adminRecoveries.clubId, clubId), isNull(s.adminRecoveries.completedAt)))
    .orderBy(desc(s.adminRecoveries.createdAt));
  return rows.map((r) => recoveryOf(r, now));
}

async function activeGrant(db: Db, clubId: string, now: Date) {
  const [grant] = await db
    .select()
    .from(s.supportGrants)
    .where(
      and(
        eq(s.supportGrants.clubId, clubId),
        isNull(s.supportGrants.revokedAt),
        gt(s.supportGrants.expiresAt, now),
      ),
    )
    .orderBy(desc(s.supportGrants.expiresAt))
    .limit(1);
  return grant ?? null;
}

// ── Seite des Vereins ───────────────────────────────────────────────────────

export async function getSupportAccess(db: Db, actor: Actor, now: Date): Promise<SupportAccess> {
  requireSettings(actor);
  const grant = await activeGrant(db, actor.club.id, now);
  return {
    active: !!grant,
    expiresAt: grant?.expiresAt.toISOString() ?? null,
    recoveries: await openRecoveries(db, actor.club.id, now),
  };
}

export async function grantSupport(
  db: Db,
  actor: Actor,
  hours: number,
  now: Date,
): Promise<SupportAccess> {
  requireSettings(actor);
  if (!(SUPPORT_HOURS as readonly number[]).includes(hours))
    throw new HttpError(400, 'invalid_duration', 'Bitte 1 Stunde, 1 Tag oder 7 Tage wählen.');
  await db
    .update(s.supportGrants)
    .set({ revokedAt: now })
    .where(and(eq(s.supportGrants.clubId, actor.club.id), isNull(s.supportGrants.revokedAt)));
  await db.insert(s.supportGrants).values({
    clubId: actor.club.id,
    grantedByPersonId: actor.person.id,
    expiresAt: new Date(now.getTime() + hours * HOUR),
    createdAt: now,
  });
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'support.granted',
    entityType: 'club',
    entityId: actor.club.id,
    data: { label: `Support-Zugriff freigegeben für ${hours} Stunden` },
    createdAt: now,
  });
  return getSupportAccess(db, actor, now);
}

export async function revokeSupport(db: Db, actor: Actor, now: Date): Promise<SupportAccess> {
  requireSettings(actor);
  await db
    .update(s.supportGrants)
    .set({ revokedAt: now })
    .where(and(eq(s.supportGrants.clubId, actor.club.id), isNull(s.supportGrants.revokedAt)));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'support.revoked',
    entityType: 'club',
    entityId: actor.club.id,
    data: { label: 'Support-Zugriff beendet' },
    createdAt: now,
  });
  return getSupportAccess(db, actor, now);
}

/** Widerspruch gegen eine angekündigte Admin-Wiederherstellung (jeder Admin oder Vorstand). */
export async function objectRecovery(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<SupportAccess> {
  requireSettings(actor);
  const [row] = await db
    .update(s.adminRecoveries)
    .set({ objectedAt: now, objectedByPersonId: actor.person.id })
    .where(
      and(
        eq(s.adminRecoveries.id, id),
        eq(s.adminRecoveries.clubId, actor.club.id),
        isNull(s.adminRecoveries.completedAt),
      ),
    )
    .returning({ id: s.adminRecoveries.id });
  if (!row) throw notFound('Die Wiederherstellung');
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'recovery.objected',
    entityType: 'club',
    entityId: actor.club.id,
    data: { label: 'Widerspruch gegen die Admin-Wiederherstellung' },
    createdAt: now,
  });
  return getSupportAccess(db, actor, now);
}

// ── Seite des Betreibers ────────────────────────────────────────────────────

/** Admins und Vorstand des Vereins (Empfänger von Hinweisen, Anzeige im Support). */
async function adminPersons(db: Db, clubId: string) {
  return db
    .selectDistinct({
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
      email: s.persons.email,
      userId: s.persons.userId,
      lastLoginAt: s.users.lastLoginAt,
      id: s.persons.id,
    })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .innerJoin(s.persons, eq(s.persons.id, s.roleAssignments.personId))
    .leftJoin(s.users, eq(s.users.id, s.persons.userId))
    .where(
      and(
        eq(s.roleAssignments.clubId, clubId),
        inArray(s.roles.key, ['fulladmin', 'board']),
        ne(s.persons.membershipStatus, 'left'),
      ),
    );
}

export async function supportView(
  db: Db,
  operatorUserId: string,
  clubId: string,
  now: Date,
): Promise<SupportView> {
  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.id, clubId));
  if (!club) throw notFound('Der Verein');
  if (!(await activeGrant(db, clubId, now)))
    throw new HttpError(
      403,
      'support_not_granted',
      'Der Verein hat den Support-Zugriff nicht freigegeben.',
    );
  await logOperator(db, operatorUserId, 'support.viewed', clubId, null, now);
  await db.insert(s.auditLog).values({
    clubId,
    actorUserId: operatorUserId,
    action: 'support.viewed',
    entityType: 'club',
    entityId: clubId,
    data: { label: 'Betreiber-Support hat die Support-Ansicht geöffnet' },
    createdAt: now,
  });
  const [{ members = 0 } = {}] = await db
    .select({ members: count() })
    .from(s.persons)
    .where(and(eq(s.persons.clubId, clubId), ne(s.persons.membershipStatus, 'left')));
  const [{ teams = 0 } = {}] = await db
    .select({ teams: count() })
    .from(s.teams)
    .where(eq(s.teams.clubId, clubId));
  const modules = await db
    .select({ key: s.moduleSettings.moduleKey, state: s.moduleSettings.state })
    .from(s.moduleSettings)
    .where(and(eq(s.moduleSettings.clubId, clubId), eq(s.moduleSettings.scopeType, 'club')));
  const audit = await db
    .select({
      at: s.auditLog.createdAt,
      data: s.auditLog.data,
      action: s.auditLog.action,
      actor: s.users.displayName,
    })
    .from(s.auditLog)
    .leftJoin(s.users, eq(s.users.id, s.auditLog.actorUserId))
    .where(eq(s.auditLog.clubId, clubId))
    .orderBy(desc(s.auditLog.createdAt))
    .limit(50);
  const admins = await adminPersons(db, clubId);
  return {
    club: {
      name: club.name,
      shortName: club.shortName,
      status: club.status as ClubStatus,
      timezone: club.timezone,
      requireTwoFactor: club.requireTwoFactor,
      createdAt: club.createdAt.toISOString(),
    },
    counts: { members: Number(members), teams: Number(teams) },
    modules,
    admins: admins.map((a) => ({
      name: `${a.firstName} ${a.lastName}`,
      email: a.email,
      hasAccount: !!a.userId,
      lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    })),
    audit: audit.map((a) => ({
      at: a.at.toISOString(),
      actor: a.actor,
      label: String((a.data as { label?: string } | null)?.label ?? a.action),
    })),
    recoveries: await openRecoveries(db, clubId, now),
  };
}

/** Admin-Wiederherstellung ankündigen: Frist von 48 Stunden, Hinweis an Vereinsadresse und alle Admins/Vorstände. */
export async function startRecovery(
  db: Db,
  mailer: Mailer,
  operatorUserId: string,
  clubId: string,
  input: { firstName: string; lastName: string; email: string; note?: string | null },
  now: Date,
): Promise<AdminRecoveryInfo> {
  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.id, clubId));
  if (!club) throw notFound('Der Verein');
  const open = await openRecoveries(db, clubId, now);
  if (open.some((r) => r.status !== 'objected'))
    throw new HttpError(
      409,
      'recovery_open',
      'Für diesen Verein läuft bereits eine Admin-Wiederherstellung.',
    );
  const email = input.email.trim().toLowerCase();
  const [row] = await db
    .insert(s.adminRecoveries)
    .values({
      clubId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      note: input.note?.trim() || null,
      createdByUserId: operatorUserId,
      notBefore: new Date(now.getTime() + RECOVERY_WAIT_HOURS * HOUR),
      createdAt: now,
    })
    .returning();
  await logOperator(
    db,
    operatorUserId,
    'recovery.started',
    clubId,
    { email, note: input.note?.trim() || null },
    now,
  );
  await db.insert(s.auditLog).values({
    clubId,
    actorUserId: operatorUserId,
    action: 'recovery.started',
    entityType: 'club',
    entityId: clubId,
    data: {
      label: `Admin-Wiederherstellung angekündigt: ${input.firstName.trim()} ${input.lastName.trim()}`,
    },
    createdAt: now,
  });
  const admins = await adminPersons(db, clubId);
  const text = [
    `Für ${club.name} wurde eine Admin-Wiederherstellung angekündigt.`,
    '',
    `Neuer Admin: ${input.firstName.trim()} ${input.lastName.trim()} (${email})`,
    `Frühester Start: ${row!.notBefore.toISOString()}`,
    '',
    `Wenn das nicht stimmt, widersprecht bitte bis dahin in der App unter Verwaltung › Einstellungen › Support.`,
  ].join('\n');
  const recipients = new Set<string>(admins.map((a) => a.email).filter((e): e is string => !!e));
  if (club.email) recipients.add(club.email);
  for (const to of recipients)
    await mailer.send({ to, subject: `Admin-Wiederherstellung für ${club.name}`, text });
  await deliver(
    db,
    club,
    admins.map((a) => a.userId).filter((u): u is string => !!u),
    {
      level: 'urgent',
      topic: 'admin',
      title: 'Admin-Wiederherstellung angekündigt',
      body: `${input.firstName.trim()} ${input.lastName.trim()} soll Admin werden. Widerspruch bis ${row!.notBefore.toISOString().slice(0, 16).replace('T', ' ')} UTC möglich.`,
      link: '/admin/support',
    },
    now,
  );
  return recoveryOf(row!, now);
}

/** Nach Ablauf der Frist (und ohne Widerspruch): Person anlegen, Admin-Rolle vergeben, Einladung senden. */
export async function completeRecovery(
  db: Db,
  mailer: Mailer,
  operatorUserId: string,
  id: string,
  appUrl: string,
  now: Date,
): Promise<AdminRecoveryInfo> {
  const [row] = await db.select().from(s.adminRecoveries).where(eq(s.adminRecoveries.id, id));
  if (!row || row.completedAt) throw notFound('Die Wiederherstellung');
  if (row.objectedAt)
    throw new HttpError(409, 'recovery_objected', 'Der Verein hat widersprochen.');
  if (row.notBefore > now)
    throw new HttpError(409, 'recovery_waiting', 'Die Wartefrist läuft noch.');
  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.id, row.clubId));
  const [role] = await db
    .select({ id: s.roles.id })
    .from(s.roles)
    .where(and(eq(s.roles.clubId, row.clubId), eq(s.roles.key, 'fulladmin')));
  if (!club || !role) throw notFound('Der Verein');
  const token = generateToken();
  const code = generateCode(8);
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 24 * HOUR);
  await db.transaction(async (tx) => {
    const [done] = await tx
      .update(s.adminRecoveries)
      .set({ completedAt: now })
      .where(and(eq(s.adminRecoveries.id, id), isNull(s.adminRecoveries.completedAt)))
      .returning({ id: s.adminRecoveries.id });
    if (!done) throw notFound('Die Wiederherstellung');
    const [person] = await tx
      .insert(s.persons)
      .values({
        clubId: row.clubId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        memberSince: now.toISOString().slice(0, 10),
      })
      .returning({ id: s.persons.id });
    await tx.insert(s.roleAssignments).values({
      clubId: row.clubId,
      personId: person!.id,
      roleId: role.id,
      scopeType: 'club',
    });
    await tx.insert(s.invitations).values({
      clubId: row.clubId,
      kind: 'person',
      tokenHash: hashToken(token),
      codeHash: codeHash(code),
      personId: person!.id,
      email: row.email,
      expiresAt,
      maxUses: 1,
      createdAt: now,
    });
    await tx.insert(s.auditLog).values({
      clubId: row.clubId,
      actorUserId: operatorUserId,
      action: 'recovery.completed',
      entityType: 'person',
      entityId: person!.id,
      data: { label: `Neuer Admin eingeladen: ${row.firstName} ${row.lastName}` },
      createdAt: now,
    });
  });
  await logOperator(
    db,
    operatorUserId,
    'recovery.completed',
    row.clubId,
    { email: row.email },
    now,
  );
  await mailer.send({
    to: row.email,
    subject: `Einladung als Admin von ${club.name}`,
    text: [
      `Hallo ${row.firstName},`,
      '',
      `du wurdest als Administrator von ${club.name} eingeladen. Über diesen Link legst du dein Passwort fest (gültig ${INVITE_DAYS} Tage):`,
      '',
      `${appUrl}/join/${token}`,
      '',
      `Oder gib in der App diesen Code ein: ${code}`,
    ].join('\n'),
  });
  return recoveryOf({ ...row, completedAt: now }, now);
}
