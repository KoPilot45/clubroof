/**
 * PM: Chips/Pills stehen in Zeilen mittig. Prüft die Hauptlisten: Ein Chip, dessen Elternzeile `align-items: center`
 * hat, muss auf der Mittellinie der Zeile liegen (Abweichung höchstens 2 px).
 * Aufruf: pnpm browser-check scripts/e2e/pills-mittig.mjs [--no-build]
 */
import { launch } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const PERSONAS = {
  spieler: ['/', '/termine', '/team', '/verein', '/mehr', '/notifications', '/polls', '/documents'],
  trainer: ['/team', '/termine', '/teams/members'],
  admin: [
    '/admin',
    '/admin/members',
    '/admin/roles',
    '/admin/teams',
    '/club-cash',
    '/club-cash/fees',
    '/facilities',
  ],
  kasse: ['/club-cash', '/club-cash/entries', '/club-cash/fees'],
};
for (const [who, paths] of Object.entries(PERSONAS)) {
  const s = await b.session(who);
  for (const path of paths) {
    await s.goto(path);
    await s.page.waitForTimeout(2500);
    const bad = await s.page.evaluate(() => {
      const out = [];
      for (const chip of document.querySelectorAll('[data-testid="chip"]')) {
        const c = chip.getBoundingClientRect();
        if (c.height === 0) continue;
        // Zeile = Elternteil des Chips (oder seines einzigen Umhüllers) mit mehreren Kindern
        let node = chip;
        while (node.parentElement && node.parentElement.children.length === 1)
          node = node.parentElement;
        const row = node.parentElement;
        if (!row || row.children.length < 2) continue;
        const cs = getComputedStyle(row);
        if (cs.flexDirection !== 'row' || cs.alignItems !== 'center' || cs.flexWrap === 'wrap')
          continue;
        if (row.getBoundingClientRect().height <= c.height + 4) continue;
        const r = row.getBoundingClientRect();
        const delta = Math.abs(c.top + c.height / 2 - (r.top + r.height / 2));
        if (delta > 2) out.push(`${chip.textContent.slice(0, 24)} (${Math.round(delta)} px)`);
      }
      return out;
    });
    ok(bad.length === 0, `${who} ${path}: Chips mittig${bad.length ? ` – ${bad.join(', ')}` : ''}`);
  }
}
await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
