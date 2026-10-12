/**
 * K5: Auslagenerstattung (Mitglied reicht ein, Kassenwart prüft und erstattet), Pauschalen mit Freibetrag, Zuschüsse,
 * Mannschaftszuschuss und Inventar in der Vereinskasse.
 * Aufruf: pnpm browser-check scripts/e2e/erweiterungen.mjs [--no-build|--reset]
 */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const vis = (page, re, o = {}) => page.getByText(re, o).filter({ visible: true });

// ── Auslage: Mitglied reicht ein ─────────────────────────────────────────────
const player = await b.session('spieler');
const pp = player.page;
await player.goto('/expense-claims');
await text(pp, 'Auslage einreichen', { exact: true }).first().waitFor({ timeout: 20_000 });
await pp.getByLabel('Wofür?').fill('E2E Bälle');
await pp.getByLabel('Betrag in €').fill('12,50');
await button(pp, 'Einreichen').click();
await text(pp, 'E2E Bälle', { exact: true }).waitFor({ timeout: 10_000 });
ok(
  (await vis(pp, 'Eingereicht').count()) > 0,
  'Mitglied sieht seine Auslage mit Status „Eingereicht“',
);
await pp.getByRole('radio', { name: 'Fahrtkosten' }).click();
await pp.getByLabel('Wofür?').fill('E2E Fahrt');
await pp.getByLabel('Gefahrene Kilometer').fill('40');
ok(
  (await vis(pp, /12,00\s€/).count()) > 0,
  'Fahrtkosten werden aus den Kilometern berechnet (40 km = 12,00 €)',
);

// ── Kassenwart prüft und erstattet ───────────────────────────────────────────
const kasse = await b.session('kasse');
const pk = kasse.page;
await kasse.goto('/club-cash/claims');
await text(pk, 'Offene Auslagen').waitFor({ timeout: 20_000 });
await pk.getByText('E2E Bälle', { exact: true }).waitFor({ timeout: 10_000 });
await button(pk, 'Prüfen').first().click();
await button(pk, 'Genehmigen').click();
await button(pk, 'Erstatten').first().waitFor({ timeout: 10_000 });
await button(pk, 'Erstatten').first().click();
await button(pk, 'Erstattung buchen').click();
await vis(pk, 'Erstattet', { exact: true }).first().waitFor({ timeout: 10_000 });
ok(true, 'Kassenwart genehmigt und erstattet (Buchung im Kassenbuch)');
await b.shot(pk, 'k5-auslagen', false);

// ── Pauschalen mit Freibetrag ────────────────────────────────────────────────
const coach = (await b.session('trainer')).login.me.person;
const coachName = `${coach.firstName} ${coach.lastName}`;
await kasse.goto('/club-cash/allowances');
await text(pk, 'Auszahlung erfassen').waitFor({ timeout: 20_000 });
await pk.getByLabel('Person suchen').fill(coach.lastName);
const hit = pk.getByText(coachName, { exact: true }).filter({ visible: true }).first();
await hit.waitFor({ timeout: 10_000 });
await hit.click();
await pk.getByLabel('Betrag in €', { exact: true }).fill('3000');
await button(pk, 'Auszahlung buchen').click();
await text(pk, /von 3\.300,00\s€/).waitFor({ timeout: 10_000 });
ok(true, 'Auszahlung zählt gegen den Freibetrag (3.300 € Übungsleiterpauschale)');
await pk.getByLabel('Person suchen').fill(coach.lastName);
await pk.getByText(coachName, { exact: true }).filter({ visible: true }).first().click();
await pk.getByLabel('Betrag in €', { exact: true }).fill('500');
await button(pk, 'Auszahlung buchen').click();
await text(pk, 'Freibetrag würde überschritten').waitFor({ timeout: 10_000 });
ok(true, 'Überschreitung wird nicht stillschweigend gebucht, sondern nachgefragt');
await b.shot(pk, 'k5-pauschalen', false);

// ── Zuschüsse ────────────────────────────────────────────────────────────────
await kasse.goto('/club-cash/grants');
await text(pk, 'Zuschuss anlegen').first().waitFor({ timeout: 20_000 });
await pk.getByLabel('Bezeichnung').fill('E2E Förderung');
await pk.getByLabel('Geber (z. B. Stadt, Verband)').fill('Stadt Musterstadt');
await pk.getByLabel('Betrag in €').fill('800');
await button(pk, 'Zuschuss anlegen').click();
await text(pk, 'E2E Förderung', { exact: true }).waitFor({ timeout: 10_000 });
await button(pk, 'Als beantragt markieren').click();
await button(pk, 'Bewilligt').waitFor({ timeout: 10_000 });
await button(pk, 'Bewilligt').click();
await button(pk, 'Eingang buchen').waitFor({ timeout: 10_000 });
ok(true, 'Zuschuss läuft von geplant über beantragt bis bewilligt');

// ── Inventar ─────────────────────────────────────────────────────────────────
await kasse.goto('/club-cash/inventory');
await text(pk, 'Gegenstand aufnehmen').waitFor({ timeout: 20_000 });
await pk.getByLabel('Bezeichnung').fill('E2E Hütchen');
await pk.getByLabel('Anzahl').fill('20');
await pk.getByLabel('Anschaffungswert gesamt in € (optional)').fill('40');
await button(pk, 'Aufnehmen').click();
await text(pk, '20 × E2E Hütchen').waitFor({ timeout: 10_000 });
ok(true, 'Inventar nimmt Gegenstand mit Anzahl und Wert auf');
await b.shot(pk, 'k5-inventar', false);

await b.close();
// Die 409-Antwort bei Überschreitung des Freibetrags ist beabsichtigt
const errors = b.errors.filter((e) => !e.includes('409'));
console.log(errors.length ? `Konsolenfehler:\n${errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || errors.length) process.exit(1);
