/**
 * Paket L, Schritt 7: Zustände im neuen Look – Laden, Offline, Leer, Fehler, Bestätigungsblatt.
 * Aufruf: pnpm browser-check scripts/e2e/neuer-look-zustaende.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { API, api, button, launch, text } from '../lib/e2e.mjs';

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

// Laden: /home antwortet verzögert → Platzhalter sichtbar
{
  const { page, goto } = await b.session('eltern');
  await page.route(`${API}/home`, async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await goto('/');
  await page.getByRole('progressbar').first().waitFor({ timeout: 10_000 });
  ok(true, 'Laden: Platzhalter erscheinen');
  files.laden = await b.shot(page, 'nlz-laden', false);
  await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
  ok(true, 'Laden: Inhalt ersetzt die Platzhalter');
}

// Fehler: /home schlägt fehl → Karte mit „Erneut versuchen“
{
  const { page, goto } = await b.session('eltern');
  let fail = true;
  await page.route(`${API}/home`, (route) =>
    fail
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"message":"Serverfehler"}',
        })
      : route.continue(),
  );
  await goto('/');
  await text(page, 'Das hat nicht geklappt').waitFor({ timeout: 40_000 });
  ok(await button(page, 'Erneut versuchen').isVisible(), 'Fehler: Karte mit „Erneut versuchen“');
  files.fehler = await b.shot(page, 'nlz-fehler', false);
  fail = false;
  await button(page, 'Erneut versuchen').click();
  await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
  ok(true, 'Fehler: erneuter Versuch lädt die Seite');
}

// Leer: Vereinsmitglied ohne Mannschaft
{
  const { page, login, goto } = await b.session('mitglied');
  await setMode(login, 'light');
  await goto('/');
  await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
  const noTeam = login.me.teams.length === 0;
  ok(
    noTeam ? await text(page, 'Noch keine Mannschaft').isVisible() : true,
    noTeam
      ? 'Leer: „Noch keine Mannschaft“ mit Handlung'
      : 'Leer: (Demo-Mitglied hat eine Mannschaft)',
  );
  files.leer = await b.shot(page, 'nlz-leer', false);
}

// Offline: Hinweis mit Stand, Wiederverbinden
{
  const { page, goto } = await b.session('eltern');
  await goto('/');
  await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await text(page, 'Du bist offline').waitFor({ timeout: 10_000 });
  ok(
    await text(page, /Angezeigt wird der Stand von \d{2}:\d{2} Uhr/).isVisible(),
    'Offline: Hinweis mit Stand',
  );
  ok(
    await text(page, 'Deine Woche').isVisible(),
    'Offline: zwischengespeicherter Inhalt bleibt sichtbar',
  );
  files.offline = await b.shot(page, 'nlz-offline', false);
  await page.context().setOffline(false);
  await text(page, 'Du bist offline').waitFor({ state: 'hidden', timeout: 10_000 });
  ok(true, 'Offline: der Hinweis verschwindet, sobald die Verbindung wieder da ist');
}

// Bestätigungsblatt: Termin absagen (Trainer)
{
  const { page, login, goto } = await b.session('trainer');
  const b1 = login.me.teams.find((t) => t.badge === 'B1');
  const overview = await api(`/teams/${b1.id}`, login.token);
  const event = overview.trainingWeek.find((e) => e.status === 'scheduled') ?? overview.nextEvent;
  await goto(`/events/${event.id}`);
  await button(page, 'Termin absagen').waitFor({ timeout: 20_000 });
  await button(page, 'Termin absagen').click();
  await text(page, 'Termin absagen?').waitFor({ timeout: 5_000 });
  ok(
    await text(page, /Die Mannschaft wird sofort benachrichtigt/).isVisible(),
    'Bestätigung: Blatt „Termin absagen?“ mit Hinweis',
  );
  ok(
    await button(page, 'Absagen und informieren').isDisabled(),
    'Bestätigung: Absagen erst mit Grund möglich',
  );
  await button(page, 'Abbrechen').click();
}

const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const keys = ['laden', 'offline', 'leer', 'fehler'];
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${keys
  .map((k) => `<img src="${img(files[k])}" style="width:300px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'neuer-look-zustaende.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 1290, height: 900 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'neuer-look-zustaende.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'neuer-look-zustaende.png')}`);

// Konsolenfehler: die absichtlich erzeugten Fehler (500, Netzwerk) zählen nicht
const real = b.errors.filter(
  (e) => !/500|Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e),
);
ok(
  real.length === 0,
  real.length ? `Konsolenfehler:\n${real.join('\n')}` : 'keine unerwarteten Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
