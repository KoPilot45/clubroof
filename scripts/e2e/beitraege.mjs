/** Vereinskasse: Beiträge (K2): Übersicht, Rückstände, Zahlung buchen, Erinnerung. */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

const { page, goto, login } = await b.session('kasse');
await goto('/club-cash/fees');
await text(page, 'Offene Beiträge').waitFor({ timeout: 20_000 });
ok(
  await text(page, /davon überfällig/).isVisible(),
  'Übersicht zeigt offene und überfällige Beträge',
);

// U09: Filter dauerhaft sichtbar; Überschrift, Trefferzahl und Leerzustand nennen denselben Umfang
const counts = {};
for (const status of ['open', 'overdue', 'paid', 'cancelled']) {
  counts[status] = (await api(`/club-cash/fees?status=${status}`, login.token)).dues.length;
}
const titles = {
  open: 'Offene Forderungen',
  overdue: 'Überfällige Forderungen',
  paid: 'Bezahlte Forderungen',
  cancelled: 'Stornierte Forderungen',
};
const chips = { open: 'Offen', overdue: 'Überfällig', paid: 'Bezahlt', cancelled: 'Storniert' };
ok(
  counts.overdue > 0 && counts.open >= counts.overdue,
  'Testdaten: überfällige und offene Forderungen vorhanden',
);
for (const status of ['overdue', 'open', 'paid', 'cancelled']) {
  await text(page, chips[status], { exact: true }).click();
  const heading = text(page, `${titles[status]} (${counts[status]})`, { exact: true });
  await heading.waitFor({ timeout: 10_000 });
  ok(true, `${chips[status]}: Überschrift mit Trefferzahl ${counts[status]}`);
}
await text(page, 'Überfällig', { exact: true }).click();
await text(page, `Überfällige Forderungen (${counts.overdue})`, { exact: true }).waitFor();

// Erste überfällige Forderung öffnen und eine Zahlung buchen
const first = page.getByText(/fällig \d{2}\.\d{2}\.\d{4}/).first();
await first.click();
await text(page, 'Zahlung buchen', { exact: true }).waitFor();
await page.getByText('Zahlung buchen', { exact: true }).click();
await text(page, 'Zahlung gebucht.').waitFor({ timeout: 10_000 });
ok(true, 'Zahlung gebucht, Meldung erscheint');

// Erinnerung für die nächste überfällige Forderung
await page
  .getByText(/fällig \d{2}\.\d{2}\.\d{4}/)
  .first()
  .click();
await page.getByText(/Erinnerung Stufe \d senden/).click();
await text(page, /Erinnerung verschickt|vermerkt/).waitFor({ timeout: 10_000 });
ok(true, 'Erinnerung ausgelöst');

await goto('/club-cash/fee-setup');
await text(page, 'Beitragsarten', { exact: true }).waitFor({ timeout: 15_000 });
ok(await text(page, 'Erwachsene').isVisible(), 'Beitragsarten und Zuordnungen sichtbar');

await goto('/club-cash/fee-import');
await text(page, 'CSV-Datei wählen').waitFor({ timeout: 15_000 });
ok(true, 'Import-Bildschirm öffnet');

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
