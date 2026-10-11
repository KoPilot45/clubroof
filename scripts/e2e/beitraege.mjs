/** Vereinskasse: Beiträge (K2): Übersicht, Rückstände, Zahlung buchen, Erinnerung. */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

const { page, goto } = await b.session('kasse');
await goto('/club-cash/fees');
await text(page, 'Offene Beiträge').waitFor({ timeout: 20_000 });
ok(
  await text(page, /davon überfällig/).isVisible(),
  'Übersicht zeigt offene und überfällige Beträge',
);
ok(await text(page, 'Forderungen', { exact: true }).isVisible(), 'Liste der Forderungen');

// Erste überfällige Forderung öffnen und eine Zahlung buchen
const first = page.getByText(/fällig \d{2}\.\d{2}\.\d{4}/).first();
await first.click();
await text(page, 'Zahlung buchen', { exact: true }).waitFor();
await page.getByText('Zahlung buchen', { exact: true }).click();
await text(page, 'Zahlung gebucht.').waitFor({ timeout: 10_000 });
ok(true, 'Zahlung gebucht, Meldung erscheint');

// Erinnerung für die nächste überfällige Forderung
await page
  .getByText(/fällig \d{2}\.\d{2}\.\d{4}/)
  .first()
  .click();
await page.getByText(/Erinnerung Stufe \d senden/).click();
await text(page, /Erinnerung verschickt|vermerkt/).waitFor({ timeout: 10_000 });
ok(true, 'Erinnerung ausgelöst');

await goto('/club-cash/fee-setup');
await text(page, 'Beitragsarten', { exact: true }).waitFor({ timeout: 15_000 });
ok(await text(page, 'Erwachsene').isVisible(), 'Beitragsarten und Zuordnungen sichtbar');

await goto('/club-cash/fee-import');
await text(page, 'CSV-Datei wählen').waitFor({ timeout: 15_000 });
ok(true, 'Import-Bildschirm öffnet');

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
