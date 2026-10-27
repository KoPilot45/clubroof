/**
 * Ersteinrichtung eines Vereins auf einem leeren Server (Mappe S. 10, Konzept §8).
 * Nur möglich, solange es noch keinen Verein gibt UND der Einrichtungscode (SETUP_TOKEN aus der
 * Serverkonfiguration) stimmt. Legt Verein, laufende Saison, Bereiche, Standardrollen, Module und
 * das erste Fulladmin-Konto an.
 */
import { randomInt, timingSafeEqual } from 'node:crypto';
import {
  CLUB_CASH_CATEGORY_TEMPLATE,
  MODULES,
  SYSTEM_ROLES,
  normalizeClubCode,
  type SetupInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, count, eq, isNull } from 'drizzle-orm';
import type { Config } from '../config';
import type { Mailer } from '../security/mailer';
import type { LinkSigner } from '../storage/files';
import { HttpError } from '../errors';
import { checkPassword, hashPassword } from './account';
import { codeHash } from './codes';

/** Optionale Module starten „verfügbar“ und erscheinen im Update-Center. */
const OPTIONAL = new Set([
  'club_cash',
  'sponsors',
  'facility_booking',
  'player_exchange',
  'forum',
  'calendar_export',
  'lost_and_found',
  'training_planning',
]);

/** Prüft den Einrichtungscode des Servers (zeitkonstant). */
function isServerToken(config: Config, token: string): boolean {
  const expected = config.setupToken;
  const given = Buffer.from(token);
  return !!(
    expected &&
    given.length === Buffer.byteLength(expected) &&
    timingSafeEqual(given, Buffer.from(expected))
  );
}

type SetupAccess = { invite: typeof s.clubSetupInvites.$inferSelect | null };

/**
 * Berechtigung zur Einrichtung: entweder der Servercode (nur solange es noch keinen Verein gibt – der erste
 * Verein) oder ein Einrichtungscode des Betreibers für einen weiteren Verein (einmalig, befristet, an eine
 * E-Mail-Adresse gebunden).
 */
async function authorizeSetup(
  db: Db,
  config: Config,
  token: string,
  now: Date,
): Promise<SetupAccess> {
  if (isServerToken(config, token)) {
    if (!(await needsSetup(db)))
      throw new HttpError(409, 'already_set_up', 'Dieser Verein ist bereits eingerichtet.');
    return { invite: null };
  }
  const [invite] = await db
    .select()
    .from(s.clubSetupInvites)
    .where(eq(s.clubSetupInvites.codeHash, codeHash(token)));
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= now)
    throw new HttpError(403, 'setup_token', 'Der Einrichtungscode stimmt nicht.');
  return { invite };
}

/** Prüft den Einrichtungscode schon beim Einstieg in den Assistenten (ohne etwas anzulegen). */
export async function checkSetupCode(db: Db, config: Config, token: string, now: Date) {
  await authorizeSetup(db, config, token, now);
}

/**
 * E-Mail-Bestätigung des ersten Kontos: 6-stelliger Code per E-Mail (15 Minuten gültig, höchstens 5 Versuche),
 * danach ein signierter Nachweis (2 Stunden), den die Einrichtung verlangt. Bewusst im Speicher des Servers: Die
 * Einrichtung läuft einmalig auf einem einzelnen Server.
 */
const emailCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>();
const PROOF_PREFIX = 'setup-email:';

export async function sendSetupEmailCode(
  db: Db,
  config: Config,
  mailer: Mailer,
  input: { setupToken: string; email: string },
  now: Date,
) {
  const access = await authorizeSetup(db, config, input.setupToken, now);
  const email = input.email.trim().toLowerCase();
  if (access.invite && access.invite.adminEmail !== email)
    throw new HttpError(
      403,
      'setup_email',
      'Dieser Einrichtungscode gilt für eine andere E-Mail-Adresse.',
    );
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  emailCodes.set(email, { code, expiresAt: now.getTime() + 15 * 60_000, attempts: 0 });
  await mailer.send({
    to: email,
    subject: 'Dein Bestätigungscode für Clubroof',
    text: `Dein Code zur Einrichtung deines Vereins in Clubroof lautet: ${code}\n\nEr ist 15 Minuten gültig. Wenn du die Einrichtung nicht gestartet hast, ignoriere diese E-Mail.`,
  });
}

