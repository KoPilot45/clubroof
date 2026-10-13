/** Paket AO 5–9: Brotkrumen, Zugriffskarte, Kalenderfilter, Platzbelegung, Meine Kinder → .check/shots/ao-*.png */
import { launch } from '../lib/e2e.mjs';
const b = await launch();
const out = '.check/shots';
async function shot(who, path, name, act) {
  const { page, goto } = await b.session(who, { height: 844 });
  await goto(path);
  await page.waitForTimeout(2200);
  if (act) await act(page);
  await page.screenshot({ path: `${out}/ao-${name}.png` });
  return page;
}
await shot('kasse', '/club-cash/audit', 'krumen');
await shot('spieler', '/forum', 'forum');
await shot('trainer', '/club-calendar', 'kalender');
await shot('trainer', '/club-calendar', 'filter', async (p) => {
  await p.getByRole('button', { name: 'Filter' }).first().click();
  await p.waitForTimeout(600);
});
const p = await shot('vorstand', '/facilities', 'platz');
const cols = await p.evaluate(() => innerWidth + ' / scrollW ' + document.body.scrollWidth);
console.log('platz', cols);
await shot('eltern', '/mehr', 'kinder');
await b.close();
