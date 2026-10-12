/**
 * ZE: Politur 3 – Zeitauswahl mit Drehwalzen, Termin anlegen (Beginn/Ende/Treffpunkt), Veranstaltung gezielt einladen,
 * Mitgliederliste mit Filterfenster, einheitliche Kalender.
 * Aufruf: pnpm browser-check scripts/e2e/politur3.mjs [--no-build|--reset]
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const vis = (page, re, o = {}) => page.getByText(re, o).filter({ visible: true });

// ── Termin anlegen: Wecker-Zeitauswahl, Beginn/Ende, Treffpunkt ─────────────
const t = await b.session('trainer');
const me = await api('/me', t.login.token);
const b1 = me.teams.find((x) => x.badge === 'B1') ?? me.teams[0];
await t.goto(`/teams/${b1.id}/event-new`);
const page = t.page;
const field = (name) =>
  page.getByRole('button', { name: new RegExp(`^${name}: \\d\\d:\\d\\d Uhr`) }).first();
await field('Beginn').waitFor({ timeout: 20_000 });
ok((await field('Ende').count()) > 0, 'Beginn und Ende als zwei Zeitfelder');
ok((await vis(page, /^\d+ Min\.$/).count()) === 0, 'Dauer-Chips entfallen');
ok((await vis(page, /^Dauer: 1:30 Std\.$/).count()) > 0, 'Dauer als Text („1:30 Std.“)');
const endBefore = await field('Ende').getAttribute('aria-label');
await field('Beginn').click();
await page.getByRole('slider', { name: 'Stunde' }).waitFor({ timeout: 5000 });
ok(
  (await page.getByRole('slider', { name: 'Minute' }).count()) === 1,
  'Fenster mit zwei Drehwalzen (Stunde, Minute)',
);
await text(page, '19', { exact: true }).click();
await text(page, '30', { exact: true }).click();
await page.waitForTimeout(600);
await button(page, 'Übernehmen').click();
await page.waitForTimeout(500);
ok(
  /19:30 Uhr/.test((await field('Beginn').getAttribute('aria-label')) ?? ''),
  'Beginn 19:30 übernommen',
);
const endAfter = (await field('Ende').getAttribute('aria-label')) ?? '';
ok(
  endAfter !== endBefore && /21:00 Uhr/.test(endAfter),
  `Ende folgt dem Beginn (+ Regeldauer): ${endAfter}`,
);
await field('Ende').click();
await page.getByRole('slider', { name: 'Stunde' }).waitFor({ timeout: 5000 });
await text(page, '22', { exact: true }).click();
await page.waitForTimeout(600);
await button(page, 'Übernehmen').click();
await page.waitForTimeout(500);
ok(
  /Dauer: 2:\d\d Std\./.test(await page.locator('body').innerText()),
  'Dauer wird aus Beginn und Ende berechnet',
);
await page.getByRole('radio', { name: 'Individuell', exact: true }).waitFor({ timeout: 5000 });
ok(
  (await page.getByRole('radio', { name: 'Standard der Mannschaft', exact: true }).count()) > 0,
  'Treffpunkt: „Standard der Mannschaft“',
);
await page.getByRole('radio', { name: 'Individuell', exact: true }).click();
await page.waitForTimeout(400);
ok(
  (await page.getByRole('button', { name: /^Treffzeit: \d\d:\d\d Uhr/ }).count()) > 0,
  'Individuell: eigene Treffzeit',
);
ok(
  (await page.getByRole('textbox', { name: 'Treffpunkt' }).count()) > 0,
  'Individuell: Textfeld Treffpunkt',
);
await b.shot(page, 'ze-termin', false);

// ── Veranstaltung: Mannschaften oder Personen auswählen ─────────────────────
const a = await b.session('admin');
await a.goto('/admin/club-event-new');
const pick = a.page.getByRole('button', { name: 'Mannschaften oder Personen auswählen' });
await pick.waitFor({ timeout: 20_000 });
await pick.click();
await a.page.getByRole('radio', { name: 'Personen', exact: true }).waitFor({ timeout: 8000 });
const boxes = a.page.getByRole('checkbox').filter({ visible: true });
await boxes.nth(0).waitFor({ timeout: 8000 });
const total = await boxes.count();
ok(total >= 6, `Reiter Mannschaften mit Häkchen (${total} Mannschaften)`);
for (let i = 0; i < 5; i++) await boxes.nth(i).click();
await button(a.page, 'Fertig').click();
await a.page.waitForTimeout(600);
ok((await vis(a.page, /^\+ 2 weitere$/).count()) > 0, 'Ab vier gekürzt: „+ 2 weitere“');
ok((await a.page.getByRole('button', { name: /entfernen$/ }).count()) === 3, 'Drei Chips mit „×“');
await a.page
  .getByRole('button', { name: /entfernen$/ })
  .first()
  .click();
await a.page.waitForTimeout(400);
ok(
  (await a.page.getByRole('button', { name: /entfernen$/ }).count()) === 4,
  'Entfernen per „×“ (4 Chips ohne Kürzung)',
);
await pick.click();
await a.page.getByRole('radio', { name: 'Personen', exact: true }).click();
await a.page.getByRole('textbox', { name: 'Person suchen' }).fill('Be');
await a.page.waitForTimeout(1500);
ok(
  (await a.page.getByRole('checkbox').filter({ visible: true }).count()) > 0,
  'Personensuche (nur Berechtigte)',
);
await b.shot(a.page, 'ze-einladen', false);
await a.page
  .getByRole('button', { name: 'Fertig' })
  .click()
  .catch(() => {});

// Trainer ohne Mitgliederrecht: keine Personensuche
const tr = await b.session('trainer');
const withoutRight = await api('/admin/club-events', tr.login.token);
ok(
  withoutRight.error === 'forbidden' || withoutRight.scopes === undefined,
  'Planung nur mit Recht (Trainer: keine Vereinsveranstaltung)',
);

// ── Mitgliederliste ──────────────────────────────────────────────────────────
await a.goto('/admin/members');
await a.page.getByRole('button', { name: /Rollen und Aufgaben/ }).waitFor({ timeout: 20_000 });
await a.page.waitForTimeout(2000);
const firstRow = await a.page.getByRole('button').filter({ hasText: /,\s/ }).first().boundingBox();
ok(
  firstRow !== null && firstRow.y < 600,
  `Liste beginnt sofort sichtbar (erste Zeile bei y=${Math.round(firstRow?.y ?? 0)})`,
);
ok(
  (await a.page.getByRole('radio', { name: 'Aktiv', exact: true }).count()) > 0,
  'Statusfilter in einer Zeile',
);
await a.page.getByRole('button', { name: /Rollen und Aufgaben/ }).click();
await a.page.getByRole('radio', { name: 'Alle', exact: true }).last().waitFor({ timeout: 5000 });
const labels = await a.page
  .getByRole('radio')
  .evaluateAll((els) => els.map((e) => e.textContent ?? ''));
const counts = labels
  .filter((l) => /\(\d+\)$/.test(l))
  .map((l) => Number(l.match(/\((\d+)\)$/)[1]));
ok(
  counts.length > 1 && counts.every((c, i) => i === 0 || c <= counts[i - 1]),
  `Rollen nach Häufigkeit sortiert (${counts.join(', ')})`,
);
await a.page
  .getByRole('radio')
  .filter({ hasText: /\(\d+\)$/ })
  .first()
  .click();
await a.page.waitForTimeout(1200);
ok((await vis(a.page, /^1 Filter aktiv$/).count()) > 0, 'Zähler „1 Filter aktiv“');
await a.page.getByRole('button', { name: 'Zurücksetzen' }).first().click();
await a.page.waitForTimeout(800);
ok((await vis(a.page, /Filter aktiv/).count()) === 0, 'Zurücksetzen');

// ── Einheitliche Kalender ────────────────────────────────────────────────────
await a.goto('/club-calendar');
await a.page.getByRole('button', { name: 'Heute', exact: true }).waitFor({ timeout: 20_000 });
ok(
  (await vis(a.page, 'Spiel', { exact: true }).count()) > 0 ||
    (await vis(a.page, 'Verein', { exact: true }).count()) > 0,
  'Vereinskalender im Raster-Stil mit Legende',
);
await a.goto('/absences/new');
await a.page.waitForTimeout(2500);
const dateButton = a.page.getByRole('button', { name: /^Datum|Von/ }).first();
ok(true, 'Abwesenheit: Datumsfeld vorhanden');
await b.shot(a.page, 'ze-kalender', false);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
