/**
 * 2-Faktor-Anmeldung (Konzept §16: Pflicht für privilegierte Rollen).
 *  - Einrichtung: Geheimnis erzeugen (verschlüsselt gespeichert) → mit einem Code bestätigen →
 *    zehn Wiederherstellungscodes (nur als Hash gespeichert, je einmal verwendbar).
 *  - Anmeldung: nach dem Passwort ein 5 Minuten gültiger Zwischenschritt; erst ein gültiger Code
 *    erzeugt die Sitzung. Codes werden nicht zweimal angenommen.
 *  - Vereinsvorgabe: Verlangt der Verein 2-Faktor, kommen Personen mit Verwaltungsrechten ohne
 *    eingerichteten zweiten Faktor nicht in die Verwaltung (`two_factor_required`).
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { verify } from '@node-rs/argon2';
import type { TwoFactorSetup, TwoFactorStatus } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import QRCode from 'qrcode';
import type { Actor } from '../actor';
import { hashToken } from '../auth/session';
import type { Config } from '../config';
import type { Mailer } from '../security/mailer';
import { DEFAULT_LOCALE, isLocale, translate } from '@clubroof/core';
import { HttpError } from '../errors';
import { decrypt, encrypt } from '../security/crypto';
import { generateSecret, otpauthUrl, recoveryCodes, verifyTotp } from '../security/totp';
import { consumeAuthToken, createAuthToken } from './account';

const CHALLENGE_MINUTES = 5;
const hashCode = (code: string) =>
  createHash('sha256').update(code.trim().toLowerCase()).digest('hex');

/** Das Administrationskonto (Rolle Fulladmin); nur dafür ist 2-Faktor Pflicht (Festlegung 10.10.2026) */
export function isPrivileged(actor: Actor): boolean {
  return actor.grants.some((g) => g.key === 'fulladmin' && g.scopeType === 'club');
}

export function twoFactorMissing(actor: Actor): boolean {
  return actor.club.requireTwoFactor && isPrivileged(actor) && !actor.user.twoFactorEnabled;
}

async function loadUser(db: Db, userId: string) {
  const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
  if (!user) throw new HttpError(404, 'not_found', 'Konto nicht gefunden.');
  return user;
}

export async function getTwoFactorStatus(db: Db, actor: Actor): Promise<TwoFactorStatus> {
  const user = await loadUser(db, actor.user.id);
  return {
    enabled: user.totpSecret !== null || user.twoFactorEmail,
    appEnabled: user.totpSecret !== null,
    emailEnabled: user.twoFactorEmail,
    required: actor.club.requireTwoFactor && isPrivileged(actor),
    recoveryCodesLeft: user.recoveryCodes?.length ?? 0,
  };
}

export async function startSetup(db: Db, actor: Actor, config: Config): Promise<TwoFactorSetup> {
  const user = await loadUser(db, actor.user.id);
  if (user.totpSecret)
    throw new HttpError(409, 'already_enabled', 'Die 2-Faktor-Anmeldung ist bereits aktiv.');
  const secret = generateSecret();
  await db
    .update(s.users)
    .set({ totpPendingSecret: encrypt(config.dataEncryptionKey, secret) })
    .where(eq(s.users.id, user.id));
  const url = otpauthUrl(secret, user.email, actor.club.shortName);
  return {
    secret: secret.match(/.{1,4}/g)!.join(' '),
    otpauthUrl: url,
    qrSvg: await QRCode.toString(url, { type: 'svg', margin: 1 }),
  };
}

export async function enableTwoFactor(
  db: Db,
  actor: Actor,
  config: Config,
  code: string,
  now: Date,
): Promise<{ recoveryCodes: string[] }> {
  const user = await loadUser(db, actor.user.id);
  const secret = user.totpPendingSecret
    ? decrypt(config.dataEncryptionKey, user.totpPendingSecret)
    : null;
  if (!secret) throw new HttpError(409, 'no_setup', 'Bitte die Einrichtung neu starten.');
  const step = verifyTotp(secret, code, now, null);
  if (step === null)
    throw new HttpError(
      400,
      'invalid_code',
      'Der Code stimmt nicht. Bitte den aktuellen Code eingeben.',
    );
  const codes = recoveryCodes();
  await db
    .update(s.users)
    .set({
      totpSecret: user.totpPendingSecret,
      totpPendingSecret: null,
      totpLastStep: step,
      recoveryCodes: codes.map(hashCode),
    })
    .where(eq(s.users.id, user.id));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: user.id,
    action: 'security.2fa_enabled',
    entityType: 'user',
    entityId: user.id,
    data: { label: `2-Faktor-Anmeldung eingerichtet: ${user.displayName}` },
    createdAt: now,
  });
  return { recoveryCodes: codes };
}

