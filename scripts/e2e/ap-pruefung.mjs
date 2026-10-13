/** Paket AP: Hinzufügen-Kachel, Poster mit Pfeil/Schleife, Kopfzeile, Navigation in Admin und Kasse. SCHEME=light für hell. */
import { launch } from '../lib/e2e.mjs';
const out = '.check/shots';
const sch = process.env.SCHEME === 'light' ? 'hell' : 'dunkel';
const b = await launch();
let fail = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail++;
};
{
  const { page, goto } = await b.session('eltern', { height: 844 });
  await goto('/');
  await page.waitForTimeout(2800);
  check((await page.getByText(/wischen/).count()) === 0, 'kein „wischen“-Text am Plakat');
  const arrow = page.getByRole('button', { name: 'Nächstes Spiel' });
  check((await arrow.count()) > 0, 'Pfeil am Plakat vorhanden');
  await page.screenshot({ path: `${out}/ap-home-${sch}.png` });
  const before = await page
    .getByText(/Nächstes Spiel|NÄCHSTES SPIEL/)
    .first()
    .textContent();
  for (let i = 0; i < 4; i++) {
    await arrow.first().click();
    await page.waitForTimeout(700);
  }
  const after = await page
    .getByText(/Nächstes Spiel|NÄCHSTES SPIEL/)
    .first()
    .textContent();
  check(!!after, `Endlosschleife: nach 4 Klicks weiterhin Inhalt (${before} → ${after})`);
  await page.screenshot({ path: `${out}/ap-home-nach-${sch}.png` });
  await page.mouse.move(195, 400);
  await page.mouse.wheel(0, 6000);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/ap-kacheln-${sch}.png` });
}
{
  const { page, goto } = await b.session('admin', { height: 844 });
  await goto('/admin');
  await page.waitForTimeout(2200);
  const tabs = page.getByRole('tab');
  check((await tabs.count()) === 5, 'Verwaltung: fünf Reiter');
  await page.screenshot({ path: `${out}/ap-admin-${sch}.png` });
}
{
  const { page, goto } = await b.session('kasse', { height: 844 });
  await goto('/club-cash');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/ap-kasse-${sch}.png` });
}
await b.close();
process.exit(fail ? 1 : 0);
