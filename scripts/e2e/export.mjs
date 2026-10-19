/**
 * Paket IMPORT-EXPORT, Stufe 3: Exporte im Browser – Admin lädt Mitglieder, Gesamtexport und „Meine Daten“,
 * der Spieler sieht nur „Meine Daten“.
 * pnpm browser-check scripts/e2e/export.mjs [--no-build]   (SCHEME=light für hell)
 */
import { launch } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const b = await launch();

const { page, goto } = await b.session('admin', { width: 1280, height: 900 });
await goto('/export');
await page.getByText('Meine Daten', { exact: true }).first().waitFor({ timeout: 20_000 });
const download = async (title) => {
  const card = page
    .getByText(title, { exact: true })
    .first()
    .locator('xpath=ancestor::div[.//*[@role="button"] or .//button][1]');
  const [file] = await Promise.all([
    page.waitForEvent('download', { timeout: 20_000 }),
    card
      .getByRole('button', { name: /herunterladen/i })
      .first()
      .click(),
  ]);
  return file.suggestedFilename();
};
ok((await download('Mitglieder')).endsWith('.xlsx'), 'Admin: Mitglieder als Excel');
ok((await download('Meine Daten')).includes('Meine Daten'), 'Admin: Meine Daten');
ok((await download('Gesamtexport des Vereins')).endsWith('.zip'), 'Admin: Gesamtexport als ZIP');
await page.screenshot({ path: '.check/shots/export-admin.png' });

const player = await b.session('spieler', { width: 1280, height: 900 });
await player.goto('/export');
await player.page.getByText('Meine Daten', { exact: true }).first().waitFor({ timeout: 20_000 });
ok(
  (await player.page.getByText('Gesamtexport des Vereins').count()) === 0,
  'Spieler: kein Gesamtexport sichtbar',
);
ok(
  (await player.page.getByText('Mitglieder', { exact: true }).count()) === 0,
  'Spieler: keine Mitgliederliste',
);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (fail || b.errors.length) process.exit(1);
