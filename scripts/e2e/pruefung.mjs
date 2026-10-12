/**
 * K4: Kassenprüfung (Stichproben, Beanstandung, Bericht) sowie Spenden mit Zuwendungsbestätigung (Freigabe der Vorlage).
 * Aufruf: pnpm browser-check scripts/e2e/pruefung.mjs [--no-build|--reset]
 */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const vis = (page, re, o = {}) => page.getByText(re, o).filter({ visible: true });

// ── Kassenprüfung ────────────────────────────────────────────────────────────
const auditor = await b.session('mitglied');
const pa = auditor.page;
await auditor.goto('/club-cash/audit');
await text(pa, 'Neue Prüfung').waitFor({ timeout: 20_000 });
await button(pa, 'Prüfung beginnen').click();
await text(pa, 'Stichproben ziehen').waitFor({ timeout: 10_000 });
ok(true, 'Prüfung begonnen, Detailseite öffnet');
await pa.getByLabel('Anzahl').fill('3');
await button(pa, 'Stichproben ziehen').click();
await pa.getByRole('button', { name: 'Prüfen', exact: true }).first().waitFor({ timeout: 10_000 });
ok(true, 'Stichproben erscheinen als offene Buchungen');
// erste beanstanden (Begründung nötig), übrige abhaken
await pa.getByRole('button', { name: 'Prüfen', exact: true }).first().click();
await pa.getByLabel('Vermerk (bei Beanstandung nötig)').fill('Beleg fehlt');
await button(pa, 'Beanstanden').click();
await text(pa, /Beanstandet/)
  .first()
  .waitFor({ timeout: 10_000 });
ok(true, 'Beanstandung mit Begründung vermerkt');
for (let i = 0; i < 5; i++) {
  const next = pa.getByRole('button', { name: 'Prüfen', exact: true }).first();
  if ((await next.count()) === 0) break;
  await next.click();
  await button(pa, 'In Ordnung').click();
  await pa.waitForTimeout(600);
}
ok(
  (await pa.getByRole('button', { name: 'Prüfen', exact: true }).count()) === 0,
  'Alle Stichproben erledigt',
);
await pa.getByLabel('Neuer Vermerk').fill('Belege sind übersichtlich abgelegt.');
await button(pa, 'Vermerk speichern').click();
await text(pa, 'Belege sind übersichtlich abgelegt.').waitFor({ timeout: 10_000 });
await pa
  .getByLabel('Ergebnis der Prüfung')
  .fill('Die Kasse wurde ordnungsgemäß geführt, eine Beanstandung ist nachzureichen.');
await button(pa, 'Prüfbericht abgeben').click();
await button(pa, 'Prüfbericht abgeben').waitFor({ state: 'detached', timeout: 10_000 });
ok(
  (await button(pa, 'Prüfbericht abgeben').count()) === 0,
  'Bericht abgegeben, nicht mehr änderbar',
);
ok(
  (await button(pa, 'Als PDF öffnen').count()) > 0 &&
    (await button(pa, 'Als CSV für Excel').count()) > 0,
  'Prüfbericht als PDF und CSV',
);
await b.shot(pa, 'k4-pruefung', false);

// ── Spenden ──────────────────────────────────────────────────────────────────
const kasse = await b.session('kasse');
const pk = kasse.page;
await kasse.goto('/club-cash/donations');
await text(pk, 'Spende erfassen', { exact: true }).waitFor({ timeout: 20_000 });
ok(
  (await vis(pk, /noch nicht freigegeben/).count()) > 0,
  'Ohne Freigabe der Vorlage: Hinweis, dass keine Bestätigungen möglich sind',
);
await pk.getByLabel('Name', { exact: true }).fill('E2E Spender');
await pk.getByLabel('Anschrift (für die Bestätigung)').fill('Hauptstraße 1, 12345 Musterstadt');
await pk.getByLabel('Betrag in €').fill('50');
await button(pk, 'Spende buchen').click();
await text(pk, 'E2E Spender', { exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Spende erscheint in der Liste');
ok(
  await button(pk, 'Bestätigung ausstellen').first().isDisabled(),
  'Bestätigung ausstellen ist ohne Freigabe gesperrt',
);

const admin = await b.session('admin');
const pad = admin.page;
await admin.goto('/club-cash/tax');
await text(pad, 'Angaben zur Steuerbegünstigung').waitFor({ timeout: 20_000 });
await pad.getByLabel('Finanzamt').fill('Finanzamt Musterstadt');
await pad.getByLabel('Steuernummer').fill('123/456/78901');
await pad.getByLabel('Zeitraum (z. B. 2022 bis 2024)').fill('2022 bis 2024');
await pad.getByLabel('Begünstigter Zweck').fill('Förderung des Sports');
await button(pad, 'Speichern').click();
await text(pad, 'Vorlage freigeben', { exact: true }).first().waitFor({ timeout: 10_000 });
await pad.getByLabel(/Geprüft von/).fill('Steuerberatung Muster');
await button(pad, 'Vorlage freigeben').click();
await text(pad, /Vorlage freigegeben/).waitFor({ timeout: 10_000 });
ok(true, 'Administration trägt Steuerdaten ein und gibt die Vorlage frei');

await kasse.goto('/club-cash/donations');
await text(pk, 'E2E Spender', { exact: true }).waitFor({ timeout: 20_000 });
await button(pk, 'Bestätigung ausstellen').first().click();
await button(pk, 'Bestätigung öffnen').first().waitFor({ timeout: 10_000 });
ok(true, 'Nach der Freigabe lässt sich die Bestätigung ausstellen und öffnen');
await b.shot(pk, 'k4-spenden', false);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
