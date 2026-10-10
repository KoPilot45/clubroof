import { createHash, randomBytes } from 'node:crypto';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, gt } from 'drizzle-orm';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Db,
  userId: string,
  options: { now: Date; ttlDays: number; userAgent?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(options.now.getTime() + options.ttlDays * 24 * 60 * 60 * 1000);
  await db.insert(s.sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: options.userAgent?.slice(0, 300) ?? null,
    expiresAt,
    lastUsedAt: options.now,
  });
  return { token, expiresAt };
}

export type SessionUser = {
  sessionId: string;
  id: string;
  email: string;
  displayName: string;
  twoFactorEnabled?: boolean;
};

/** Liefert den Nutzer zu einem gültigen Token oder `null`. */
export async function findSessionUser(
  db: Db,
  token: string,
  now: Date,
): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      sessionId: s.sessions.id,
      lastUsedAt: s.sessions.lastUsedAt,
      id: s.users.id,
      email: s.users.email,
      displayName: s.users.displayName,
      totpSecret: s.users.totpSecret,
      twoFactorEmail: s.users.twoFactorEmail,
    })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.tokenHash, hashToken(token)), gt(s.sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;

  // Letzte Nutzung höchstens alle 5 Minuten schreiben
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > 5 * 60 * 1000) {
    await db.update(s.sessions).set({ lastUsedAt: now }).where(eq(s.sessions.id, row.sessionId));
  }
  return {
    sessionId: row.sessionId,
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    twoFactorEnabled: row.totpSecret !== null || row.twoFactorEmail,
  };
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
  await db.delete(s.sessions).where(eq(s.sessions.id, sessionId));
}
