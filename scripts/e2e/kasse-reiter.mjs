/**
 * Paket NACHBESSERUNG-DESKTOP-UND-KASSE (Teil B): In der Vereinskasse stimmt der aktive Reiter auf jeder Seite
 * (Desktop und Handy), „Auswertung“ enthält alle Statistik-Themen, „Spenden“ steht unter „Buchung“.
 * pnpm browser-check scripts/e2e/kasse-reiter.mjs [--no-build]   (SCHEME=light für hell)
 */
import { launch } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const b = await launch();
const EXPECT = {
  '/club-cash/audit': 'Auswertung',
  '/club-cash/tax': 'Auswertung',
  '/club-cash/stats': 'Auswertung',
  '/club-cash/donations': 'Buchung',
  '/club-cash/budget': 'Planung',
  '/club-cash/fees': 'Beiträge',
  '/club-cash/entries': 'Buchung',
};
for (const [name, size] of [
  ['Desktop', { width: 1280, height: 900 }],
  ['Handy', { width: 390, height: 844 }],
]) {
  const { page, goto } = await b.session('admin', size);
  for (const [url, tab] of Object.entries(EXPECT)) {
    await goto(url);
    await page.waitForTimeout(1500);
    const active = await page
      .locator('[role="tab"][aria-selected="true"]')
      .first()
      .getAttribute('aria-label')
      .catch(() => null);
    ok(active === tab, `${name} ${url}: aktiver Reiter „${active}“ (erwartet „${tab}“)`);
  }
  await goto('/club-cash/area/auswertung');
  await page.getByText('Plan gegen Ist', { exact: true }).first().waitFor({ timeout: 15_000 });
  for (const label of [
    'Überblick',
    'Einnahmen & Ausgaben',
    'Beiträge',
    'Abteilungen',
    'Kassenprüfung',
    'Steuerdaten',
  ])
    ok(
      (await page.getByText(label, { exact: true }).count()) > 0,
      `${name} Auswertung: Kachel „${label}“`,
    );
  await goto('/club-cash/area/buchung');
  await page.getByText('Spenden', { exact: true }).first().waitFor({ timeout: 15_000 });
  ok(true, `${name} Buchung: Kachel „Spenden“`);
  await goto('/club-cash/area/pruefung');
  await page.getByText('Kassenprüfung', { exact: true }).first().waitFor({ timeout: 15_000 });
  ok(true, `${name}: alter Link „Prüfung“ führt zur Auswertung`);
}
await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (fail || b.errors.length) process.exit(1);
