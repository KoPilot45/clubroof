/** Einrichtungs-Demos (Verein, Mannschaft, Kasse, Mannschaftskasse) = echte Assistenten ohne Speichern: komplett durchklicken bis „Verlassen“. */
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

// ── Verein: Schnellstart ───────────────────────────────────────────────────
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
await next();
await text(page, 'Alles bereit?').waitFor();
// „Ändern“ springt in den Schritt und danach zurück zur Zusammenfassung
await page
  .getByRole('button', { name: /Verein ändern/ })
  .first()
  .click();
await text(page, 'Wie heißt euer Verein?').waitFor();
await next();
await text(page, 'Alles bereit?').waitFor();
ok(true, 'Vereins-Demo (Schnellstart): Zusammenfassung mit „Ändern“');
await next('Einrichtung abschließen');
await text(page, 'Dein Verein ist eingerichtet').waitFor({ timeout: 10_000 });
ok(true, 'Vereins-Demo (Schnellstart): alle Schritte bis zum Abschluss');
await button(page, 'Verlassen').click();
await page.waitForURL(/\/login/, { timeout: 10_000 });
ok(page.url().includes('/login'), 'Vereins-Demo: „Verlassen“ führt zur Anmeldung');

// ── Verein: ausführlich (mit den Schritten Größe, Euer Verein, Saison, Vorstand, Mitglieder, Kommunikation) ──
await a.goto('/demo/club');
await text(page, 'Willkommen bei Clubroof').waitFor({ timeout: 20_000 });
await page.getByRole('radio', { name: /Ausführlich/ }).click();
await next('Los geht’s');
await text(page, 'Wie groß ist euer Verein?').waitFor();
await page.getByRole('radio', { name: /Großverein/ }).click();
await next();
await text(page, 'Wie heißt euer Verein?').waitFor();
await page.getByLabel('Vereinsname').fill('TSV Beispiel 1900');
await page.getByLabel('Kurzname').fill('TSV Beispiel');
await next();
await text(page, 'Euer Verein').waitFor();
await page.getByLabel('Ort').fill('Beispielstadt');
await next();
await text(page, 'Wo spielt ihr?').waitFor();
await page.getByLabel('Name der Anlage', { exact: false }).first().fill('Stadion');
// Plätze, Untergrund, Logo, Farbe, Aufbau
for (let i = 0; i < 3; i++) await next();
await next('Ohne Logo weiter');
await next();
await next();
await text(page, 'Wann beginnt eure Saison?').waitFor();
await next();
await text(page, 'Vorstand und Aufgaben').waitFor();
await next();
await text(page, 'Wofür nutzt ihr Clubroof – in der Mannschaft?').waitFor();
await next();
await text(page, 'Und im Verein?').waitFor();
await next();
await text(page, 'Jetzt oder später')
  .waitFor({ timeout: 2000 })
  .catch(() => undefined);
await next();
await text(page, 'Kommunikation und Datenschutz').waitFor();
await next();
await text(page, 'Dein Konto').waitFor();
ok(true, 'Vereins-Demo (ausführlich): neue Schritte durchlaufen');

// ── Mannschaft: Schnellstart ───────────────────────────────────────────────
await a.goto('/demo/team');
await text(page, 'Eine Mannschaft anlegen').waitFor({ timeout: 20_000 });
await next();
await text(page, 'Wie heißt die Mannschaft?').waitFor();
await page.getByLabel('Name', { exact: true }).fill('B-Jugend II');
await page.getByLabel('Kürzel', { exact: true }).fill('B2');
await next();
// Abteilung, Altersklasse, Zusagen, Training, Trainer, Kader
for (let i = 0; i < 6; i++) await next();
await text(page, 'Alles bereit?').waitFor();
// „Ändern“ springt in den Schritt und danach zurück zur Zusammenfassung
await page
  .getByRole('button', { name: /Mannschaft ändern/ })
  .first()
  .click();
await text(page, 'Wie heißt die Mannschaft?').waitFor();
await next();
await text(page, 'Alles bereit?').waitFor();
ok(true, 'Mannschafts-Demo (Schnellstart): Zusammenfassung mit „Ändern“');
await next('Mannschaft anlegen');
await text(page, 'Mannschaft angelegt').waitFor({ timeout: 10_000 });
ok(true, 'Mannschafts-Demo (Schnellstart): alle Schritte bis zum Abschluss');
await button(page, 'Verlassen').click();
await page.waitForURL(/\/login/, { timeout: 10_000 });
ok(page.url().includes('/login'), 'Mannschafts-Demo: „Verlassen“ führt zur Anmeldung');

