/**
 * Assistent „Mannschaft anlegen“ (Schnellstart, 9 Schritte): Name, Abteilung, Altersklasse, Zusagemodell, Trainer,
 * Anlegen. Aufruf: pnpm browser-check scripts/e2e/mannschaft-assistent.mjs [--no-build]
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto, login } = await b.session('admin', { width: 390, height: 1400 });
const name = `Testelf ${Date.now() % 10000}`;
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const next = () => button(page, /^Weiter$/).click();

await goto('/admin/team-new');
await text(page, 'Eine Mannschaft anlegen').waitFor({ timeout: 20_000 });
await text(page, 'Schritt 1 von 9', { exact: false }).waitFor();
await text(page, 'Schnellstart', { exact: true }).click();
await next();
await text(page, 'Wie heißt die Mannschaft?').waitFor();
ok(await button(page, /^Weiter$/).isDisabled(), 'Ohne Name geht es nicht weiter');
await page.getByLabel('Name', { exact: true }).fill(name);
await page.getByLabel('Kürzel', { exact: true }).fill('TE');
await next();
await text(page, 'Zu welcher Abteilung gehört sie?').waitFor();
await next();
await text(page, 'Altersklasse, Spielform und Liga').waitFor();
await page.getByLabel('Altersklasse').fill('U15');
await next();
await text(page, 'Wie sagen Spieler zu und ab?').waitFor();
await next();
await text(page, 'Wann trainiert die Mannschaft?').waitFor();
await text(page, 'Überspringen', { exact: true }).click();
await text(page, 'Wer trainiert die Mannschaft?').waitFor();
await page.getByLabel('Mitglied suchen').fill('Mustermann');
const hit = page.getByRole('radio').first();
await hit.waitFor({ timeout: 10_000 });
await hit.click();
await next();
await text(page, 'Wer spielt in der Mannschaft?').waitFor();
await text(page, 'Überspringen', { exact: true }).click();
await text(page, 'Alles bereit?').waitFor();
await button(page, 'Mannschaft anlegen').click();
await text(page, 'Mannschaft angelegt').waitFor({ timeout: 20_000 });
await button(page, 'Zur Mannschaft').click();
await page.waitForURL(/admin\/team\//, { timeout: 20_000 });
ok(true, 'Assistent legt Mannschaft an');

const teams = await api('/admin/teams', login.token);
ok(JSON.stringify(teams).includes(name), 'Mannschaft vorhanden');
console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
