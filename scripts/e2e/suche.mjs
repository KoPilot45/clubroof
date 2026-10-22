/** Globale Suche: Lupe öffnet die Suche, Ergebnisse je Abteilung, Antippen öffnet das Ziel. */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};
const { page, goto } = await b.session('spieler', { width: 390, height: 900 });
await goto('/');
const lupe = page.getByRole('button', { name: 'Suche' }).filter({ visible: true }).first();
await lupe.waitFor({ timeout: 20_000 });
const box = await lupe.boundingBox();
ok(box && box.width >= 43.5 && box.height >= 43.5, 'Lupe mindestens 44 pt');
await lupe.click();
const input = page.getByRole('textbox').first();
await input.waitFor({ timeout: 10_000 });
ok(await text(page, 'Was suchst du?').isVisible(), 'Startzustand mit Hinweis');
await input.fill('Training');
await text(page, 'Termine', { exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Termine gefunden');
await input.fill('Jugend');
await text(page, 'Mannschaften', { exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Mannschaften gefunden');
await input.fill('Zzzzqq');
await text(page, 'Nichts gefunden').waitFor({ timeout: 10_000 });
ok(true, 'Leerer Zustand „Nichts gefunden“');
await input.fill('Mustermann');
await text(page, 'Max Mustermann').waitFor({ timeout: 10_000 });
await text(page, 'Max Mustermann').click();
await page.waitForURL(/profile\//, { timeout: 10_000 });
ok(true, 'Treffer öffnet das Profil');
ok(b.errors.length === 0, b.errors.length ? b.errors.join('\n') : 'keine Konsolenfehler');
await b.close();
process.exit(failed ? 1 : 0);
