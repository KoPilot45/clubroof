/**
 * Paket ST: Kassen-Statistik der Vereinskasse und der Mannschaftskasse.
 * pnpm browser-check scripts/e2e/kassen-statistik.mjs [--no-build]   (hell: SCHEME=light)
 */
import { api, launch, loginAs, text } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const b = await launch();
// Rücklagen-Karte nur, wenn der Demoverein Rücklagen hat
const kasseLogin = await loginAs('kasse');
const clubStats = await api('/club-cash/stats', kasseLogin.token);
const reservesHeading = clubStats.reserves?.length ? 'Rücklagen' : null;

// Kassenwart: Übersicht → Statistik, Themen, Anzeigezeile, Tabelle, Zeitraum, Direktlinks
{
  const { page, goto } = await b.session('kasse');
  await goto('/club-cash');
  await text(page, 'Alle Auswertungen ›').click({ timeout: 20_000 });
  await page.waitForURL(/\/club-cash\/stats/, { timeout: 10_000 });
  await text(page, 'Bestand im Verlauf', { exact: true }).waitFor({ timeout: 15_000 });
  ok(true, 'Statistik öffnet aus der Übersicht, Thema Überblick');

  // Fahren/Antippen: Anzeigezeile zeigt Werte
  const chart = page.locator('[role=img]').first();
  const box = await chart.boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(500);
  ok((await page.getByText(/\d[\d.]*,\d{2}\s€/).count()) > 0, 'Anzeigezeile zeigt Beträge');

  // Als Tabelle
  await text(page, 'Als Tabelle', { exact: true }).click();
  await text(page, 'Vorjahr', { exact: true }).waitFor({ timeout: 5_000 });
  await text(page, 'Als Diagramm', { exact: true }).click();
  ok(true, '„Als Tabelle“ und zurück');

  // Zeitraum wechseln, Themen durchgehen
  await text(page, 'Quartal', { exact: true }).click();
  await page.waitForTimeout(1000);
  for (const [chip, heading] of [
    ['Einnahmen & Ausgaben', 'Einnahmen und Ausgaben je Bereich'],
    ['Plan gegen Ist', reservesHeading],
    ['Beiträge', 'Beitragsstatus'],
    ['Abteilungen', null],
  ]) {
    await page.getByRole('tab', { name: chip }).first().click();
    await page.waitForTimeout(800);
    if (heading) await text(page, heading, { exact: true }).waitFor({ timeout: 10_000 });
    ok(true, `Thema „${chip}“`);
  }

  // Direktlink aus dem Reiter Beiträge
  await goto('/club-cash/area/beitraege');
  await text(page, 'Beitragsstatistik').click({ timeout: 15_000 });
  await text(page, 'Beitragsstatus', { exact: true }).waitFor({ timeout: 15_000 });
  ok(true, 'Direktlink „Beitragsstatistik“ öffnet das Thema Beiträge');
}

// Rechte: ohne Kassenrecht liefert der Server nichts
{
  const spieler = await loginAs('spieler');
  const res = await fetch(
    `${process.env.CLUBROOF_API ?? 'http://localhost:3999'}/club-cash/stats`,
    {
      headers: { authorization: `Bearer ${spieler.token}` },
    },
  );
  ok(res.status === 403, 'Spieler erhält keine Auswertung (403)');
}

// Mannschaftskasse: Zahlungsmoral und Strafen je Person
{
  const { page, goto, login } = await b.session('trainer');
  const team = login.me.teams.find((t) => t.badge === 'B1') ?? login.me.teams[0];
  const stats = await api(`/teams/${team.id}/cash/stats`, login.token);
  await goto(`/teams/${team.id}/cash-stats`);
  await text(page, 'Kassenstand seit Saisonbeginn', { exact: true }).waitFor({ timeout: 20_000 });
  ok(true, 'Mannschaftskasse: Kassenstand-Verlauf');
  if (stats.sources?.length) {
    await text(page, 'Woher das Geld kommt', { exact: true }).waitFor({ timeout: 5_000 });
    ok(true, 'Mannschaftskasse: Woher das Geld kommt');
  }
  if (stats.moral?.length) {
    await text(page, 'Zahlungsmoral', { exact: true }).waitFor({ timeout: 5_000 });
    ok(true, 'Mannschaftskasse: Zahlungsmoral');
  }
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(fail || b.errors.length ? 1 : 0);