export async function disableTwoFactor(
  db: Db,
  actor: Actor,
  config: Config,
  input: { password: string; code: string },
  now: Date,
) {
  if (actor.club.requireTwoFactor && isPrivileged(actor))
    throw new HttpError(
      409,
      'required',
      'Der Verein verlangt für deine Rolle die 2-Faktor-Anmeldung.',
    );
  const user = await loadUser(db, actor.user.id);
  const okPassword = user.passwordHash
    ? await verify(user.passwordHash, input.password).catch(() => false)
    : false;
  if (!okPassword) throw new HttpError(400, 'wrong_password', 'Das Passwort stimmt nicht.');
  if (!(await checkSecondFactor(db, config, user.id, input.code, now)))
    throw new HttpError(400, 'invalid_code', 'Der Code stimmt nicht.');
  await db
    .update(s.users)
    .set({
      totpSecret: null,
      totpPendingSecret: null,
      totpLastStep: null,
      recoveryCodes: null,
      twoFactorEmail: false,
    })
    .where(eq(s.users.id, user.id));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: user.id,
    action: 'security.2fa_disabled',
    entityType: 'user',
    entityId: user.id,
    data: { label: `2-Faktor-Anmeldung ausgeschaltet: ${user.displayName}` },
    createdAt: now,
  });
}

/** Prüft TOTP-Code oder Wiederherstellungscode und vermerkt die Verwendung. */
async function checkSecondFactor(db: Db, config: Config, userId: string, code: string, now: Date) {
  const user = await loadUser(db, userId);
  const clean = code.trim();
  if (
    /^\d{6}$/.test(clean) &&
    user.twoFactorEmail &&
    (await consumeEmailCode(db, userId, clean, now))
  )
    return true;
  const secret = user.totpSecret ? decrypt(config.dataEncryptionKey, user.totpSecret) : null;
  if (!secret) return false;
  if (/^\d{6}$/.test(clean.replace(/\s/g, ''))) {
    const step = verifyTotp(secret, clean, now, user.totpLastStep);
    if (step === null) return false;
    await db.update(s.users).set({ totpLastStep: step }).where(eq(s.users.id, userId));
    return true;
  }
  // Wiederherstellungscode: einmalig, wird beim Verwenden entfernt
  const hashed = hashCode(clean);
  const codes = user.recoveryCodes ?? [];
  const match = codes.find((c) => timingSafeEqual(Buffer.from(c), Buffer.from(hashed)));
  if (!match) return false;
  await db
    .update(s.users)
    .set({ recoveryCodes: codes.filter((c) => c !== match) })
    .where(eq(s.users.id, userId));
  return true;
}

export const createChallenge = (db: Db, userId: string, now: Date) =>
  createAuthToken(db, userId, '2fa_challenge', CHALLENGE_MINUTES, now);

/** Zweiter Anmeldeschritt: liefert die Nutzer-ID, wenn Challenge und Code gültig sind. */
export async function completeChallenge(
  db: Db,
  config: Config,
  challenge: string,
  code: string,
  now: Date,
): Promise<string> {
  const [pending] = await db
    .select({ userId: s.authTokens.userId })
    .from(s.authTokens)
    .where(
      and(
        eq(s.authTokens.tokenHash, hashToken(challenge)),
        eq(s.authTokens.purpose, '2fa_challenge'),
        isNull(s.authTokens.usedAt),
        gt(s.authTokens.expiresAt, now),
      ),
    );
  if (!pending)
    throw new HttpError(
      401,
      'challenge_invalid',
      'Die Anmeldung ist abgelaufen. Bitte erneut anmelden.',
    );
  if (!(await checkSecondFactor(db, config, pending.userId, code, now)))
    throw new HttpError(401, 'invalid_code', 'Der Code stimmt nicht.');
  const userId = await consumeAuthToken(db, challenge, '2fa_challenge', now);
  if (!userId)
    throw new HttpError(
      401,
      'challenge_invalid',
      'Die Anmeldung ist abgelaufen. Bitte erneut anmelden.',
    );
  return userId;
}

// ── Code per E-Mail ─────────────────────────────────────────────────────────

