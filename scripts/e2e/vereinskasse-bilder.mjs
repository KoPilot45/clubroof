/** Bildübersicht Vereinskasse (einmalig zur Sichtprüfung): Übersicht, Buchen, Einrichtung. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { launch, text } from '../lib/e2e.mjs';

const SHOTS = process.env.CLUBROOF_SHOTS ?? join(process.cwd(), '.check', 'shots');
mkdirSync(SHOTS, { recursive: true });
const b = await launch();
const { page, goto } = await b.session('kasse');
const files = [];
for (const [path, wait, name] of [
  ['/club-cash', 'Gesamtbestand aller Konten', 'uebersicht'],
  ['/club-cash/new?kind=expense', 'Art der Buchung', 'buchen'],
  ['/club-cash/manage', 'Wer darf die Kasse einsehen?', 'einrichtung'],
]) {
  await goto(path);
  await text(page, wait).waitFor({ timeout: 20_000 });
  files.push(await b.shot(page, `vk-${name}`, true));
}
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${files
  .map((f) => `<img src="${img(f)}" style="width:300px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'vereinskasse.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 990, height: 1000 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'vereinskasse.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'vereinskasse.png')}`);
await b.close();
