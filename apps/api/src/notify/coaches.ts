/** Empfänger und Zeitpunkte für Hinweise an das Trainerteam. */
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Ohne Frist kommt der Sammelhinweis so lange vor Beginn */
const DIGEST_WITHOUT_DEADLINE_MS = 3 * 3_600_000;

/** Zeitpunkt des Sammelhinweises: Frist bzw. drei Stunden vor Beginn. */
export const digestAt = (startsAt: Date, deadline: Date | null) =>
  deadline ?? new Date(startsAt.getTime() - DIGEST_WITHOUT_DEADLINE_MS);

export async function coachUsers(db: Db | Tx, teamId: string, today: string): Promise<string[]> {
  const rows = await db
    .select({ userId: s.persons.userId })
    .from(s.teamMemberships)
    .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
    .where(
      and(
        eq(s.teamMemberships.teamId, teamId),
        inArray(s.teamMemberships.function, ['coach', 'assistant_coach', 'team_manager']),
        lte(s.teamMemberships.validFrom, today),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    );
  return [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
}
