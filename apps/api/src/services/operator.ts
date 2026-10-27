/**
 * Betreiber der Plattform (Mandantenbetrieb). Betreiber haben keine Vereinsrechte: Die Konsole zeigt nur
 * Kennzahlen und steuert Lebenszyklus (Einrichtungscode, Sperren). Jede Aktion landet in `operator_audit`.
 */
import type {
  ClubStatus,
  OperatorClub,
  OperatorInvite,
  OperatorInviteResult,
  OperatorOverview,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, count, desc, eq, isNull, max, ne } from 'drizzle-orm';
import { findSessionUser, type SessionUser } from '../auth/session';
import { HttpError, forbidden, notFound, unauthorized } from '../errors';
import type { Mailer } from '../security/mailer';
import { codeHash, generateCode } from './codes';

const DAY = 24 * 3600_000;
const INVITE_DAYS = 14;

/** Prüft Sitzung, Betreiberrecht und 2-Faktor-Anmeldung (Pflicht für Betreiber). */
export async function authenticateOperator(
  db: Db,
  authorization: string | undefined,
  now: Date,
): Promise<SessionUser> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
  if (!token) throw unauthorized();
  const user = await findSessionUser(db, token, now);
  if (!user) throw unauthorized();
  const [op] = await db
    .select({ active: s.operators.active })
    .from(s.operators)
    .where(eq(s.operators.userId, user.id));
  // Gleiche Antwort wie für „nicht gefunden“, damit die Konsole nicht erkundet werden kann
  if (!op?.active) throw notFound('Die Seite');
  if (!user.twoFactorEnabled)
    throw new HttpError(
      403,
      'two_factor_required',
      'Für den Betreiberzugang ist die 2-Faktor-Anmeldung Pflicht.',
    );
  return user;
}

export async function logOperator(
  db: Db,
  operatorUserId: string | null,
  action: string,
  clubId: string | null,
  data: Record<string, unknown> | null,
  now: Date,
) {
  await db.insert(s.operatorAudit).values({ operatorUserId, clubId, action, data, createdAt: now });
}

function inviteOf(row: typeof s.clubSetupInvites.$inferSelect, now: Date): OperatorInvite {
  const status = row.usedAt
    ? 'used'
    : row.revokedAt
      ? 'revoked'
      : row.expiresAt <= now
        ? 'expired'
        : 'open';
  return {
    id: row.id,
    adminEmail: row.adminEmail,
    clubNameHint: row.clubNameHint,
    expiresAt: row.expiresAt.toISOString(),
    status,
    clubId: row.clubId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function operatorOverview(db: Db, now: Date): Promise<OperatorOverview> {
  const clubs = await db.select().from(s.clubs).orderBy(s.clubs.name);
  const members = await db
    .select({ clubId: s.persons.clubId, n: count() })
    .from(s.persons)
    .where(ne(s.persons.membershipStatus, 'left'))
    .groupBy(s.persons.clubId);
  const logins = await db
    .select({ clubId: s.persons.clubId, last: max(s.users.lastLoginAt) })
    .from(s.persons)
    .innerJoin(s.users, eq(s.users.id, s.persons.userId))
    .groupBy(s.persons.clubId);
  const teams = await db
    .select({ clubId: s.teams.clubId, n: count() })
    .from(s.teams)
    .groupBy(s.teams.clubId);
  const invites = await db
    .select()
    .from(s.clubSetupInvites)
    .orderBy(desc(s.clubSetupInvites.createdAt));
  return {
    clubs: clubs.map((c): OperatorClub => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      status: c.status as ClubStatus,
      members: Number(members.find((m) => m.clubId === c.id)?.n ?? 0),
      teams: Number(teams.find((m) => m.clubId === c.id)?.n ?? 0),
      lastLoginAt: logins.find((l) => l.clubId === c.id)?.last?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    invites: invites.map((i) => inviteOf(i, now)),
  };
}

/** Einrichtungscode für einen neuen Verein erzeugen und dem Admin per E-Mail schicken. */
export async function createSetupInvite(
  db: Db,
  mailer: Mailer,
  operatorUserId: string,
  input: { clubName: string; adminEmail: string },
  appUrl: string,
  now: Date,
): Promise<OperatorInviteResult> {
  const adminEmail = input.adminEmail.trim().toLowerCase();
  const code = `CR-${generateCode(8)}`;
  const [row] = await db
    .insert(s.clubSetupInvites)
    .values({
      codeHash: codeHash(code),
      adminEmail,
      clubNameHint: input.clubName.trim(),
      createdByUserId: operatorUserId,
      expiresAt: new Date(now.getTime() + INVITE_DAYS * DAY),
      createdAt: now,
    })
    .returning();
  await logOperator(
    db,
    operatorUserId,
    'setup_invite.created',
    null,
    { clubName: input.clubName.trim(), adminEmail },
    now,
  );
  await mailer.send({
    to: adminEmail,
    subject: `Einrichtung deines Vereins „${input.clubName.trim()}“ in Clubroof`,
    text: [
      'Hallo,',
      '',
      `für „${input.clubName.trim()}“ ist ein Clubroof-Zugang vorbereitet. Öffne ${appUrl}/setup und gib diesen Einrichtungscode ein:`,
      '',
      code,
      '',
      `Der Code gilt ${INVITE_DAYS} Tage, nur für diese E-Mail-Adresse und nur einmal. Dort legst du Verein und dein Administrationskonto selbst an.`,
    ].join('\n'),
  });
  return { invite: inviteOf(row!, now), code };
}

export async function revokeSetupInvite(
  db: Db,
  operatorUserId: string,
  inviteId: string,
  now: Date,
) {
  const [row] = await db
    .update(s.clubSetupInvites)
    .set({ revokedAt: now })
    .where(
      and(
        eq(s.clubSetupInvites.id, inviteId),
        isNull(s.clubSetupInvites.usedAt),
        isNull(s.clubSetupInvites.revokedAt),
      ),
    )
    .returning({ id: s.clubSetupInvites.id });
  if (!row) throw notFound('Die Einladung');
  await logOperator(db, operatorUserId, 'setup_invite.revoked', null, { inviteId }, now);
}

/** Verein sperren, entsperren oder archivieren (keine Löschung; Daten bleiben erhalten). */
export async function setClubStatus(
  db: Db,
  operatorUserId: string,
  clubId: string,
  status: 'active' | 'suspended' | 'archived',
  now: Date,
) {
  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.id, clubId));
  if (!club) throw notFound('Der Verein');
  if (club.status === 'setup' && status !== 'archived')
    throw forbidden('Dieser Verein ist noch in der Einrichtung.');
  await db.update(s.clubs).set({ status, updatedAt: now }).where(eq(s.clubs.id, clubId));
  // Sitzungen in diesem Verein enden; wer nur hier Mitglied ist, sieht beim nächsten Aufruf den Hinweis
  if (status !== 'active') await db.delete(s.sessions).where(eq(s.sessions.activeClubId, clubId));
  await logOperator(
    db,
    operatorUserId,
    `club.${status}`,
    clubId,
    { from: club.status, name: club.name },
    now,
  );
}