export function verifySetupEmailCode(
  links: LinkSigner,
  input: { email: string; code: string },
  now: Date,
): { proof: string } {
  const email = input.email.trim().toLowerCase();
  const entry = emailCodes.get(email);
  if (!entry || entry.expiresAt < now.getTime())
    throw new HttpError(
      400,
      'code_expired',
      'Der Code ist abgelaufen. Bitte fordere einen neuen an.',
    );
  entry.attempts += 1;
  if (entry.attempts > 5) {
    emailCodes.delete(email);
    throw new HttpError(
      429,
      'code_attempts',
      'Zu viele Versuche. Bitte fordere einen neuen Code an.',
    );
  }
  const given = Buffer.from(input.code.trim());
  const expected = Buffer.from(entry.code);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    throw new HttpError(400, 'code_wrong', 'Der Code stimmt nicht.');
  emailCodes.delete(email);
  return {
    proof: links.create(`${PROOF_PREFIX}${email}`, new Date(now.getTime() + 2 * 3_600_000)),
  };
}

export async function needsSetup(db: Db): Promise<boolean> {
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(s.clubs);
  return Number(n) === 0;
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'verein';

/** Eindeutiges Kürzel für die Adresse; bei Namensgleichheit mit Zähler. */
async function freeSlug(tx: Pick<Db, 'select'>, base: string): Promise<string> {
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const [taken] = await tx
      .select({ id: s.clubs.id })
      .from(s.clubs)
      .where(eq(s.clubs.slug, candidate));
    if (!taken) return candidate;
  }
}

