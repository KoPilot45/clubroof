/**
 * Paket DESIGN-HELL-TERMINKARTE-HERO (Abschnitt D): Hero der Startseite, Variante C „Karte mit Vorschau“.
 * SCHEME=light pnpm browser-check scripts/e2e/hero.mjs --no-build   (ohne SCHEME: dunkel)
 */
import { launch } from '../lib/e2e.mjs';

const b = await launch();
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};

for (const who of ['spieler', 'trainer']) {
  const { page, goto } = await b.session(who);
  await goto('/');
  await page.getByText(/Spiel ansehen/).first().waitFor({ timeout: 20_000 });
  ok(true, `${who}: Hero-Karte mit „Spiel ansehen ›“`);
  const ring = page.locator('[aria-label^="Beginnt in"], [aria-label="Beginnt morgen"], [aria-label="Läuft gerade"]').first();
  ok((await ring.count()) > 0, `${who}: Ring-Countdown mit Bildschirmleser-Text (${await ring.getAttribute('aria-label')})`);
  ok((await page.getByText('Zum Spiel ›').count()) === 0, `${who}: altes „Zum Spiel ›“ entfallen`);
  const dots = page.locator('[data-testid="poster-dots"]').first();
  ok((await dots.count()) > 0, `${who}: Seitenpunkte vorhanden`);
  const list = page.getByRole('button', { name: /^Teilnehmerliste, \d+ offen$/ }).first();
  ok((await list.count()) > 0, `${who}: Teilnehmerknopf auf dem Hero`);
  await b.shot(page, `hero-${who}`, false);
  await page.getByRole('link', { name: /Spiel ansehen/ }).first().click();
  await page.waitForURL(/\/events\//, { timeout: 10_000 });
  ok(true, `${who}: „Spiel ansehen“ öffnet den Termin`);
}
console.log(b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
