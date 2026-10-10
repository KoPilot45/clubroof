/** Assistent „Mannschaft anlegen“: alle 11 Schritte, Anlegen mit Trainer, Kader, Fristen. */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto, login } = await b.session('admin');
const name = `Testelf ${Date.now() % 10000}`;

await goto('/admin/team-new');
await text(page, 'Wie heißt die Mannschaft?').waitFor({ timeout: 20_000 });
await text(page, 'Schritt 1 von 11', { exact: false }).waitFor();
await page.getByLabel('Name', { exact: true }).fill(name);
await page.getByLabel('Kürzel', { exact: true }).fill('TE');
await button(page, 'Weiter').click();
await text(page, 'Zu welchem Bereich gehört sie?').waitFor();
await button(page, 'Weiter').click();
await text(page, 'Altersklasse und Liga').waitFor();
await page.getByLabel('Altersklasse').fill('U15');
await button(page, 'Weiter').click();
await text(page, 'Welche Vorlage passt?').waitFor();
await button(page, 'Weiter').click();
await text(page, 'Wie nehmen Spieler an Terminen teil?').waitFor();
await button(page, 'Weiter').click();
await text(page, 'Wer trainiert die Mannschaft?').waitFor();
await page.getByLabel('Mitglied suchen').fill('Mustermann');
const hit = page.getByRole('radio').first();
await hit.waitFor({ timeout: 10_000 });
await hit.click();
await button(page, 'Weiter').click();
await text(page, 'Wer spielt in der Mannschaft?').waitFor();
await button(page, 'Weiter').click();
await text(page, 'Bis wann sollen Spieler antworten?').waitFor();
await button(page, 'Frist festlegen').first().click();
await button(page, 'Weiter').click();
await text(page, 'Treffpunkt und Treffzeit').waitFor();
await page.getByLabel('Treffpunkt').fill('Haupteingang');
await button(page, 'Weiter').click();
await text(page, 'Name im DFBnet').waitFor();
await button(page, 'Weiter').click();
await text(page, 'Alles bereit?').waitFor();
await button(page, 'Mannschaft anlegen').click();
await text(page, 'Mannschaft angelegt').waitFor({ timeout: 20_000 });
await button(page, 'Zur Mannschaft').click();
await page.waitForURL(/admin\/team\//, { timeout: 20_000 });
console.log('✓ Assistent legt Mannschaft an');

const teams = await api('/admin/teams', login.token);
const made = JSON.stringify(teams).includes(name);
console.log(made ? '✓ Mannschaft vorhanden' : '✗ Mannschaft fehlt');
console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(b.errors.length || !made ? 1 : 0);
