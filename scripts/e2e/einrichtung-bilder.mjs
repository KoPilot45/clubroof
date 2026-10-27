/** Bilder der neuen Assistenten-Schritte (EINRICHTUNG-ENTSCHEIDUNGEN): 390 und 1440 px, Darstellung per SCHEME=light|dark. */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
const scheme = process.env.SCHEME === 'light' ? 'hell' : 'dunkel';
const click = (page, label) =>
  page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first().click();

async function run(width, height, suffix) {
  const a = await b.anonymous({ width, height });
  const { page } = a;
  const snap = (name) => b.shot(page, `einrichtung-${suffix}-${scheme}-${name}`, false);
  const next = () => click(page, 'Weiter');

  // Mannschaft (ausführlich): Zusagen, Wer sieht was?
  await a.goto('/demo/team');
  await text(page, 'Eine Mannschaft anlegen').waitFor({ timeout: 20_000 });
  await page.getByRole('radio', { name: /Ausführlich/ }).click();
  await next();
  await page.getByLabel('Name', { exact: true }).fill('A-Jugend');
  await page.getByLabel('Kürzel', { exact: true }).fill('A1');
  for (let i = 0; i < 5; i++) await next();
  await text(page, 'Wie sagen Spieler zu und ab?').waitFor();
  await snap('1-team-zusagen');
  for (let i = 0; i < 5; i++) await next();
  await text(page, 'Wer sieht was?').first().waitFor();
  await snap('2-team-wer-sieht-was');

  // Verein (ausführlich): Vertretung, Beitrittsfreigabe
  await a.goto('/demo/club');
  await text(page, 'Willkommen bei Clubroof').waitFor({ timeout: 20_000 });
  await page.getByRole('radio', { name: /Ausführlich/ }).click();
  await click(page, 'Los geht’s');
  for (const t of [
    'Wie groß ist euer Verein?',
    'Wie heißt euer Verein?',
    'Euer Verein',
    'Wo spielt ihr?',
  ]) {
    await text(page, t).first().waitFor();
    if (t === 'Wie heißt euer Verein?') {
      await page.getByLabel('Vereinsname').fill('TSV Beispiel 1900');
      await page.getByLabel('Kurzname').fill('TSV Beispiel');
    }
    if (t === 'Wo spielt ihr?')
      await page.getByLabel('Name der Anlage', { exact: false }).first().fill('Stadion');
    await next();
  }
  for (let i = 0; i < 2; i++) await next();
  await click(page, 'Ohne Logo weiter');
  await next();
  await next();
  await text(page, 'Wann beginnt eure Saison?').waitFor();
  await next();
  await next();
  await text(page, 'Wer vertritt dich?').waitFor();
  await snap('3-verein-vertretung');
  for (let i = 0; i < 4; i++) await next();
  await text(page, 'Neue Mitglieder: Wer gibt Beitrittsanfragen frei?').waitFor();
  await snap('4-verein-beitritt');

  // Vereinskasse (ausführlich): Haushaltsjahr, Auslagen
  await a.goto('/demo/cash');
  await text(page, 'Die Vereinskasse einrichten').waitFor({ timeout: 20_000 });
  await page.getByText('Ausführlich', { exact: true }).first().click();
  await next();
  await next();
  await text(page, 'Haushaltsjahr').first().waitFor();
  await snap('5-kasse-haushaltsjahr');
  await next();
  for (const t of [
    'Welche Konten und Kassen gibt es?',
    'Kategorien für Buchungen',
    'Kostenstellen',
    'Mitgliedsbeiträge',
    'Wer zahlt welchen Beitrag?',
    'Zahlungserinnerungen',
    'Wer führt die Kasse?',
  ]) {
    await text(page, t).first().waitFor();
    await next();
  }
  await text(page, 'Auslagen und Freigaben').waitFor();
  await snap('6-kasse-auslagen');

  // Mannschaftskasse (ausführlich): Wer darf buchen?, Saisonabschluss
  await a.goto('/demo/team-cash');
  await text(page, 'Die Mannschaftskasse einrichten').waitFor({ timeout: 20_000 });
  await page.getByRole('radio', { name: /Ausführlich/ }).click();
  await next();
  await next();
  await text(page, 'Wer darf buchen?').first().waitFor();
  await snap('7-mkasse-buchen');
  for (let i = 0; i < 7; i++) await next();
  await text(page, 'Saisonabschluss').first().waitFor();
  await snap('8-mkasse-saisonende');
}

await run(390, 844, 'm');
await run(1440, 900, 'd');
await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (b.errors.length) process.exit(1);
