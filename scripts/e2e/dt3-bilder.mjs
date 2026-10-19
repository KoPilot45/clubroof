/** Paket DT3: Bilder wichtiger Seiten bei 1280 und 1440 px (Kopfzeile, Titel, Navigation). */
import { launch } from '../lib/e2e.mjs';

const pages = (process.env.PAGES ?? '/,/forum,/admin/members,/club-cash/entries').split(',');
const widths = (process.env.WIDTHS ?? '1280,1440').split(',').map(Number);
const b = await launch();
const who = process.env.WHO ?? 'admin';
const out = [];
for (const width of widths) {
  const { page, goto } = await b.session(who, { width, height: 760 });
  for (const url of pages) {
    await goto(url);
    await page.waitForTimeout(1200);
    out.push({ name: `${width} ${url}`, buf: await page.screenshot() });
  }
}
await b.close();
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('.check/dt3', { recursive: true });
out.forEach((o, i) => writeFileSync(`.check/dt3/${i}.png`, o.buf));
console.log(`${out.length} Bilder in .check/dt3 (Spalten: ${pages.length})`);