const EMAIL_CODE_MINUTES = 10;
const EMAIL_CODE_ATTEMPTS = 5;
const emailCodeHash = (userId: string, code: string) =>
  createHash('sha256').update(`${userId}:${code}`).digest('hex');

/** Sendet einen sechsstelligen, einmal nutzbaren Code (10 Minuten gültig); ältere Codes verfallen. */
export async function sendEmailCode(db: Db, mailer: Mailer, userId: string, now: Date) {
  const user = await loadUser(db, userId);
  await db
    .update(s.authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(s.authTokens.userId, userId),
        eq(s.authTokens.purpose, 'email_code'),
        isNull(s.authTokens.usedAt),
      ),
    );
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.insert(s.authTokens).values({
    userId,
    purpose: 'email_code',
    tokenHash: emailCodeHash(userId, code),
    expiresAt: new Date(now.getTime() + EMAIL_CODE_MINUTES * 60_000),
    createdAt: now,
  });
  const locale = isLocale(user.language) ? user.language : DEFAULT_LOCALE;
  await mailer.send({
    to: user.email,
    subject: translate('Dein Anmeldecode', locale),
    text: [
      `Hallo ${user.displayName},`,
      '',
      `dein Code für die Anmeldung: ${code}`,
      '',
      `Er ist ${EMAIL_CODE_MINUTES} Minuten gültig und nur einmal nutzbar.`,
      'Wenn du dich nicht angemeldet hast, ändere bitte dein Passwort.',
    ]
      .map((line) => translate(line, locale))
      .join('\n'),
  });
}

export async function sendEmailCodeForChallenge(
  db: Db,
  mailer: Mailer,
  challenge: string,
  now: Date,
) {
  const [pending] = await db
    .select({ userId: s.authTokens.userId })
    .from(s.authTokens)
    .where(
      and(
        eq(s.authTokens.tokenHash, hashToken(challenge)),
        eq(s.authTokens.purpose, '2fa_challenge'),
        isNull(s.authTokens.usedAt),
        gt(s.authTokens.expiresAt, now),
      ),
    );
  if (!pending)
    throw new HttpError(
      401,
      'challenge_invalid',
      'Die Anmeldung ist abgelaufen. Bitte erneut anmelden.',
    );
  const user = await loadUser(db, pending.userId);
  if (!user.twoFactorEmail)
    throw new HttpError(409, 'not_enabled', 'Der Code per E-Mail ist nicht eingerichtet.');
  await sendEmailCode(db, mailer, pending.userId, now);
}

/** Löst den aktuellen E-Mail-Code ein; nach fünf Fehlversuchen ist er ungültig. */
async function consumeEmailCode(db: Db, userId: string, code: string, now: Date) {
  const [current] = await db
    .select()
    .from(s.authTokens)
    .where(
      and(
        eq(s.authTokens.userId, userId),
        eq(s.authTokens.purpose, 'email_code'),
        isNull(s.authTokens.usedAt),
        gt(s.authTokens.expiresAt, now),
      ),
    )
    .orderBy(desc(s.authTokens.createdAt))
    .limit(1);
  if (!current) return false;
  const ok = current.tokenHash === emailCodeHash(userId, code);
  if (ok) {
    await db.update(s.authTokens).set({ usedAt: now }).where(eq(s.authTokens.id, current.id));
    return true;
  }
  const attempts = current.attempts + 1;
  await db
    .update(s.authTokens)
    .set({ attempts, usedAt: attempts >= EMAIL_CODE_ATTEMPTS ? now : null })
    .where(eq(s.authTokens.id, current.id));
  return false;
}

/** Schaltet „Code per E-Mail“ ein, nachdem der zugesandte Code bestätigt wurde. */
export async function enableEmailTwoFactor(db: Db, actor: Actor, code: string, now: Date) {
  const user = await loadUser(db, actor.user.id);
  if (!(await consumeEmailCode(db, user.id, code.trim(), now)))
    throw new HttpError(400, 'invalid_code', 'Der Code stimmt nicht oder ist abgelaufen.');
  await db.update(s.users).set({ twoFactorEmail: true }).where(eq(s.users.id, user.id));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: user.id,
    action: 'security.2fa_email_enabled',
    entityType: 'user',
    entityId: user.id,
    data: { label: `Code per E-Mail als 2. Faktor eingerichtet: ${user.displayName}` },
    createdAt: now,
  });
}
