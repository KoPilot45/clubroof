/**
 * Hero-Abnahme (DESIGN-ANSTOSS, „Hero-Blöcke: exakte Vorgabe“): schneidet Referenz und App-Hero aus und
 * gibt die Messpunkte aus. pnpm browser-check scripts/e2e/hero-messung.mjs --no-build
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { launch } from '../lib/e2e.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const CASES = [
  { ref: 'DarkTeam', who: 'eltern', path: '/team', label: 'Kader' },
  { ref: 'DarkTermine', who: 'eltern', path: '/termine', label: 'Als Nächstes' },
  { ref: 'DarkVerein', who: 'eltern', path: '/verein', label: 'Nächster Vereinstermin' },
  { ref: 'DarkMehr', who: 'eltern', path: '/mehr', label: 'Julia' },
];
const out = [];
const rb = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const b = await launch();
for (const c of CASES) {
  const rp = await (await rb.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  await rp.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await rp.goto(`file:///home/user/clubroof/docs/design/anstoss/${c.ref}.html`);
  await rp.waitForTimeout(300);
  const box = await rp.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) =>
      /radial-gradient\(120% 120%/.test(d.getAttribute('style') || ''),
    );
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await rp.screenshot({ path: `/tmp/hero-ref-${c.ref}.png`, fullPage: true });
  const s = await b.session(c.who, { width: 390, height: 1400 });
  await s.goto(c.path);
  await s.page.waitForTimeout(2500);
  const abox = await s.page.evaluate((label) => {
    const t = [...document.querySelectorAll('div,span')].find(
      (e) =>
        e.textContent?.trim().toUpperCase().startsWith(label.toUpperCase()) &&
        e.children.length === 0,
    );
    let el = t;
    while (el && el.getBoundingClientRect().width < 330) el = el.parentElement;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, c.label);
  await s.page.screenshot({ path: `/tmp/hero-app-${c.ref}.png` });
  out.push({ ...c, box, abox });
}
await rb.close();
await b.close();
writeFileSync('/tmp/hero-boxes.json', JSON.stringify(out));
console.log('ok', out.length);
