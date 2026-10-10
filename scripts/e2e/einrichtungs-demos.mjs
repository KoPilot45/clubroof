/** Einrichtungs-Demos (Verein, Mannschaft) = echte Assistenten ohne Speichern: komplett durchklicken bis „Verlassen“. */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const a = await b.anonymous();
const { page } = a;
const next = (label = 'Weiter') =>
  page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first().click();

// ── Verein ────────────────────────────────────────────────────────────────
await a.goto('/demo/club');
await text(page, 'Willkommen bei Clubroof').waitFor({ timeout: 20_000 });
await next('Los geht’s');
await text(page, 'Wie heißt euer Verein?').waitFor();
await page.getByLabel('Vereinsname').fill('FC Demo 1920');
await page.getByLabel('Kurzname').fill('FC Demo');
await next();
await text(page, 'Wo spielt ihr?').waitFor();
await page.getByLabel('Name der Anlage', { exact: false }).first().fill('Sportplatz am Wald');
await next();
await text(page, 'Plätze und Kabinen').waitFor();
await next();
await text(page, 'Welcher Untergrund?').waitFor();
await next();
await text(page, 'Habt ihr ein Logo?').waitFor();
await next('Ohne Logo weiter');
await text(page, 'Eure Vereinsfarbe').waitFor();
await next();
await text(page, 'Wie ist euer Verein aufgebaut?').waitFor();
await next();
await text(page, 'Wofür nutzt ihr Clubroof – in der Mannschaft?').waitFor();
await next();
await text(page, 'Und im Verein?').waitFor();
await next();
await text(page, 'Dein Konto').waitFor();
await page.getByLabel('Vorname').fill('Erika');
await page.getByLabel('Nachname').fill('Muster');
await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('erika@demo.example');
await button(page, 'Bestätigungscode senden').click();
await page.getByLabel('Code aus der E-Mail').fill('123456');
await button(page, 'Code bestätigen').click();
await text(page, 'E-Mail-Adresse bestätigt').waitFor();
await next();
await text(page, 'Wähle ein Passwort').waitFor();
await page.getByLabel('Passwort', { exact: true }).fill('ein-sicheres-passwort-1');
await page.getByLabel('Passwort wiederholen').fill('ein-sicheres-passwort-1');
await next();
await text(page, 'Zusätzlich absichern?').waitFor();
await next('Einrichtung abschließen');
await text(page, 'Dein Verein ist eingerichtet').waitFor({ timeout: 10_000 });
ok(true, 'Vereins-Demo: alle Schritte bis zum Abschluss');
await button(page, 'Verlassen').click();
await page.waitForURL(/\/login/, { timeout: 10_000 });
ok(page.url().includes('/login'), 'Vereins-Demo: „Verlassen“ führt zur Anmeldung');

// ── Mannschaft ────────────────────────────────────────────────────────────
await a.goto('/demo/team');
await text(page, 'Wie heißt die Mannschaft?').waitFor({ timeout: 20_000 });
await page.getByLabel('Name', { exact: true }).fill('B-Jugend II');
await page.getByLabel('Kürzel', { exact: true }).fill('B2');
for (let i = 0; i < 10; i++) await next();
await text(page, 'Alles bereit?').waitFor();
await next('Mannschaft anlegen');
await text(page, 'Mannschaft angelegt').waitFor({ timeout: 10_000 });
ok(true, 'Mannschafts-Demo: alle Schritte bis zum Abschluss');
await button(page, 'Verlassen').click();
await page.waitForURL(/\/login/, { timeout: 10_000 });
ok(page.url().includes('/login'), 'Mannschafts-Demo: „Verlassen“ führt zur Anmeldung');

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
