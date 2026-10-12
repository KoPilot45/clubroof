/**
 * K3: Haushaltsplan mit Soll-Ist, Rücklagen und Jahresabschluss in der Vereinskasse.
 * Aufruf: pnpm browser-check scripts/e2e/planung.mjs [--no-build|--reset]
 */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const vis = (page, re, o = {}) => page.getByText(re, o).filter({ visible: true });

const s = await b.session('kasse');
const page = s.page;

// ── Haushaltsplan ────────────────────────────────────────────────────────────
await s.goto('/club-cash/budget?mode=plan');
await text(page, 'Planzeile hinzufügen').waitFor({ timeout: 20_000 });
ok(
  (await vis(page, 'Noch keine Planzeile für Ausgaben.').count()) > 0,
  'Leerer Plan zeigt Hinweis',
);
await page.getByRole('radio', { name: /^Versicherungen/ }).click();
await page.getByLabel('Planbetrag in €').last().fill('1000');
await button(page, 'Zeile anlegen').click();
await text(page, /Ist 0,00\s€ von 1\.000,00\s€ geplant/).waitFor({ timeout: 10_000 });
ok(true, 'Planzeile erscheint mit Soll-Ist und Fortschrittsbalken');
ok((await page.getByRole('progressbar').count()) > 0, 'Fortschrittsbalken vorhanden');
ok((await vis(page, 'im Plan').count()) > 0, 'Status steht als Text („im Plan“)');
await b.shot(page, 'k3-haushalt', false);
await button(page, 'Planbetrag ändern').click();
await button(page, 'Zeile entfernen').click();
await text(page, 'Noch keine Planzeile für Ausgaben.').waitFor({ timeout: 10_000 });
ok(true, 'Planzeile entfernt');

// ── Rücklagen ────────────────────────────────────────────────────────────────
await s.goto('/club-cash/reserves');
await text(page, 'Gebundene Rücklagen').waitFor({ timeout: 20_000 });
await page.getByLabel('Name', { exact: true }).fill('E2E-Rücklage');
await button(page, 'Rücklage anlegen').click();
await text(page, 'E2E-Rücklage', { exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Rücklage angelegt');
await text(page, 'E2E-Rücklage', { exact: true }).click();
await page.getByLabel('Betrag in €', { exact: true }).fill('150');
await button(page, 'Zuführen').click();
await text(page, /gebunden 150,00\s€/).waitFor({ timeout: 10_000 });
ok(true, 'Zuführung bindet Kassenbestand');
await page.getByLabel('Betrag in €', { exact: true }).fill('150');
await button(page, 'Entnehmen').click();
await page.waitForTimeout(800);
await button(page, 'Rücklage auflösen').click();
await page.waitForTimeout(800);
ok((await vis(page, 'E2E-Rücklage', { exact: true }).count()) === 0, 'Rücklage aufgelöst');
await b.shot(page, 'k3-ruecklagen', false);

// ── Jahresabschluss ──────────────────────────────────────────────────────────
await s.goto('/club-cash/closing');
await text(page, /Jahresergebnis/).waitFor({ timeout: 20_000 });
for (const g of [
  'Ideeller Bereich',
  'Vermögensverwaltung',
  'Zweckbetrieb',
  'Wirtschaftlicher Geschäftsbetrieb',
])
  ok((await vis(page, g, { exact: true }).count()) > 0, `Abschluss: ${g}`);
ok(
  (await button(page, 'Als PDF öffnen').count()) > 0 &&
    (await button(page, 'Als CSV für Excel').count()) > 0,
  'Ausgabe als PDF und CSV',
);
ok((await vis(page, /Entwurf/).count()) > 0, 'Offenes Jahr als Entwurf gekennzeichnet');
ok(
  (await vis(page, /erst nach seinem Ende abgeschlossen/).count()) > 0,
  'Laufendes Jahr lässt sich noch nicht abschließen',
);
await page.getByRole('radio', { name: '2025', exact: true }).click();
await button(page, 'Abschließen').waitFor({ timeout: 10_000 });
ok(true, 'Kassenwart kann das vergangene Jahr abschließen');
await b.shot(page, 'k3-abschluss', false);

// ── Prüfer ändert nichts ─────────────────────────────────────────────────────
const auditor = await b.session('mitglied');
await auditor.goto('/club-cash/budget?mode=plan');
await text(auditor.page, 'Ausgaben', { exact: true }).waitFor({ timeout: 20_000 });
ok(
  (await vis(auditor.page, 'Planzeile hinzufügen').count()) === 0,
  'Prüfer sieht keine Planzeilen-Eingabe',
);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
