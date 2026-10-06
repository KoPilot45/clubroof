/** Logins zu Personen: die Person selbst und – bei Kindern ohne Login – ihre Eltern. */
import { schema as s, type Db } from '@clubroof/db';
import { eq, inArray } from 'drizzle-orm';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export async function usersOfPersons(db: Db | Tx, personIds: string[]): Promise<string[]> {
  if (personIds.length === 0) return [];
  const ids = [...new Set(personIds)];
  const [own, guardians] = await Promise.all([
    db.select({ userId: s.persons.userId }).from(s.persons).where(inArray(s.persons.id, ids)),
    db
      .select({ userId: s.persons.userId })
      .from(s.guardianships)
      .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
      .where(inArray(s.guardianships.childPersonId, ids)),
  ]);
  return [...new Set([...own, ...guardians].map((r) => r.userId).filter((u): u is string => !!u))];
}

/** Je Person ihre Logins (für persönliche Texte wie „Leon: 3,00 € offen“). */
export async function usersByPerson(
  db: Db | Tx,
  personIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (personIds.length === 0) return result;
  const ids = [...new Set(personIds)];
  const [own, guardians] = await Promise.all([
    db
      .select({ personId: s.persons.id, userId: s.persons.userId })
      .from(s.persons)
      .where(inArray(s.persons.id, ids)),
    db
      .select({ personId: s.guardianships.childPersonId, userId: s.persons.userId })
      .from(s.guardianships)
      .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
      .where(inArray(s.guardianships.childPersonId, ids)),
  ]);
  for (const r of [...own, ...guardians]) {
    if (!r.userId) continue;
    result.set(r.personId, [...new Set([...(result.get(r.personId) ?? []), r.userId])]);
  }
  return result;
}
