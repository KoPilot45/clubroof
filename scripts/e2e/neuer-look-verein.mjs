/**
 * Paket L, Schritt 5: Verein im neuen Look (hell und dunkel).
 * Aufruf: pnpm browser-check scripts/e2e/neuer-look-verein.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { api, button, launch, text } from '../lib/e2e.mjs';

const SHOTS = process.env.CLUBROOF_SHOTS ?? join(process.cwd(), '.check', 'shots');
mkdirSync(SHOTS, { recursive: true });
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};
const setMode = (login, colorMode) =>
  api('/me/preferences', login.token, { method: 'PUT', body: JSON.stringify({ colorMode }) });

const b = await launch();
const files = {};

for (const [who, modes] of [
  ['vorstand', ['light', 'dark']],
  ['spieler', ['light']],
]) {
  const { page, login, goto } = await b.session(who);
  for (const mode of modes) {
    await setMode(login, mode);
    await goto('/verein');
    await text(page, 'Vereinsleben').waitFor({ timeout: 20_000 });
    ok(await text(page, 'Heute auf der Anlage').isVisible(), `${who} ${mode}: Anlage heute`);
    ok(await text(page, 'Vereinsnews').isVisible(), `${who} ${mode}: Vereinsnews`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok(overflow <= 0, `${who} ${mode}: kein horizontales Scrollen`);
    for (const label of ['News', 'Veranstaltungen']) {
      const box = await button(page, new RegExp(`^${label}`)).boundingBox();
      ok(box && box.height >= 44, `${who} ${mode}: Kachel „${label}“ mindestens 44 pt`);
    }
    files[`${who}-${mode}`] = await b.shot(page, `nlv-${who}-${mode}`, true);
  }
  await setMode(login, 'light');
  if (who === 'vorstand') {
    await goto('/verein');
    await text(page, 'Vereinsleben').waitFor({ timeout: 20_000 });
    const more = button(page, 'Mehr erfahren');
    {
      await more.waitFor({ timeout: 10_000 });
      await more.click();
      await page.waitForURL(/events\//, { timeout: 10_000 });
      ok(true, 'Blickfang „Mehr erfahren“ öffnet den Vereinstermin');
    }
  }
}

const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const keys = ['vorstand-light', 'vorstand-dark', 'spieler-light'];
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${keys
  .map((k) => `<img src="${img(files[k])}" style="width:300px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'neuer-look-verein.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 990, height: 1000 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'neuer-look-verein.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'neuer-look-verein.png')}`);

ok(
  b.errors.length === 0,
  b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
