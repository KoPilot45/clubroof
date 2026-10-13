/**
 * Paket AO 2: misst den Abstand vor jeder Abschnittsüberschrift (Sollwert 48 px, ganz oben 32 px) und
 * den Abstand danach (18 px) auf vielen Seiten. pnpm browser-check scripts/e2e/abstaende.mjs --no-build
 */
import { launch } from '../lib/e2e.mjs';

const b = await launch();
const pages = {
  eltern: ['/', '/team', '/termine', '/verein', '/mehr', '/absences', '/club-teams', '/news'],
  trainer: [
    '/teams/{T}/cash',
    '/teams/{T}/tasks',
    '/teams/{T}/fines',
    '/documents',
    '/helpers',
    '/referees',
  ],
  admin: ['/admin', '/admin/members', '/admin/area/mitglieder', '/admin/modules'],
  kasse: ['/club-cash', '/club-cash/area/buchung', '/club-cash/budget'],
};
let fail = 0;
for (const [who, list] of Object.entries(pages)) {
  const { page, goto, login } = await b.session(who, { height: 1600 });
  const t = login.me.teams?.find((x) => x.badge === 'B1') ?? login.me.teams?.[0];
  for (const path of list) {
    await goto(path.replace('{T}', t?.id ?? ''));
    await page.waitForTimeout(2200);
    const res = await page.evaluate(() => {
      const out = [];
      const heads = [...document.querySelectorAll('h1,h2,h3,h4,div')].filter((e) => {
        const cs = getComputedStyle(e);
        return (
          e.children.length === 0 &&
          cs.textTransform === 'uppercase' &&
          cs.fontSize === '22px' &&
          e.textContent.trim()
        );
      });
      for (const h of heads) {
        let root = h;
        while (root && getComputedStyle(root).rowGap !== '18px') root = root.parentElement;
        if (!root) continue;
        const wrapper = root.parentElement;
        const prev = wrapper?.previousElementSibling ?? root.previousElementSibling;
        const hr = h.getBoundingClientRect();
        const row = h.parentElement.getBoundingClientRect();
        const above = prev ? Math.round(row.top - prev.getBoundingClientRect().bottom) : null;
        const next = root.children[1]?.getBoundingClientRect();
        const below = next ? Math.round(next.top - row.bottom) : null;
        out.push({
          title: h.textContent.trim().slice(0, 24),
          above,
          below,
          top: Math.round(hr.top),
        });
      }
      return out;
    });
    for (const r of res.slice(0, 12)) {
      const first = r.above !== null && r.above < 40;
      const okAbove =
        r.above === null || r.above === 48 || (first && r.above >= 30 && r.above <= 34);
      const okBelow = r.below === null || Math.abs(r.below - 18) <= 4;
      if (!okAbove || !okBelow) {
        fail++;
        console.log(`✗ ${who} ${path}: „${r.title}“ davor ${r.above} danach ${r.below}`);
      }
    }
    console.log(`${path}: ${res.length} Überschriften`);
  }
}
console.log(fail ? `✗ ${fail} Abweichungen` : '✓ alle Abschnittsabstände gleich');
await b.close();
process.exit(fail ? 1 : 0);
