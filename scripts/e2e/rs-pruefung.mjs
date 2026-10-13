/** Paket RS: Sichtbarkeit je Rolle (Admin-Karte, Seitenwächter, Home ohne Mannschaft, Team-Reiter). */
import { launch } from '../lib/e2e.mjs';
const b = await launch();
let fail = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail++;
};
const has = async (page, txt) => (await page.getByText(txt).count()) > 0;

{
  const { page, goto } = await b.session('trainer', { height: 1500 });
  await goto('/mehr');
  await page.waitForTimeout(2000);
  check(!(await has(page, 'Admin-Verwaltung')), 'Trainer: keine Admin-Karte in Mehr');
  await goto('/admin');
  await page.waitForTimeout(2500);
  check(new URL(page.url()).pathname === '/mehr', 'Trainer: /admin führt auf Mehr');
  await goto('/club-cash');
  await page.waitForTimeout(2500);
  check(new URL(page.url()).pathname === '/mehr', 'Trainer: /club-cash führt auf Mehr');
}
{
  const { page, goto } = await b.session('admin', { height: 1500 });
  await goto('/mehr');
  await page.waitForTimeout(2000);
  check(await has(page, 'Admin-Verwaltung'), 'Admin: Admin-Karte in Mehr');
}
{
  const { page, goto } = await b.session('mitglied', { height: 1500 });
  await goto('/');
  await page.waitForTimeout(2500);
  check(!(await has(page, 'Noch keine Mannschaft')), 'Mitglied: Home ohne „Noch keine Mannschaft“');
  check(
    (await has(page, 'Dein Verein')) || (await has(page, 'DEIN VEREIN')),
    'Mitglied: Vereinsübersicht im Plakat',
  );
  await page.screenshot({ path: '.check/shots/rs-mitglied-home.png' });
  await goto('/team');
  await page.waitForTimeout(2500);
  check(await has(page, 'Abteilungsübersicht'), 'Mitglied: Team-Reiter zeigt Abteilungsübersicht');
  check(!(await has(page, 'Trainingsbeteiligung')), 'Mitglied: ohne Trainingsbeteiligung');
  check(!(await has(page, /zugesagt · /)), 'Mitglied: ohne Zusagen');
  await page.screenshot({ path: '.check/shots/rs-mitglied-team.png' });
}
{
  const { page, goto } = await b.session('kasse', { height: 1500 });
  await goto('/team');
  await page.waitForTimeout(2500);
  check(await has(page, 'Trainingsbeteiligung'), 'Kassenwart: volle Abteilungsübersicht');
}
await b.close();
process.exit(fail ? 1 : 0);
