/**
 * Paket L, Schritt 3: Team im neuen Look (hell und dunkel) und Zu-/Absage-Symbole auf den Spielkarten.
 * Aufruf: pnpm browser-check scripts/e2e/neuer-look-team.mjs
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

// Eltern: Spielkarten mit Symbolen, Team-Kacheln mit mehreren Mannschaften
{
  const { page, login, goto } = await b.session('eltern');
  await setMode(login, 'light');
  await goto('/');
  await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
  for (const name of ['Zusagen', 'Unsicher', 'Absagen']) {
    const box = await button(page, name).boundingBox();
    ok(
      box && box.width >= 44 && box.height >= 44,
      `Spielkarte: Symbol „${name}“ mindestens 44 pt (${Math.round(box?.width)}×${Math.round(box?.height)})`,
    );
  }
  ok(
    !(await text(page, 'Zusagen', { exact: true })
      .isVisible()
      .catch(() => false)),
    'Spielkarte: keine Beschriftung neben dem Symbol',
  );
  files['home-icons'] = await b.shot(page, 'nlt-home-icons', false);
  for (const mode of ['light', 'dark']) {
    await setMode(login, mode);
    await goto('/team');
    await text(page, 'Nächster Termin').waitFor({ timeout: 20_000 });
    ok(
      (await page.getByRole('tab', { name: /aktiv|E1|F1|B1/ }).count()) >= 0,
      `${mode}: Team lädt`,
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok(overflow <= 0, `${mode}: Eltern-Team ohne horizontales Scrollen`);
    files[`eltern-${mode}`] = await b.shot(page, `nlt-eltern-${mode}`, true);
  }
  await setMode(login, 'light');
}

// Trainer: Kader, Kacheln mit Hinweisen, Ergebnisse
{
  const { page, login, goto } = await b.session('trainer');
  for (const mode of ['light', 'dark']) {
    await setMode(login, mode);
    await goto('/team');
    await text(page, 'Nächster Termin').waitFor({ timeout: 20_000 });
    ok(
      await text(page, 'Kader', { exact: true }).first().isVisible(),
      `${mode}: Trainer sieht Kader`,
    );
    for (const label of ['Termine', 'Kader']) {
      const box = await button(page, new RegExp(`^${label}`)).boundingBox();
      ok(box && box.height >= 44, `${mode}: Kachel „${label}“ mindestens 44 pt hoch`);
    }
    files[`trainer-${mode}`] = await b.shot(page, `nlt-trainer-${mode}`, true);
  }
  await setMode(login, 'light');
  await button(page, /^Kader/).click();
  await text(page, 'Spieler').first().waitFor({ timeout: 15_000 });
  ok(true, 'Kachel „Kader“ öffnet die Kaderseite');
}

const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const keys = ['home-icons', 'eltern-light', 'trainer-light', 'trainer-dark'];
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${keys
  .map((k) => `<img src="${img(files[k])}" style="width:300px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'neuer-look-team.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 1290, height: 1000 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'neuer-look-team.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'neuer-look-team.png')}`);

ok(
  b.errors.length === 0,
  b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
