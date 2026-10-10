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
  type SetupInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { count } from 'drizzle-orm';
import type { Config } from '../config';
import type { Mailer } from '../security/mailer';
import type { LinkSigner } from '../storage/files';
import { HttpError } from '../errors';
import { checkPassword, hashPassword } from './account';

/** Optionale Module starten „verfügbar“ und erscheinen im Update-Center. */
const OPTIONAL = new Set([
  'club_cash',
  'facility_booking',
  'player_exchange',
  'forum',
  'calendar_export',
  'lost_and_found',
  'training_planning',
]);

/** Prüft den Einrichtungscode des Servers (zeitkonstant). */
function checkSetupToken(config: Config, token: string) {
  const expected = config.setupToken;
  const given = Buffer.from(token);
  if (
    !expected ||
    given.length !== Buffer.byteLength(expected) ||
    !timingSafeEqual(given, Buffer.from(expected))
  )
    throw new HttpError(403, 'setup_token', 'Der Einrichtungscode stimmt nicht.');
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
  checkSetupToken(config, input.setupToken);
  if (!(await needsSetup(db)))
    throw new HttpError(409, 'already_set_up', 'Der Verein ist bereits eingerichtet.');
  const email = input.email.trim().toLowerCase();
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

export async function setupClub(
  db: Db,
  config: Config,
  links: LinkSigner,
  input: SetupInput,
  now: Date,
): Promise<{ userId: string }> {
  checkSetupToken(config, input.setupToken);
  if (!(await needsSetup(db)))
    throw new HttpError(409, 'already_set_up', 'Der Verein ist bereits eingerichtet.');
  const email = input.admin.email.trim().toLowerCase();
  if (links.verify(input.emailProof, now) !== `${PROOF_PREFIX}${email}`)
    throw new HttpError(
      400,
      'email_not_verified',
      'Bitte bestätige zuerst deine E-Mail-Adresse mit dem Code, den wir dir geschickt haben.',
    );
  checkPassword(input.admin.password, email);
  if (input.orgUnits.length === 0)
    throw new HttpError(400, 'org_units', 'Bitte mindestens einen Bereich anlegen.');
  const passwordHash = await hashPassword(input.admin.password);

  // Saison läuft vom 1. Juli bis 30. Juni
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;

  return db.transaction(async (tx) => {
    const [club] = await tx
      .insert(s.clubs)
      .values({
        name: input.club.name.trim(),
        shortName: input.club.shortName.trim(),
        slug: slugOf(input.club.name),
        colorTheme: input.club.colorTheme,
      })
      .returning({ id: s.clubs.id });
    const clubId = club!.id;
    await tx.insert(s.seasons).values({
      clubId,
      name: `${year}/${String(year + 1).slice(2)}`,
      startsOn: `${year}-07-01`,
      endsOn: `${year + 1}-06-30`,
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
