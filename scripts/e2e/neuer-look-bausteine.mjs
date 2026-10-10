/**
 * Paket L, Schritt 1: Bausteine und Navigation (hell und dunkel).
 * Prüft Tab-Leiste (fünf Punkte, aktiver Bereich als Pille), Kopfzeile, Bausteine-Seite
 * (Umbruch langer Namen, Tippflächen ≥ 44) und baut einen Bilder-Überblick (.check/shots/neuer-look-bausteine.png).
 * Aufruf: pnpm browser-check scripts/e2e/neuer-look-bausteine.mjs --no-build
 */
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

const b = await launch();
const { page, login, goto } = await b.session('eltern');
const files = {};

for (const mode of ['light', 'dark']) {
  await api('/me/preferences', login.token, {
    method: 'PUT',
    body: JSON.stringify({ colorMode: mode }),
  });
  await goto('/');
  await button(page, 'Benachrichtigungen').waitFor({ timeout: 20_000 });

  // Tab-Leiste: fünf Punkte, Home aktiv mit Beschriftung, übrige nur Icon
  const tabs = page.getByRole('tab');
  ok((await tabs.count()) === 5, `${mode}: fünf Tab-Punkte`);
  const sel = await page.locator('[role=tab][aria-selected=true]').count();
  ok(sel === 1, `${mode}: genau ein aktiver Bereich`);
  ok(
    await text(page, 'Home', { exact: true }).isVisible(),
    `${mode}: aktiver Bereich zeigt Beschriftung`,
  );
  for (let i = 0; i < 5; i++) {
    const box = await tabs.nth(i).boundingBox();
    ok(
      box && box.width >= 44 && box.height >= 44,
      `${mode}: Tab ${i + 1} mindestens 44 pt (${Math.round(box?.width)}×${Math.round(box?.height)})`,
    );
  }
  const bell = await button(page, 'Benachrichtigungen').boundingBox();
  ok(bell && bell.width >= 44 && bell.height >= 44, `${mode}: Glocke mindestens 44 pt`);
  files[`${mode}-home`] = await b.shot(page, `nl-${mode}-home`, false);

  // Wechsel des Bereichs: Pille wandert
  await tabs.nth(2).click();
  await text(page, 'Termine', { exact: true }).waitFor({ timeout: 10_000 });
  ok(
    (await page.locator('[role=tab][aria-selected=true]').count()) === 1,
    `${mode}: Pille wandert zu Termine`,
  );

  // Bausteine-Seite
  await goto('/bausteine');
  await text(page, 'Karten und Listen').waitFor({ timeout: 20_000 });
  const title = page.getByRole('heading', { level: 1 }).first();
  const h = await text(page, /^Hallo, Maximilian/).boundingBox();
  ok(
    h && h.height <= 2 * 30,
    `${mode}: langer Name bricht auf höchstens zwei Zeilen (${Math.round(h?.height)} pt)`,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  ok(overflow <= 0, `${mode}: kein horizontales Scrollen`);
  for (const label of ['Zusagen', 'Unsicher', 'Speichern', 'Abbrechen', 'Dezent']) {
    const box = await button(page, label).boundingBox();
    ok(
      box && box.height >= 44,
      `${mode}: Button „${label}“ mindestens 44 pt hoch (${Math.round(box?.height)})`,
    );
  }
  files[`${mode}-bausteine`] = await b.shot(page, `nl-${mode}-bausteine`, true);
}
await api('/me/preferences', login.token, {
  method: 'PUT',
  body: JSON.stringify({ colorMode: 'light' }),
});

// Überblick: vier Bilder nebeneinander in einer Seite
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${[
  'light-home',
  'light-bausteine',
  'dark-home',
  'dark-bausteine',
]
  .map((k) => `<img src="${img(files[k])}" style="width:300px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'neuer-look-bausteine.html');
writeFileSync(overview, html);
const p2 = await (
  await (
    await import('node:module')
  )
    .createRequire(import.meta.url)('playwright')
    .chromium.launch()
).newPage({ viewport: { width: 1290, height: 1000 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'neuer-look-bausteine.png'), fullPage: true });
console.log(`📷 ${join(SHOTS, 'neuer-look-bausteine.png')}`);
await p2.context().browser().close();

ok(
  b.errors.length === 0,
  b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
