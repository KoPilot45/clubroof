/**
 * Beispiel für eine Browserprüfung: pnpm browser-check scripts/e2e/beispiel.mjs --no-build
 * Kopiervorlage – eigene Prüfungen bitte nach dem gleichen Muster schreiben.
 * Bilder nur speichern, wenn sie für die Entscheidung wirklich gebraucht werden.
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto, login } = await b.session('trainer');

// Team-Bereich der B-Jugend mit Kachel „Kasse“
const b1 = login.me.teams.find((t) => t.badge === 'B1');
await goto(`/team?teamId=${b1.id}`);
await text(page, 'Strafenkatalog').waitFor({ timeout: 15_000 });
await text(page, 'Kasse', { exact: true }).click();
await text(page, 'Aktueller Kassenstand').waitFor({ timeout: 15_000 });
console.log('✓ Kasse öffnet');

// Rechte per API gegenprüfen
const cash = await api(`/teams/${b1.id}/cash`, login.token);
console.log(cash.permissions.manageCash ? '✓ Trainer darf buchen' : '✗ Trainer darf nicht buchen');

await button(page, 'Kassenverwaltung').click();
await text(page, 'Einzahlungen').waitFor({ timeout: 15_000 });
console.log('✓ Kassenverwaltung öffnet');

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(b.errors.length ? 1 : 0);