export async function setupClub(
  db: Db,
  config: Config,
  links: LinkSigner,
  input: SetupInput,
  now: Date,
): Promise<{ userId: string }> {
  const access = await authorizeSetup(db, config, input.setupToken, now);
  const email = input.admin.email.trim().toLowerCase();
  if (access.invite && access.invite.adminEmail !== email)
    throw new HttpError(
      403,
      'setup_email',
      'Dieser Einrichtungscode gilt für eine andere E-Mail-Adresse.',
    );
  if (links.verify(input.emailProof, now) !== `${PROOF_PREFIX}${email}`)
    throw new HttpError(
      400,
      'email_not_verified',
      'Bitte bestätige zuerst deine E-Mail-Adresse mit dem Code, den wir dir geschickt haben.',
    );
  checkPassword(input.admin.password, email);
  if (input.orgUnits.length === 0)
    throw new HttpError(400, 'org_units', 'Bitte mindestens eine Abteilung anlegen.');
  const passwordHash = await hashPassword(input.admin.password);

  // Saison: beginnt im gewählten Monat (Standard Juli) und dauert ein Jahr
  const startMonth = input.club.seasonStartMonth ?? 7;
  const year =
    now.getUTCMonth() + 1 >= startMonth ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const endsOn =
    startMonth === 1
      ? `${year}-12-31`
      : `${year + 1}-${pad(startMonth - 1)}-${pad(new Date(Date.UTC(year + 1, startMonth - 1, 0)).getUTCDate())}`;
  const seasonName = startMonth === 1 ? String(year) : `${year}/${String(year + 1).slice(2)}`;
  const text = (v: string | null | undefined) => v?.trim() || null;

  return db.transaction(async (tx) => {
    const [club] = await tx
      .insert(s.clubs)
      .values({
        name: input.club.name.trim(),
        shortName: input.club.shortName.trim(),
        shortCode: input.club.shortCode ? normalizeClubCode(input.club.shortCode) : null,
        slug: await freeSlug(tx, slugOf(input.club.name)),
        colorTheme: input.club.colorTheme,
        colorMode: input.club.colorMode ?? 'system',
        timezone: input.club.timezone ?? 'Europe/Berlin',
        foundedYear: input.club.foundedYear ?? null,
        street: text(input.club.street),
        postalCode: text(input.club.postalCode),
        city: text(input.club.city),
        email: text(input.club.email)?.toLowerCase() ?? null,
        phone: text(input.club.phone),
        website: text(input.club.website),
        defaultContactVisibility: input.club.defaultContactVisibility ?? 'team_and_coaches',
      })
      .returning({ id: s.clubs.id });
    const clubId = club!.id;
    await tx.insert(s.seasons).values({
      clubId,
      name: seasonName,
      startsOn: `${year}-${pad(startMonth)}-01`,
      endsOn,
      isCurrent: true,
    });
    await tx
      .insert(s.orgUnits)
      .values(
        input.orgUnits.map((u, i) => ({ clubId, name: u.name.trim(), kind: u.kind, sortOrder: i })),
      );
    const roles = await tx
      .insert(s.roles)
      .values(
        SYSTEM_ROLES.map((r) => ({
          clubId,
          key: r.key,
          name: r.name,
          description: r.description,
          isSystem: true,
          permissions: r.permissions,
        })),
      )
      .returning({ id: s.roles.id, key: s.roles.key });
    // Auswahl aus dem Assistenten: gewählte Module sind aktiv, die übrigen warten im Update-Center
    const chosen = input.modules ? new Set(input.modules) : null;
    await tx.insert(s.moduleSettings).values(
      MODULES.map((m) => ({
        clubId,
        scopeType: 'club' as const,
        scopeId: null,
        moduleKey: m.key,
        state:
          (m as { core?: boolean }).core || (chosen ? chosen.has(m.key) : !OPTIONAL.has(m.key))
            ? ('enabled' as const)
            : ('available' as const),
        level: 'basic' as const,
      })),
    );
    // Kategorien der Vereinskasse aus der Vorlage (der Kassenwart passt sie später an)
    await tx
      .insert(s.clubCashCategories)
      .values(CLUB_CASH_CATEGORY_TEMPLATE.map((c, i) => ({ clubId, ...c, sortOrder: i })));
    // Spielstätten mit Plätzen (Untergrund) und Kabinen
    const SURFACE_KIND = {
      grass: 'grass_pitch',
      artificial: 'artificial_pitch',
      hard: 'hard_pitch',
    } as const;
    let order = 0;
    for (const [vi, v] of (input.venues ?? []).entries()) {
      const [venue] = await tx
        .insert(s.venues)
        .values({
          clubId,
          name: v.name.trim(),
          address: v.address?.trim() || null,
          sortOrder: vi,
        })
        .returning({ id: s.venues.id });
      const rows = [
        ...v.pitches.map((p) => ({ name: p.name.trim(), kind: SURFACE_KIND[p.surface] })),
        ...v.changingRooms.map((n) => ({ name: n.trim(), kind: 'changing_room' as const })),
      ];
      if (rows.length)
        await tx.insert(s.facilities).values(
          rows.map((r) => ({
            clubId,
            venueId: venue!.id,
            name: r.name,
            kind: r.kind,
            address: v.address?.trim() || null,
            sortOrder: order++,
          })),
        );
    }
    // Einrichtungscode verbrauchen (atomar: ein Code richtet genau einen Verein ein)
    if (access.invite) {
      const [used] = await tx
        .update(s.clubSetupInvites)
        .set({ usedAt: now, clubId })
        .where(and(eq(s.clubSetupInvites.id, access.invite.id), isNull(s.clubSetupInvites.usedAt)))
        .returning({ id: s.clubSetupInvites.id });
      if (!used) throw new HttpError(403, 'setup_token', 'Der Einrichtungscode stimmt nicht.');
    }
    const [user] = await tx
      .insert(s.users)
      .values({
        email,
        displayName: `${input.admin.firstName.trim()} ${input.admin.lastName.trim()}`,
        passwordHash,
        passwordChangedAt: now,
      })
      .returning({ id: s.users.id });
    const [person] = await tx
      .insert(s.persons)
      .values({
        clubId,
        userId: user!.id,
        firstName: input.admin.firstName.trim(),
        lastName: input.admin.lastName.trim(),
        email,
        contactVisibility: input.club.defaultContactVisibility ?? 'team_and_coaches',
      })
      .returning({ id: s.persons.id });
    await tx.insert(s.roleAssignments).values({
      clubId,
      personId: person!.id,
      roleId: roles.find((r) => r.key === 'fulladmin')!.id,
      scopeType: 'club',
    });
    await tx.insert(s.auditLog).values({
      clubId,
      actorUserId: user!.id,
      action: 'club.created',
      entityType: 'club',
      entityId: clubId,
      data: { label: `Verein eingerichtet: ${input.club.name.trim()}` },
      createdAt: now,
    });
    return { userId: user!.id };
  });
}
