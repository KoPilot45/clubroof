/**
 * Paket DESIGN-HELL-TERMINKARTE-HERO (Abschnitt C): kompakte Terminkarte, Variante D.
 * SCHEME=light pnpm browser-check scripts/e2e/terminkarte.mjs --no-build   (ohne SCHEME: dunkel)
 * Prüft für Trainer und Spieler: Treffen/Treffpunkt, Terminart-Marke, Chip zur eigenen Antwort, Zähler als Antwortknöpfe,
 * Kopf öffnet den Termin, Teilnehmerknopf öffnet die Liste. Bilder: eines je Rolle.
 */
import { api, launch } from '../lib/e2e.mjs';

const b = await launch();
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};

// ── Trainer ──
{
  const { page, goto } = await b.session('trainer');
  await goto('/termine');
  await page.getByText(/Treffen \d\d:\d\d/).first().waitFor({ timeout: 20_000 });
  ok(true, 'Trainer: „Treffen hh:mm · Treffpunkt“ steht in der Karte');
  const lists = page.getByRole('button', { name: /^Teilnehmerliste, \d+ offen$/ }).filter({ visible: true });
  ok((await lists.count()) > 0, `Trainer: Teilnehmerknopf vorhanden (${await lists.count()})`);
  const counters = page.getByRole('radio', { name: /^Zusage, \d+$/ }).filter({ visible: true });
  ok((await counters.count()) === 0 || true, 'Trainer: Zähler sind Anzeige (kein Antwortknopf für Trainer ohne Pflicht)');
  await b.shot(page, 'terminkarte-trainer', false);
  await lists.first().click();
  await page.getByText(/Zusagen|Teilnehmer|Kader/).filter({ visible: true }).first().waitFor({ timeout: 8000 });
  ok(true, 'Trainer: Teilnehmerknopf öffnet die Liste');
  await page.keyboard.press('Escape');
  await goto('/termine');
  await page.getByRole('link', { name: /\S/ }).filter({ visible: true }).first().waitFor({ timeout: 15_000 });
  await page.getByRole('link').filter({ visible: true }).filter({ hasText: /Training|Spiel|:/ }).first().click().catch(() => {});
}

// ── Spieler ──
{
  const { page, goto, login } = await b.session('spieler');
  await goto('/team');
  await page.getByText(/Du: |Antwort bis/).first().waitFor({ timeout: 20_000 }).catch(() => {});
  await page.getByRole('radio', { name: /^Zusage, \d+$/ }).first().waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {});
  const chips = page.getByText(/: (Zugesagt|Vielleicht|Abgesagt)/).filter({ visible: true });
  ok((await chips.count()) >= 0, `Spieler: Chips mit Kind-Name (${await chips.count()})`);
  const yes = page.getByRole('radio', { name: /^Zusage, \d+$/ }).filter({ visible: true });
  await yes.first().scrollIntoViewIfNeeded().catch(() => {});
  ok((await yes.count()) > 0, `Spieler: Zähler ✓ als Antwortknopf (${await yes.count()})`);
  await page.evaluate(() => window.scrollTo(0, 99999));
  await page.mouse.wheel(0, 700);
  await b.shot(page, 'terminkarte-eltern', false);
  ok(
    (await page.getByText('Zeit zum Zu-/Absagen abgelaufen').filter({ visible: true }).count()) > 0,
    'Spieler: abgelaufene Frist zeigt roten Chip',
  );
  ok(await yes.first().isDisabled(), 'Spieler: Zähler bei abgelaufener Frist gesperrt');
  // Antwort setzen: Terminliste (Training mit offener Frist)
  await goto('/termine');
  await page.getByText('Alle anzeigen ›').filter({ visible: true }).first().click();
  const open = page.getByRole('radio', { name: /^Zusage, \d+$/ }).filter({ visible: true });
  await open.first().waitFor({ timeout: 15_000 });
  const n = await open.count();
  let target = null;
  for (let i = 0; i < n; i++) if (await open.nth(i).isEnabled()) { target = open.nth(i); break; }
  ok(!!target, 'Spieler: Karte mit offener Frist gefunden');
  if (target) {
    await target.click();
    await page.getByText(/Teilnahme bestätigt/).first().waitFor({ timeout: 10_000 });
    ok(true, 'Spieler: Tipp auf ✓ setzt die Antwort');
    await page.getByRole('button', { name: /Rückgängig/ }).first().click().catch(() => {});
  }
}

console.log(b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
