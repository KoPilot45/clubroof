/**
 * Periodensperre der Vereinskasse (Paket K3): ein abgeschlossenes Jahr nimmt keine Buchungen mehr an.
 */
import type { ClubPeriodLock } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { HttpError } from '../errors';

const yearOf = (day: string) => Number(day.slice(0, 4));

/** Wirft 409, wenn das Jahr des Datums abgeschlossen ist (Buchen, Stornieren, Zahlung). */
export async function assertPeriodOpen(db: Db, clubId: string, bookedOn: string): Promise<void> {
  const year = yearOf(bookedOn);
  const [lock] = await db
    .select({ id: s.clubPeriodLocks.id })
    .from(s.clubPeriodLocks)
    .where(
      and(
        eq(s.clubPeriodLocks.clubId, clubId),
        eq(s.clubPeriodLocks.year, year),
        isNull(s.clubPeriodLocks.unlockedAt),
      ),
    );
  if (lock)
    throw new HttpError(
      409,
      'period_locked',
      `Das Jahr ${year} ist abgeschlossen. Buchungen sind dort gesperrt; nur die Administration kann es wieder öffnen.`,
    );
}

export async function activeLock(
  db: Db,
  clubId: string,
  year: number,
): Promise<ClubPeriodLock | null> {
  const [row] = await db
    .select({
      lock: s.clubPeriodLocks,
      first: s.persons.firstName,
      last: s.persons.lastName,
    })
    .from(s.clubPeriodLocks)
    .leftJoin(s.persons, eq(s.persons.id, s.clubPeriodLocks.lockedByPersonId))
    .where(
      and(
        eq(s.clubPeriodLocks.clubId, clubId),
        eq(s.clubPeriodLocks.year, year),
        isNull(s.clubPeriodLocks.unlockedAt),
      ),
    );
  if (!row) return null;
  return {
    year,
    lockedAt: row.lock.lockedAt.toISOString(),
    lockedByName: row.first ? `${row.first} ${row.last}` : null,
  };
}

/** Eine Spende mit ausgestellter Bestätigung darf nicht still storniert werden. */
export async function assertNoReceipt(db: Db, entryId: string): Promise<void> {
  const [row] = await db
    .select({ receiptNo: s.clubDonations.receiptNo })
    .from(s.clubDonations)
    .where(and(eq(s.clubDonations.entryId, entryId), isNotNull(s.clubDonations.receiptNo)));
  if (row)
    throw new HttpError(
      409,
      'receipt_issued',
      `Für diese Spende wurde schon die Zuwendungsbestätigung ${row.receiptNo} ausgestellt. Sie kann nicht storniert werden.`,
    );
}

/**
 * Buchungen, die zu einer erstatteten Auslage, einem eingegangenen Zuschuss oder einem Zuschuss an eine
 * Mannschaftskasse gehören, werden nicht still storniert (Paket K5) – sonst stimmen die Gegenseite
 * und der Status nicht mehr.
 */
export async function assertNotLinked(db: Db, entryId: string): Promise<void> {
  const [claim] = await db
    .select({ id: s.clubExpenseClaims.id })
    .from(s.clubExpenseClaims)
    .where(eq(s.clubExpenseClaims.entryId, entryId));
  if (claim)
    throw new HttpError(
      409,
      'linked_claim',
      'Diese Buchung gehört zu einer erstatteten Auslage und kann nicht storniert werden.',
    );
  const [grant] = await db
    .select({ id: s.clubGrants.id })
    .from(s.clubGrants)
    .where(eq(s.clubGrants.entryId, entryId));
  if (grant)
    throw new HttpError(
      409,
      'linked_grant',
      'Diese Buchung gehört zu einem eingegangenen Zuschuss und kann nicht storniert werden.',
    );
  const [teamGrant] = await db
    .select({ id: s.clubTeamGrants.id })
    .from(s.clubTeamGrants)
    .where(eq(s.clubTeamGrants.entryId, entryId));
  if (teamGrant)
    throw new HttpError(
      409,
      'linked_team_grant',
      'Dieser Zuschuss steht auch in der Mannschaftskasse und kann hier nicht storniert werden.',
    );
}
