/**
 * Paket IM, Stufe 1: Import-Assistent im Browser – Bereich, Datei, Zuordnung, Prüfung mit Korrektur, Übernahme, Rückgängig.
 * pnpm browser-check scripts/e2e/import.mjs [--no-build]   (SCHEME=light für hell; Bild in .check/shots/im-*.png)
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { api, launch } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const scheme = process.env.SCHEME === 'light' ? 'hell' : 'dunkel';
const b = await launch();
const dir = mkdtempSync(join(tmpdir(), 'import-'));
const csv = join(dir, 'mitglieder.csv');
writeFileSync(
  csv,
  [
    'Vorname;Nachname;Geburtsdatum;Mail',
    'Browser;Import;03.04.1990;browser.import@example.org',
    'Zweite;Zeile;31.02.2010;',
  ].join('\n'),
);

const { page, goto, login } = await b.session('admin', { width: 1100, height: 900 });
const members = async () => (await api('/admin/members', login.token)).length;
const before = await members();

await goto('/admin/import');
await page.waitForTimeout(2500);
await page.getByRole('radio').first().click();
await page.getByRole('button', { name: 'Weiter' }).click();
await page.waitForTimeout(500);

const chooser = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Datei auswählen' }).click();
(await chooser).setFiles(csv);
await page.waitForTimeout(2500);
ok(
  (await page.getByText('Spalten zuordnen').filter({ visible: true }).count()) > 0,
  'Zuordnung: Schritt 3 erscheint',
);
await page.getByRole('button', { name: 'Weiter' }).click();
await page.waitForTimeout(1500);
ok(
  (await page.getByText('Prüfen und übernehmen').filter({ visible: true }).count()) > 0,
  'Prüfen: Schritt 4 erscheint',
);
ok(
  (await page.getByText('1 fehlerhaft').filter({ visible: true }).count()) > 0,
  'Prüfen: fehlerhafte Zeile erkannt',
);
await b.shot(page, `im-pruefen-${scheme}`, false);

// Fehlerzeile korrigieren: Geburtsdatum ändern
await page.getByRole('button', { name: 'Korrigieren' }).first().click();
await page.waitForTimeout(500);
const birth = page.getByLabel('Geburtsdatum').filter({ visible: true }).first();
await birth.fill('01.02.2010');
await page
  .getByRole('button', { name: /Übernehmen$/ })
  .filter({ visible: true })
  .last()
  .click();
await page.waitForTimeout(1500);
ok(
  (await page.getByText('0 fehlerhaft').filter({ visible: true }).count()) > 0,
  'Korrektur: keine fehlerhafte Zeile mehr',
);
await page.getByRole('button', { name: /2 Einträge übernehmen/ }).click();
await page.waitForTimeout(2500);
ok(
  (await page.getByText('Import abgeschlossen').filter({ visible: true }).count()) > 0,
  'Ergebnis: Import abgeschlossen',
);
ok((await members()) === before + 2, 'Übernahme: zwei neue Mitglieder in der Verwaltung');

await page.getByRole('button', { name: 'Rückgängig machen' }).click();
await page.waitForTimeout(2000);
ok(
  (await page.getByText('Import rückgängig gemacht').filter({ visible: true }).count()) > 0,
  'Rückgängig: Meldung erscheint',
);
ok((await members()) === before, 'Rückgängig: Mitglieder wieder wie vorher');

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(fail || b.errors.length ? 1 : 0);
