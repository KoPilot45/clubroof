/** Vereinskasse (K1): Übersicht, Ausgabe buchen, im Kassenbuch finden, stornieren; Prüfer sehen, buchen nicht. */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

{
  const { page, goto } = await b.session('kasse');
  await goto('/club-cash');
  await text(page, 'Gesamtbestand aller Konten').waitFor({ timeout: 20_000 });
  ok(await text(page, 'Girokonto Sparkasse').isVisible(), 'Übersicht zeigt die Konten');
  ok(await text(page, 'Ideeller Bereich').isVisible(), 'Summen nach den vier Bereichen');

  await button(page, 'Ausgabe').click();
  await text(page, 'Art der Buchung').waitFor();
  await page.getByLabel('Betrag in €').fill('19,90');
  await page.getByLabel('Verwendungszweck', { exact: true }).fill('Browsertest Spielfeldkreide');
  await text(page, 'Sportgeräte und Material', { exact: true }).click();
  await page.getByText(/^Buchen: /).click();
  await text(page, 'Gesamtbestand aller Konten').waitFor({ timeout: 10_000 });
  await text(page, 'Browsertest Spielfeldkreide').waitFor({ timeout: 10_000 });
  ok(true, 'Ausgabe gebucht, erscheint unter „Letzte Buchungen“');

  await button(page, 'Kassenbuch öffnen').click();
  await page.getByLabel('Suchen').fill('Spielfeldkreide');
  await text(page, 'Browsertest Spielfeldkreide').click();
  await page.getByLabel('Begründung für das Storno').fill('Browsertest aufräumen');
  await button(page, 'Buchung stornieren').click();
  await text(page, 'Keine Buchungen gefunden.').waitFor({ timeout: 10_000 });
  ok(true, 'Buchung storniert und ausgeblendet');
}

{
  const { page, goto } = await b.session('mitglied');
  await goto('/club-cash');
  await text(page, 'Gesamtbestand aller Konten').waitFor({ timeout: 20_000 });
  ok(
    !(await button(page, 'Ausgabe')
      .isVisible()
      .catch(() => false)),
    'Prüfer sehen keine Buchen-Schaltflächen',
  );
}

{
  const { page, goto } = await b.session('spieler');
  await goto('/club-cash');
  await page.waitForTimeout(1500);
  ok(
    !(await text(page, 'Gesamtbestand aller Konten')
      .isVisible()
      .catch(() => false)),
    'Spieler sehen die Vereinskasse nicht',
  );
}

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed) process.exit(1);
