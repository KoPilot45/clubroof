/**
 * Konto: Passwort vergessen/zurücksetzen und ändern.
 *  - „Passwort vergessen“ antwortet immer gleich (keine Auskunft, ob ein Konto existiert).
 *  - Reset-Links gelten 30 Minuten und nur einmal; danach werden alle Sitzungen beendet.
 */
import { hash, verify } from '@node-rs/argon2';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { generateToken, hashToken } from '../auth/session';
import type { Config } from '../config';
import { HttpError } from '../errors';
import type { Mailer } from '../security/mailer';

const RESET_MINUTES = 30;

/** Mindestanforderungen an Passwörter (NIST 800-63B: Länge statt Sonderzeichen-Regeln). */
export function checkPassword(password: string, email?: string) {
  if (password.length < 10)
    throw new HttpError(400, 'password_weak', 'Das Passwort muss mindestens 10 Zeichen lang sein.');
  if (email && password.toLowerCase().includes(email.split('@')[0]!.toLowerCase()))
    throw new HttpError(
      400,
      'password_weak',
      'Das Passwort darf die E-Mail-Adresse nicht enthalten.',
    );
  if (
    /^(.)\1+$/.test(password) ||
    ['1234567890', 'clubroof12', 'passwort12'].includes(password.toLowerCase())
  )
    throw new HttpError(400, 'password_weak', 'Dieses Passwort ist zu leicht zu erraten.');
}

export const hashPassword = (password: string) => hash(password);

export async function createAuthToken(
  db: Db,
  userId: string,
  purpose: string,
  minutes: number,
  now: Date,
): Promise<string> {
  const token = generateToken();
  await db.insert(s.authTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + minutes * 60_000),
    createdAt: now,
  });
  return token;
}

/** Löst einen Einmal-Token ein; liefert die Nutzer-ID oder `null`. */
export async function consumeAuthToken(db: Db, token: string, purpose: string, now: Date) {
  const [row] = await db
    .update(s.authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(s.authTokens.tokenHash, hashToken(token)),
        eq(s.authTokens.purpose, purpose),
        isNull(s.authTokens.usedAt),
        gt(s.authTokens.expiresAt, now),
      ),
    )
    .returning({ userId: s.authTokens.userId });
  return row?.userId ?? null;
}

export async function requestPasswordReset(
  db: Db,
  mailer: Mailer,
  config: Config,
  email: string,
  now: Date,
): Promise<void> {
  const [user] = await db
    .select({ id: s.users.id, name: s.users.displayName, hash: s.users.passwordHash })
    .from(s.users)
    .where(eq(s.users.email, email));
  if (!user || !user.hash) return;
  // Ältere, noch offene Links ungültig machen
  await db
    .update(s.authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(s.authTokens.userId, user.id),
        eq(s.authTokens.purpose, 'password_reset'),
        isNull(s.authTokens.usedAt),
      ),
    );
  const token = await createAuthToken(db, user.id, 'password_reset', RESET_MINUTES, now);
  await mailer.send({
    to: email,
    subject: 'Passwort zurücksetzen',
    text: [
      `Hallo ${user.name},`,
      '',
      'du hast angefordert, dein Passwort für die Vereins-App zurückzusetzen. Öffne diesen Link',
      `(gültig ${RESET_MINUTES} Minuten):`,
      '',
      `${config.appUrl}/reset/${token}`,
      '',
      'Wenn du das nicht warst, ignoriere diese E-Mail – dein Passwort bleibt unverändert.',
    ].join('\n'),
  });
}

export async function resetPassword(db: Db, token: string, password: string, now: Date) {
  const invalid = () =>
    new HttpError(400, 'token_invalid', 'Der Link ist abgelaufen oder wurde bereits verwendet.');
  // Erst prüfen (ohne den Link zu verbrauchen), damit ein zu schwaches Passwort ihn nicht entwertet
  const [pending] = await db
    .select({ email: s.users.email })
    .from(s.authTokens)
    .innerJoin(s.users, eq(s.users.id, s.authTokens.userId))
    .where(
      and(
        eq(s.authTokens.tokenHash, hashToken(token)),
        eq(s.authTokens.purpose, 'password_reset'),
        isNull(s.authTokens.usedAt),
        gt(s.authTokens.expiresAt, now),
      ),
    );
  if (!pending) throw invalid();
  checkPassword(password, pending.email);
  const userId = await consumeAuthToken(db, token, 'password_reset', now);
  if (!userId) throw invalid();
  await db
    .update(s.users)
    .set({ passwordHash: await hashPassword(password), passwordChangedAt: now })
    .where(eq(s.users.id, userId));
  // Alle Anmeldungen beenden – auch die eines möglichen Angreifers
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
}

export async function changePassword(
  db: Db,
  user: { id: string; email: string; sessionId: string },
  current: string,
  next: string,
  now: Date,
) {
  const [row] = await db.select().from(s.users).where(eq(s.users.id, user.id));
  const ok = row?.passwordHash ? await verify(row.passwordHash, current).catch(() => false) : false;
  if (!ok) throw new HttpError(400, 'wrong_password', 'Das aktuelle Passwort stimmt nicht.');
  checkPassword(next, user.email);
  await db
    .update(s.users)
    .set({ passwordHash: await hashPassword(next), passwordChangedAt: now })
    .where(eq(s.users.id, user.id));
  // Andere Geräte abmelden, das aktuelle bleibt angemeldet
  await db
    .delete(s.sessions)
    .where(and(eq(s.sessions.userId, user.id), ne(s.sessions.id, user.sessionId)));
}
