/**
 * Ersteinrichtung eines Vereins auf einem leeren Server (Mappe S. 10, Konzept §8).
 * Nur möglich, solange es noch keinen Verein gibt UND der Einrichtungscode (SETUP_TOKEN aus der
 * Serverkonfiguration) stimmt. Legt Verein, laufende Saison, Bereiche, Standardrollen, Module und
 * das erste Fulladmin-Konto an.
 */
import { timingSafeEqual } from 'node:crypto';
import { MODULES, SYSTEM_ROLES, type SetupInput } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { count } from 'drizzle-orm';
import type { Config } from '../config';
import { HttpError } from '../errors';
import { checkPassword, hashPassword } from './account';

/** Optionale Module starten „verfügbar“ und erscheinen im Update-Center. */
const OPTIONAL = new Set([
  'facility_booking',
  'player_exchange',
  'forum',
  'calendar_export',
  'lost_and_found',
  'training_planning',
]);

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
  input: SetupInput,
  now: Date,
): Promise<{ userId: string }> {
  const expected = config.setupToken;
  const given = Buffer.from(input.setupToken);
  if (
    !expected ||
    given.length !== Buffer.byteLength(expected) ||
    !timingSafeEqual(given, Buffer.from(expected))
  )
    throw new HttpError(403, 'setup_token', 'Der Einrichtungscode stimmt nicht.');
  if (!(await needsSetup(db)))
    throw new HttpError(409, 'already_set_up', 'Der Verein ist bereits eingerichtet.');
  const email = input.admin.email.trim().toLowerCase();
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
    await tx.insert(s.moduleSettings).values(
      MODULES.map((m) => ({
        clubId,
        scopeType: 'club' as const,
        scopeId: null,
        moduleKey: m.key,
        state: OPTIONAL.has(m.key) ? ('available' as const) : ('enabled' as const),
        level: 'basic' as const,
      })),
    );
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
