/**
 * Macht ein bestehendes Konto zum Betreiber (oder nimmt es zurück): `pnpm --filter @clubroof/db operator <E-Mail> [remove]`.
 * Betreiber werden bewusst nur hier angelegt, nie über die App.
 */
import { eq } from 'drizzle-orm';
import { createDb } from './client';
import { databaseUrl } from './env';
import { operators, users } from './schema';

const [email, mode] = process.argv.slice(2);
if (!email) {
  console.error('Aufruf: operator <E-Mail> [remove]');
  process.exit(2);
}
const { db, sql } = createDb(databaseUrl());
const [user] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email.toLowerCase()));
if (!user) {
  console.error(`Kein Konto mit der E-Mail-Adresse ${email}.`);
  await sql.end();
  process.exit(1);
}
if (mode === 'remove') {
  await db.delete(operators).where(eq(operators.userId, user.id));
  console.log(`${email} ist kein Betreiber mehr.`);
} else {
  await db
    .insert(operators)
    .values({ userId: user.id })
    .onConflictDoUpdate({
      target: operators.userId,
      set: { active: true },
    });
  console.log(`${email} ist jetzt Betreiber (2-Faktor-Anmeldung ist Pflicht).`);
}
await sql.end();
