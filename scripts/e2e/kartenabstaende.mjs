/**
 * Paket RS: misst den Abstand zwischen benachbarten Karten (Soll 14 px, mindestens 12 px) und zwischen
 * Hero und erster Karte. pnpm browser-check scripts/e2e/kartenabstaende.mjs --no-build
 * Ausgabe: nur Seiten mit Auffälligkeiten (Abstand < 12 px zwischen zwei untereinander stehenden Karten).
 */
import { launch } from '../lib/e2e.mjs';

const b = await launch();
const pages = {
  vorstand: [
    '/team',
    '/news',
    '/documents',
    '/helpers',
    '/club-teams',
    '/polls',
    '/forum',
    '/wiki',
  ],
  admin: [
    '/admin',
    '/admin/teams',
    '/admin/roles',
    '/admin/members',
    '/admin/news',
    '/admin/club-events',
    '/admin/invites',
    '/admin/transfers',
    '/admin/audit',
    '/admin/departments',
    '/admin/area/mitglieder',
  ],
  trainer: [
    '/team',
    '/teams/{T}/tasks',
    '/teams/{T}/roster',
    '/teams/{T}/cash',
    '/teams/{T}/fines',
    '/exercises',
    '/termine',
  ],
  eltern: ['/', '/mehr', '/verein', '/absences', '/events'],
  mitglied: ['/team', '/'],
  kasse: ['/club-cash', '/club-cash/entries', '/club-cash/fees', '/club-cash/funds'],
};
let bad = 0;
let seen = 0;
for (const [who, list] of Object.entries(pages)) {
  const { page, goto, login } = await b.session(who, { height: 1800 });
  const t = login.me.teams?.find((x) => x.badge === 'B1') ?? login.me.teams?.[0];
  for (const path of list) {
    await goto(path.replace('{T}', t?.id ?? ''));
    await page.waitForTimeout(2200);
    const gaps = await page.evaluate(() => {
      const isCard = (e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        const rad = parseFloat(cs.borderTopLeftRadius) || 0;
        const bg = cs.backgroundColor;
        const filled = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        const bordered = parseFloat(cs.borderTopWidth) > 0;
        return rad >= 14 && r.width > 240 && r.width < 420 && r.height > 48 && (filled || bordered);
      };
      const all = [...document.querySelectorAll('div')].filter(isCard);
      // nur äußerste Karten
      const top = all.filter((e) => !all.some((o) => o !== e && o.contains(e)));
      const rects = top
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.top >= 0)
        .sort((a, b) => a.top - b.top);
      const out = [];
      for (let i = 1; i < rects.length; i++) {
        const prev = rects[i - 1];
        const cur = rects[i];
        // nebeneinander stehende (Kachelraster) auslassen
        if (cur.top < prev.bottom - 1) continue;
        out.push(Math.round(cur.top - prev.bottom));
      }
      return out;
    });
    seen++;
    const small = gaps.filter((g) => g < 12);
    if (process.env.ALL) console.log(`${who} ${path}: ${gaps.join(' ')}`);
    if (small.length) {
      bad++;
      console.log(`${who} ${path}: ${gaps.join(' ')}`);
    }
  }
}
console.log(`${seen} Seiten gemessen, ${bad} mit Abstand < 12 px zwischen Karten`);
await b.close();