// ── Mannschaft: ausführlich ────────────────────────────────────────────────
await a.goto('/demo/team');
await text(page, 'Eine Mannschaft anlegen').waitFor({ timeout: 20_000 });
await page.getByRole('radio', { name: /Ausführlich/ }).click();
await next();
await text(page, 'Wie heißt die Mannschaft?').waitFor();
await page.getByLabel('Name', { exact: true }).fill('A-Jugend');
await page.getByLabel('Kürzel', { exact: true }).fill('A1');
await next();
// Abteilung, Altersklasse, Vorlage
for (let i = 0; i < 3; i++) await next();
await text(page, 'Wie sagen Spieler zu und ab?').waitFor();
ok(
  (await page.getByText('Empfohlen').filter({ visible: true }).count()) > 0,
  'Mannschafts-Demo: „Automatisch zugesagt“ ist als empfohlen markiert',
);
await next();
// Treffpunkt, Training (mit einem Termin), Trainer, Kader, Funktionen, Spielplan, Information
await next();
await text(page, 'Wann trainiert die Mannschaft?').waitFor();
await button(page, 'Trainingstermin hinzufügen').click();
await text(page, 'Zeitraum').waitFor();
ok(
  (await page
    .getByText(/\d+ Trainingstermine/)
    .filter({ visible: true })
    .count()) > 0,
  'Mannschafts-Demo: Anzahl der Trainingstermine wird angezeigt',
);
for (let i = 0; i < 6; i++) await next();
await text(page, 'Alles bereit?').waitFor();
await next('Mannschaft anlegen');
await text(page, 'Mannschaft angelegt').waitFor({ timeout: 10_000 });
ok(true, 'Mannschafts-Demo (ausführlich): alle Schritte bis zum Abschluss');
await button(page, 'Verlassen').click();
await page.waitForURL(/\/login/, { timeout: 10_000 });

// ── Kasse: Schnellstart ────────────────────────────────────────────────────
await a.goto('/demo/cash');
await text(page, 'Die Vereinskasse einrichten').waitFor({ timeout: 20_000 });
await next();
await text(page, 'Ist der Verein gemeinnützig?').waitFor();
await page.getByText('Ja, gemeinnützig').click();
await next();
await text(page, 'Welche Konten und Kassen gibt es?').waitFor();
await page.getByLabel('Anfangsbestand in €').fill('1500');
await next();
await text(page, 'Kategorien für Buchungen').waitFor();
await next();
await text(page, 'Mitgliedsbeiträge').waitFor();
await button(page, 'Vorschläge einfügen').click();
await next();
await text(page, 'Wer führt die Kasse?').waitFor();
await next();
await text(page, 'Alles bereit?').waitFor();
await page
  .getByRole('button', { name: /Konten ändern/ })
  .first()
  .click();
await text(page, 'Welche Konten und Kassen gibt es?').waitFor();
await next();
await text(page, 'Alles bereit?').waitFor();
ok(true, 'Kassen-Demo (Schnellstart): Zusammenfassung mit „Ändern“');
await next('Kasse einrichten');
await text(page, 'Kasse eingerichtet').waitFor({ timeout: 10_000 });
ok(true, 'Kassen-Demo (Schnellstart): alle Schritte bis zum Abschluss');
await button(page, 'Verlassen').click();
await page.waitForURL(/\/login/, { timeout: 10_000 });

// ── Kasse: ausführlich ─────────────────────────────────────────────────────
await a.goto('/demo/cash');
await text(page, 'Die Vereinskasse einrichten').waitFor({ timeout: 20_000 });
await page.getByText('Ausführlich', { exact: true }).first().click();
await next();
for (const title of [
  'Ist der Verein gemeinnützig?',
  'Welche Konten und Kassen gibt es?',
  'Kategorien für Buchungen',
  'Kostenstellen',
  'Mitgliedsbeiträge',
  'Wer zahlt welchen Beitrag?',
  'Zahlungserinnerungen',
  'Wer führt die Kasse?',
  'Wer darf die Kasse einsehen?',
]) {
  await text(page, title).first().waitFor();
  await next();
}
await text(page, 'Alles bereit?').waitFor();
await next('Kasse einrichten');
await text(page, 'Kasse eingerichtet').waitFor({ timeout: 10_000 });
ok(true, 'Kassen-Demo (ausführlich): alle Schritte bis zum Abschluss');
await button(page, 'Verlassen').click();
await page.waitForURL(/\/login/, { timeout: 10_000 });

// ── Mannschaftskasse ───────────────────────────────────────────────────────
await a.goto('/demo/team-cash');
await text(page, 'Die Mannschaftskasse einrichten').waitFor({ timeout: 20_000 });
await next();
await text(page, 'Wer führt die Kasse?').waitFor();
await next();
await text(page, 'Wie viel ist schon in der Kasse?').waitFor();
await page.getByLabel('Anfangsbestand in €').fill('250');
await next();
await text(page, 'Strafenkatalog').first().waitFor();
await next();
await text(page, 'Getränkepreis').first().waitFor();
await next();
await text(page, 'Beitrag oder Umlage').waitFor();
await next();
await text(page, 'Was darf die Mannschaft sehen?').waitFor();
await next();
await text(page, 'Alles bereit?').waitFor();
await page
  .getByRole('button', { name: /Anfangsbestand ändern/ })
  .first()
  .click();
await text(page, 'Wie viel ist schon in der Kasse?').waitFor();
await next();
await text(page, 'Alles bereit?').waitFor();
ok(true, 'Mannschaftskasse-Demo: Zusammenfassung mit „Ändern“');
await next('Kasse einrichten');
await text(page, 'Mannschaftskasse eingerichtet').waitFor({ timeout: 10_000 });
ok(true, 'Mannschaftskasse-Demo: alle Schritte bis zum Abschluss');
await button(page, 'Verlassen').click();
await page.waitForURL(/\/login/, { timeout: 10_000 });

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
