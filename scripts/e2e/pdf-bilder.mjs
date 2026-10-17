/** Bilder für die Design-/Funktionsübersicht (PDF) → .check/pdf/<name>.png (Wiedergabe 2x) */
import { launch } from '../lib/e2e.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('.check/pdf', { recursive: true });
const b = await launch();
const cache = {};
async function snap(who, path, name, { scheme, act, h = 844, full = false } = {}) {
  const sess = (cache[who] ??= await b.session(who, { height: 844 }));
  const { page, goto } = sess;
  await page.setViewportSize({ width: 390, height: h });
  await goto(path);
  await page.waitForTimeout(2800);
  if (act) await act(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `.check/pdf/${name}.png`, fullPage: full });
  console.log(
    name,
    (await page.innerText('body')).split('\n').filter(Boolean).slice(0, 4).join(' | '),
  );
}
const click = (t) => async (p) => {
  await p.getByText(t, { exact: false }).filter({ visible: true }).first().click();
  await p.waitForTimeout(1800);
};
await snap('trainer', '/', 'home-trainer');
await snap('trainer', '/', 'home-trainer-lang', { h: 1700, full: true });
await snap('trainer', '/team', 'team');
await snap('trainer', '/termine', 'termine');
await snap('trainer', '/verein', 'verein');
await snap('trainer', '/mehr', 'mehr');
await snap('spieler', '/', 'home-spieler');
await snap('eltern', '/', 'home-eltern');
await snap('admin', '/verein', 'verein-admin');
await snap('admin', '/admin', 'admin');
await snap('kasse', '/club-cash-overview', 'vereinskasse');
await snap('trainer', '/club-calendar', 'vereinskalender');
await snap('trainer', '/sponsors', 'sponsoren');
await snap('trainer', '/board', 'brett');
await snap('trainer', '/help', 'hilfe');
await snap('trainer', '/termine', 'termin-detail', {
  act: async (p) => {
    const l = p.locator('a[href*="/events/"]').filter({ visible: true }).first();
    await l.click();
  },
});
const a = await b.anonymous();
await a.goto('/login');
await a.page.waitForTimeout(2500);
await a.page.screenshot({ path: '.check/pdf/login.png' });
console.log(b.errors.slice(0, 3));
await b.close();
