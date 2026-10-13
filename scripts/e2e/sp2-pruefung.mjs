/** Paket SP2: Sponsoren-Container (0–3 werbende Sponsoren), Übersicht, Detail, Verwaltung. SCHEME=light für hell. */
import { api, launch, loginAs } from '../lib/e2e.mjs';
const out = '.check/shots';
const b = await launch();
let fail = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail++;
};
const admin = await loginAs('admin');
const original = (await api('/admin/sponsors', admin.token)).sponsors;
const body = (s, advertise) => ({
  name: s.name,
  slogan: s.slogan,
  description: s.description,
  linkUrl: s.linkUrl,
  startsOn: s.startsOn,
  endsOn: s.endsOn,
  advertise,
  hideForYouth: advertise && s.hideForYouth,
});
const running = original.filter((s) => s.status === 'active');
async function setAds(count) {
  for (const [i, s] of running.entries())
    await api(`/admin/sponsors/${s.id}`, admin.token, {
      method: 'PATCH',
      body: JSON.stringify(body(s, i < count)),
    });
}
const tag = process.env.SCHEME === 'light' ? 'hell' : 'dunkel';
const { page, goto } = await b.session('eltern', { height: 844 });
for (const count of [0, 1, 2, 3]) {
  await setAds(count);
  for (const path of ['/', '/team', '/verein']) {
    await goto(path);
    await page.waitForTimeout(2500);
    const n = await page.getByText('Unterstützt von').count();
    check(
      count === 0 ? n === 0 : n >= 1,
      `${path}: ${count} werbende Sponsoren → Container ${n ? 'sichtbar' : 'fehlt'}`,
    );
    if (count === 3) {
      const first = await page
        .getByText('Unterstützt von')
        .first()
        .locator('xpath=ancestor::*[2]')
        .textContent();
      await page.waitForTimeout(6800);
      const after = await page.getByText('Unterstützt von').first().isVisible();
      check(after, `${path}: Container läuft nach 6 s weiter (${(first ?? '').slice(0, 30)})`);
    }
    if (count === 2 || (count === 3 && path === '/verein')) {
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('*')) {
          if (el.textContent === 'Unterstützt von') el.scrollIntoView({ block: 'center' });
        }
      });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${out}/sp2-${path === '/' ? 'home' : path.slice(1)}-${count}-${tag}.png`,
      });
    }
  }
}
// Jugendspieler: kein Sponsor mit gesetztem Schalter
await setAds(3);
const player = await loginAs('spieler');
const ads = await api('/sponsors/ads?seed=x', player.token);
check(
  !ads.sponsors.some((s) => s.name === 'Gasthaus Zur Linde'),
  'Jugendspieler: kein Sponsor mit „nicht bei Jugendspielern“',
);
// Übersicht, Detail, Verwaltung
await goto('/sponsors');
await page.waitForTimeout(2200);
check(
  (await page.getByText('Sportshop Musterstadt').count()) > 0,
  'Übersicht zeigt auch Sponsoren ohne Werbung',
);
await page.screenshot({ path: `${out}/sp2-uebersicht-${tag}.png` });
await page.getByText('Fahrschule Lindner').first().click();
await page.waitForTimeout(1800);
check((await page.getByText('Zur Webseite').count()) > 0, 'Detail: Knopf „Zur Webseite“');
await page.screenshot({ path: `${out}/sp2-detail-${tag}.png` });
const a = await b.session('admin', { height: 844 });
await a.goto('/admin/sponsors');
await a.page.waitForTimeout(2200);
check(
  (await a.page.getByText(/Werbung läuft für/).count()) > 0,
  'Verwaltung: Zeile „Werbung läuft für x von y“',
);
await a.page.screenshot({ path: `${out}/sp2-admin-${tag}.png` });
await a.page.getByText('Fahrschule Lindner').first().click();
await a.page.waitForTimeout(1200);
await a.page.evaluate(() => {
  for (const el of document.querySelectorAll('*'))
    if (el.textContent === 'Werbung in der App') el.scrollIntoView({ block: 'center' });
});
await a.page.waitForTimeout(500);
await a.page.screenshot({ path: `${out}/sp2-admin2-${tag}.png` });
check((await a.page.getByText('Banner').count()) === 0, 'Verwaltung: kein Banner-Feld mehr');
// Ausgangszustand wiederherstellen
for (const s of original)
  await api(`/admin/sponsors/${s.id}`, admin.token, {
    method: 'PATCH',
    body: JSON.stringify(body(s, s.advertise)),
  });
await b.close();
process.exit(fail ? 1 : 0);
