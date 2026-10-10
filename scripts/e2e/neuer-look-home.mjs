/**
 * Paket L, Schritt 2: Home im neuen Look (hell und dunkel).
 * Prüft Spiele zum Wischen, Offen, Deine Woche, Schnellzugriff (anpassen, speichern, zurücksetzen),
 * Grund-Blatt beim Absagen und baut einen Bilder-Überblick (.check/shots/neuer-look-home.png).
 * Aufruf: pnpm browser-check scripts/e2e/neuer-look-home.mjs
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

// ── Eltern (zwei Kinder): Spiele, Woche, Offen, Absage-Blatt ──────────────────────────────
{
  const { page, login, goto } = await b.session('eltern');
  for (const mode of ['light', 'dark']) {
    await setMode(login, mode);
    await goto('/');
    await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
    ok(
      await text(page, /Nächste Spiele · 1 von/).isVisible(),
      `${mode}: Spielekarten mit „1 von n“`,
    );
    ok(await text(page, 'Schnellzugriff').isVisible(), `${mode}: Schnellzugriff sichtbar`);
    ok(await text(page, 'Neuigkeiten für dich').isVisible(), `${mode}: Neuigkeiten sichtbar`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok(overflow <= 0, `${mode}: kein horizontales Scrollen`);
    files[`eltern-${mode}`] = await b.shot(page, `nlh-eltern-${mode}`, true);
  }
  await setMode(login, 'light');
  await goto('/');
  await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
  // Absagen auf der Spielkarte öffnet das Blatt mit Grund
  await button(page, 'Absagen').click();
  ok(
    await text(page, 'Warum kannst du nicht?').isVisible(),
    'Absagen: Blatt von unten mit Grund-Frage',
  );
  await button(page, 'Abbrechen').click();
}

// ── Vorstand: Überblick, Schnellzugriff anpassen ──────────────────────────────────────────
{
  const { page, login, goto } = await b.session('vorstand');
  for (const mode of ['light', 'dark']) {
    await setMode(login, mode);
    await goto('/');
    await text(page, 'Verein im Überblick').waitFor({ timeout: 20_000 });
    ok(
      await button(page, 'Verwaltung').isVisible(),
      `${mode}: Verwaltung im Schnellzugriff (Standard)`,
    );
    files[`vorstand-${mode}`] = await b.shot(page, `nlh-vorstand-${mode}`, true);
  }
  await setMode(login, 'light');
  await goto('/');
  await text(page, 'Schnellzugriff').waitFor({ timeout: 20_000 });
  // Hinweise an den Schnellzugriff-Chips (aus den Kachel-Infos)
  const club = await api('/tile-info?hub=club', login.token);
  const more = await api('/tile-info?hub=more', login.token);
  const expected = [club.news, more.absences, more.invites].filter(
    (e) => e && (e.badge || /neu/i.test(e.hint ?? '')),
  );
  if (expected.length) {
    const hints = page.getByRole('button', { name: /^(Vereinsnews|Abwesenheiten|Einladen)/ });
    const texts = await hints.allTextContents();
    ok(
      texts.some((t) => /\d$|neu$/.test(t.trim())),
      'Schnellzugriff: Chip mit Hinweis (Zähler oder „neu“)',
    );
  } else console.log('– Schnellzugriff: Demodaten liefern keine Hinweise');
  // Umfrage in „Offen“: Antwortmöglichkeiten im Blatt von unten
  const pollCard = page
    .getByRole('button', { name: /Umfrage/ })
    .filter({ visible: true })
    .first();
  {
    await pollCard.waitFor({ timeout: 10_000 });
    await pollCard.click();
    ok(await button(page, 'Zur Umfrage').isVisible(), 'Umfrage: Blatt mit Antwortmöglichkeiten');
    await page.keyboard.press('Escape');
    await page.reload();
    await text(page, 'Schnellzugriff').waitFor({ timeout: 20_000 });
  }
  await button(page, 'Hinzufügen').click();
  await text(page, 'Schnellzugriff anpassen').waitFor();
  await page
    .getByRole('checkbox', { name: /Kontakte|Ansprechpartner/ })
    .first()
    .click()
    .catch(() => {});
  await page
    .getByRole('checkbox', { name: /Umfragen/ })
    .first()
    .click();
  await button(page, 'Speichern').click();
  await text(page, 'Schnellzugriff anpassen').waitFor({ state: 'hidden', timeout: 10_000 });
  const me = await api('/me', login.token);
  ok(
    Array.isArray(me.user.quickLinks) && me.user.quickLinks.includes('polls'),
    'Auswahl gespeichert (API)',
  );
  ok(await button(page, 'Umfragen').isVisible(), 'Gewählter Eintrag erscheint als Chip');
  await button(page, 'Hinzufügen').click();
  await button(page, 'Zurücksetzen').click();
  await text(page, 'Schnellzugriff anpassen').waitFor({ state: 'hidden', timeout: 10_000 });
  const reset = await api('/me', login.token);
  ok(reset.user.quickLinks === null, 'Zurücksetzen stellt den Standard der Rolle her');
}

// Überblick: vier Bilder in einer Seite
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const keys = ['eltern-light', 'eltern-dark', 'vorstand-light', 'vorstand-dark'];
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${keys
  .map((k) => `<img src="${img(files[k])}" style="width:300px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'neuer-look-home.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 1290, height: 1000 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'neuer-look-home.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'neuer-look-home.png')}`);

ok(
  b.errors.length === 0,
  b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
