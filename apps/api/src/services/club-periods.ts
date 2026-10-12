/**
 * Periodensperre der Vereinskasse (Paket K3): ein abgeschlossenes Jahr nimmt keine Buchungen mehr an.
 */
import type { ClubPeriodLock } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, isNull } from 'drizzle-orm';
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
