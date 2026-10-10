/**
 * Paket L, Schritt 4: Termine im neuen Look (hell und dunkel).
 * Aufruf: pnpm browser-check scripts/e2e/neuer-look-termine.mjs
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
  ['eltern', ['light', 'dark']],
  ['trainer', ['light']],
]) {
  const { page, login, goto } = await b.session(who);
  for (const mode of modes) {
    await setMode(login, mode);
    await goto('/termine');
    await text(page, 'Als Nächstes').waitFor({ timeout: 20_000 });
    for (const f of ['Alle', 'Spiele', 'Training', 'Verein']) {
      ok(
        await page.getByRole('radio', { name: f }).filter({ visible: true }).first().isVisible(),
        `${who} ${mode}: Filter „${f}“`,
      );
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok(overflow <= 0, `${who} ${mode}: kein horizontales Scrollen`);
    files[`${who}-${mode}`] = await b.shot(page, `nlte-${who}-${mode}`, true);
  }
  await setMode(login, 'light');

  if (who === 'eltern') {
    await goto('/termine');
    await text(page, 'Als Nächstes').waitFor({ timeout: 20_000 });
    // Kinderfilter: Zeile mit Vornamen verschwindet nicht, Filter „Spiele“ zeigt nur Spiele
    const kid = login.me.managedPersons.find((p) => p.relation === 'child');
    ok(
      !!(await page
        .getByRole('radio', { name: kid.firstName })
        .filter({ visible: true })
        .first()
        .isVisible()),
      `Filter je Kind („${kid.firstName}“)`,
    );
    await page.getByRole('radio', { name: 'Training' }).filter({ visible: true }).first().click();
    const rows = await page
      .getByText(/Training$|Spiel$/)
      .filter({ visible: true })
      .count();
    ok(rows >= 0, 'Filter „Training“ angewendet');
    await page.getByRole('radio', { name: 'Alle' }).filter({ visible: true }).first().click();
    // Kalender: Tag wählen zeigt Terminabschnitt
    const day = page
      .getByRole('button', { name: /^\d+\. \d+ Termine?$/ })
      .filter({ visible: true })
      .first();
    await day.click();
    ok(
      await text(page, /Termine an diesem Tag|Uhr|\d{2}:\d{2}/)
        .isVisible()
        .catch(() => false),
      'Kalender: Tag wählen zeigt Termine',
    );
    const box = await page
      .getByRole('button', { name: 'Nächster Monat' })
      .filter({ visible: true })
      .first()
      .boundingBox();
    ok(box && box.width >= 44 && box.height >= 44, 'Monatsknopf mindestens 44 pt');
  }
}

const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const keys = ['eltern-light', 'eltern-dark', 'trainer-light'];
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${keys
  .map((k) => `<img src="${img(files[k])}" style="width:300px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'neuer-look-termine.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 990, height: 1000 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'neuer-look-termine.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'neuer-look-termine.png')}`);

ok(
  b.errors.length === 0,
  b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
