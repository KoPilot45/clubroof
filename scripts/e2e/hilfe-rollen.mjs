/**
 * Browserprüfung: Rollen (mehrere Personen, „Alle anzeigen“, „… hinzufügen“), Hilfe & Anleitung,
 * Schriften (Open Sans für Text, Oswald für Überschriften, Kachel-Beschriftungen in Standardschrift).
 * Aufruf: pnpm browser-check scripts/e2e/hilfe-rollen.mjs [--reset]
 */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const family = (page, el) => el.evaluate((n) => getComputedStyle(n).fontFamily);

// ── Schriften ────────────────────────────────────────────────────────────────
const t = await b.session('trainer');
await t.goto('/team');
const tile = text(t.page, 'Termine', { exact: true });
await tile.waitFor({ timeout: 20_000 });
ok(
  /OpenSans/.test(await family(t.page, tile)),
  'Kachel-Beschriftung in Open Sans (Standardschrift)',
);
await t.goto('/verein');
const heading = text(t.page, 'Vereinsnews', { exact: true });
await heading.waitFor({ timeout: 20_000 });
ok(/Oswald/.test(await family(t.page, heading)), 'Zwischenüberschrift in Oswald');

// ── Hilfe ────────────────────────────────────────────────────────────────────
await t.goto('/mehr');
await text(t.page, 'Hilfe & Anleitung').click();
await text(t.page, 'Wo finde ich was?').waitFor({ timeout: 15_000 });
ok(
  await text(t.page, 'Für Trainerteams', { exact: true }).isVisible(),
  'Hilfe zeigt Abschnitt für Trainerteams',
);
ok(
  !(await text(t.page, 'Verwaltung', { exact: true })
    .isVisible()
    .catch(() => false)),
  'Trainer sieht keinen Verwaltungsabschnitt',
);
await text(t.page, 'Wo finde ich was?').click();
await text(t.page, /fünf Bereiche/).waitFor();
await t.page.getByLabel('Suchen').fill('Abwesenheit');
await text(t.page, /Ich bin im Urlaub oder verletzt/).waitFor();
ok(true, 'Suche findet „Abwesenheit“');
await b.shot(t.page, 'hilfe');

// ── Rollen (Admin) ───────────────────────────────────────────────────────────
const a = await b.session('admin');
await a.goto('/admin/roles');
await text(a.page, 'Vorstand / Vereinsleitung', { exact: true }).waitFor({ timeout: 20_000 });
ok(
  await text(a.page, 'Vorstand / Vereinsleitung hinzufügen').isVisible(),
  'Button „<Rolle> hinzufügen“ je Rolle',
);
await button(a.page, /Vereinsmitglied hinzufügen/).click();
await text(a.page, 'Person suchen').waitFor({ timeout: 15_000 });
await a.page.getByPlaceholder(/Name oder Mitgliedsnummer/).fill('Schulz');
await text(a.page, 'Petra Schulz').click();
await button(a.page, 'Hinzufügen').click();
await text(a.page, /Hinzugefügt/).waitFor({ timeout: 15_000 });
ok(true, 'Person als Vereinsmitglied hinzugefügt');
await button(a.page, 'Fertig').click();
const row = a.page.getByText('Petra Schulz').filter({ visible: true }).first();
await row.waitFor();
await b.shot(a.page, 'rolle');
// wieder entziehen (Zeile von Petra: Entziehen in derselben Karte)
await a.page
  .getByRole('button', { name: 'Entziehen' })
  .filter({ visible: true })
  .last()
  .click()
  .catch(() => {});

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
