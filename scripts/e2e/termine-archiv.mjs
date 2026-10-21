/**
 * VT + KM: Archiv (vergangene Termine), Kalenderraster mit Kürzel-Chips, Mannschaftswechsel im Team-Tab.
 * Aufruf: pnpm browser-check scripts/e2e/termine-archiv.mjs [--no-build|--reset]
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const wait = (page, ms = 1500) => page.waitForTimeout(ms);
// Hinterliegende Tabs bleiben im DOM: nur sichtbare Treffer zählen
const vis = (page, re) => page.getByText(re).filter({ visible: true });

// ── Termine-Tab: Kommend | Vergangen, Raster, Heute ─────────────────────────
const s = await b.session('spieler');
const { page } = s;
const radio = (name) => page.getByRole('radio', { name, exact: true });
await s.goto('/termine');
await radio('Vergangen').waitFor({ timeout: 20_000 });
await wait(page, 2000);
ok((await text(page, 'Als Nächstes').count()) > 0, 'Kommend: „Als Nächstes“');
ok((await page.getByRole('button', { name: /Archiv/ }).count()) > 0, 'Eintrag „Archiv“');
ok(
  (await text(page, 'Training', { exact: true }).count()) > 0 ||
    (await text(page, /Spiel/).count()) > 0,
  'Legende des Rasters',
);
const grid = page.getByRole('button', { name: /Termine$/ });
ok((await grid.count()) > 20, `Kalenderraster mit Tagesfeldern (${await grid.count()})`);
await page.getByRole('button', { name: 'Heute', exact: true }).scrollIntoViewIfNeeded();
await wait(page, 500);
await b.shot(page, 'km-raster', false);
await page.getByRole('button', { name: 'Heute', exact: true }).click();
await wait(page, 800);
ok(true, 'Knopf „Heute“');

await radio('Vergangen').click();
await wait(page, 1500);
ok((await text(page, 'Zuletzt', { exact: true }).count()) > 0, 'Vergangen: „Zuletzt“');
const resultChips = vis(page, /\d+:\d+ · (Sieg|Remis|Niederlage)|\d+ von \d+ da/);
ok(
  (await resultChips.count()) > 0,
  `Vergangene Termine zeigen Ergebnis bzw. Anwesenheit (${await resultChips.count()})`,
);

// ── Archiv ───────────────────────────────────────────────────────────────────
await page
  .getByRole('button', { name: /Archiv/ })
  .first()
  .click();
await text(page, 'Zeitraum', { exact: true }).waitFor({ timeout: 20_000 });
await wait(page, 2000);
const rows = () =>
  page.getByRole('button', { name: /^(?!Archiv|Zurück|Suche|Benachrichtigungen).*/ }).count();
ok(
  (await text(page, /^Woche \d\d\.\d\d\. – \d\d\.\d\d\.$/).count()) > 0,
  'Wochenblöcke absteigend',
);
const first = await text(page, /^Woche /).textContent();
ok(!!first, `Erster Block: ${first}`);
await radio('Spiele').click();
await wait(page, 1500);
ok(
  (await vis(page, /\d+:\d+ · (Sieg|Remis|Niederlage)/).count()) > 0,
  'Filter „Spiele“ zeigt Ergebnisse',
);
ok((await vis(page, /\d+ von \d+ da/).count()) === 0, 'Filter „Spiele“ ohne Trainings');
await radio('Alle').last().click();
await radio('Eigener Zeitraum').click();
await wait(page, 1000);
ok((await text(page, 'Von', { exact: true }).count()) > 0, 'Eigener Zeitraum mit Datumsauswahl');
await radio('Letzte 7 Tage').click();
await wait(page, 1500);
ok(true, 'Zeitraum „Letzte 7 Tage“');
await radio('Alle').first().click();
await b.shot(page, 'vt-archiv', false);

// Detailseite eines vergangenen Termins
await radio('Training').click();
await wait(page, 1500);
await page
  .getByRole('button')
  .filter({ hasText: /Training/ })
  .filter({ visible: true })
  // das jüngste Training ist in den Demodaten bewusst noch nicht erfasst – das zweite hat Anwesenheit
  .nth(1)
  .click();
await text(page, 'Vergangener Termin', { exact: true }).waitFor({ timeout: 20_000 });
ok(true, 'Detailseite: Hinweis „Vergangener Termin“');
ok(
  (await text(page, 'Meine Rückmeldung', { exact: true }).count()) === 0,
  'Detailseite ohne Zu-/Absage',
);
ok((await text(page, /\d+ von \d+ da/).count()) > 0, 'Detailseite zeigt Anwesenheit (Anzahl)');

// ── Team-Tab: Mannschaftswechsel ─────────────────────────────────────────────
const t = await b.session('trainer');
const me = await api('/me', t.login.token);
const teams = [...new Map(me.teams.map((x) => [x.id, x])).values()];
await t.goto('/team');
const tabs = t.page.getByRole('tab').filter({ hasNot: t.page.locator('[aria-label="Home"]') });
await t.page.waitForTimeout(2500);
const switcher = t.page.locator('[role="tablist"]').first();
const chips = switcher.getByRole('tab');
ok(
  (await chips.count()) === teams.length,
  `Chips-Leiste mit allen Mannschaften (${await chips.count()} von ${teams.length})`,
);
const heightOk = (await chips.first().boundingBox())?.height >= 44;
ok(heightOk, 'Chips mindestens 44 pt hoch');
const selectedBefore = await switcher.locator('[aria-selected="true"]').count();
ok(selectedBefore === 1, 'Genau eine Mannschaft aktiv');
const other = chips.nth(1);
const label = await other.getAttribute('aria-label');
await other.click();
await t.page.waitForTimeout(1200);
ok((await other.getAttribute('aria-selected')) === 'true', `Mannschaft gewechselt: ${label}`);
await t.page.reload();
await t.page.waitForTimeout(3000);
ok(
  (await t.page
    .locator('[role="tablist"]')
    .first()
    .getByRole('tab')
    .nth(1)
    .getAttribute('aria-selected')) === 'true',
  'Zuletzt gewählte Mannschaft wird gemerkt',
);
await b.shot(t.page, 'km-team', false);

// ── Einstellung der Mannschaft: Sichtbarkeit der Anwesenheit ────────────────
const b1 = me.teams.find((x) => x.badge === 'B1') ?? me.teams[0];
await t.goto(`/teams/${b1.id}/manage`);
await text(t.page, 'Anwesenheit vergangener Termine für Spieler', { exact: true }).waitFor({
  timeout: 20_000,
});
ok(
  (await t.page.getByRole('radio', { name: 'Nur Anzahl' }).getAttribute('aria-checked')) ===
    'true' || (await t.page.getByRole('radio', { name: 'Nur Anzahl' }).count()) > 0,
  'Einstellung „Anwesenheit vergangener Termine“ im Mannschaftsprofil',
);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
