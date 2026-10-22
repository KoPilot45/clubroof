/**
 * K6: Abteilungen und Kassen – Kassen anlegen und Abteilungen zuordnen, Kassenfrage nach neuer Abteilung,
 * Umschalter „Alle | Kasse“ in der Vereinskasse, Kassenübersicht für den Vorstand statt Kassenbereich.
 * Aufruf: pnpm browser-check scripts/e2e/kassen.mjs [--no-build|--reset]
 */
import { api, button, confirmDialog, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const vis = (page, re, o = {}) => page.getByText(re, o).filter({ visible: true });

const admin = await b.session('admin');
const page = admin.page;

// ── Kassen (Admin → Verein → Struktur → Kassen) ──────────────────────────────
await admin.goto('/admin/funds');
await text(page, 'Kasse anlegen', { exact: true }).waitFor({ timeout: 20_000 });
ok((await vis(page, 'Hauptkasse').count()) > 0, 'Hauptkasse ist vorhanden');
await page.getByLabel('Name', { exact: true }).fill('E2E-Kasse');
await page.getByRole('radio', { name: 'Jugend', exact: true }).first().click();
await button(page, 'Kasse anlegen').click();
await text(page, 'E2E-Kasse', { exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Neue Kasse erscheint in der Liste');
ok(
  (await vis(page, /Jugend · 0 Konten/).count()) > 0,
  'Kasse ist der Abteilung „Jugend“ zugeordnet',
);

// ── Kassenfrage nach neuer Abteilung ─────────────────────────────────────────
await admin.goto('/admin/departments');
await text(page, 'Abteilung hinzufügen').waitFor({ timeout: 20_000 });
await page.getByLabel('Name', { exact: true }).fill('E2E-Abteilung');
await button(page, 'Abteilung anlegen').click();
await text(page, /Soll E2E-Abteilung eine eigene Kasse bekommen/).waitFor({ timeout: 10_000 });
ok(true, 'Nach dem Anlegen fragt ein Hinweis nach einer eigenen Kasse');
ok(
  (await button(page, 'Bestehender Kasse zuordnen').count()) > 0 &&
    (await button(page, 'Später entscheiden').count()) > 0,
  'Drei Wahlmöglichkeiten (eigene, bestehende, später)',
);
await button(page, 'Später entscheiden').click();
ok(
  (await vis(page, /E2E-Abteilung/).count()) > 0,
  'Abteilung bleibt; bis zur Entscheidung läuft sie über die Hauptkasse',
);
await page.getByRole('button', { name: 'E2E-Abteilung löschen' }).click();
await confirmDialog(page);
await page.waitForTimeout(800);
ok(
  (await vis(page, 'E2E-Abteilung', { exact: true }).count()) === 0,
  'Aufräumen: Abteilung gelöscht',
);
await b.shot(page, 'k6-abteilungen', false);

// ── Umschalter in der Vereinskasse ───────────────────────────────────────────
const kasse = await b.session('kasse');
await kasse.goto('/club-cash');
await text(kasse.page, 'Gesamtbestand aller Konten').waitFor({ timeout: 20_000 });
const chip = (name) => kasse.page.getByRole('radio', { name, exact: true });
ok(
  (await chip('Alle').count()) > 0 && (await chip('E2E-Kasse').count()) > 0,
  'Umschalter „Alle | Kasse“',
);
await chip('E2E-Kasse').click();
await text(kasse.page, 'Bestand der Kasse E2E-Kasse').waitFor({ timeout: 10_000 });
ok(true, 'Auswahl wirkt auf den Kassenstand');
await b.shot(kasse.page, 'k6-umschalter', false);

// ── Vorstand: Kassenübersicht statt Kassenbereich ────────────────────────────
await api('/club-cash/visibility', admin.login.token, {
  method: 'PUT',
  body: JSON.stringify({ visibility: 'board_reports' }),
});
const board = await b.session('vorstand');
await board.goto('/mehr');
await text(board.page, 'Hilfe & Anleitung').waitFor({ timeout: 20_000 });
await board.page.waitForTimeout(1200);
ok(
  (await board.page.getByRole('button', { name: 'Vereinskasse' }).count()) === 0,
  'Vorstand: kein Kassenknopf in „Mehr“',
);
await board.goto('/verein');
await text(board.page, 'Kassenübersicht', { exact: true }).waitFor({ timeout: 20_000 });
await text(board.page, 'Kassenübersicht', { exact: true }).click();
await text(board.page, 'Kassenstand gesamt').waitFor({ timeout: 10_000 });
ok(
  (await vis(board.page, /Nur zur Ansicht/).count()) > 0 &&
    (await button(board.page, /buchen|Einnahme|Ausgabe/i).count()) === 0,
  'Kassenübersicht: reine Anzeige ohne Funktionen',
);
await b.shot(board.page, 'k6-kassenuebersicht', false);
await api('/club-cash/visibility', admin.login.token, {
  method: 'PUT',
  body: JSON.stringify({ visibility: 'treasury' }),
});

// Aufräumen: die Test-Kasse stilllegen
const cash = await api('/club-cash', admin.login.token);
const e2e = cash.funds.find((f) => f.name === 'E2E-Kasse');
if (e2e)
  await api(`/club-cash/funds/${e2e.id}`, admin.login.token, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
