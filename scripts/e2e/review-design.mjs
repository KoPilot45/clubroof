/** Design-/Usability-Durchgang: Bilder nach .check/shots/rd-*.png */
import { launch } from '../lib/e2e.mjs';
import { mkdirSync } from 'node:fs';
const out = '.check/shots'; mkdirSync(out, { recursive: true });
const b = await launch();
const plan = {
  trainer: ['/', '/team', '/termine', '/verein', '/mehr', '/events/new', '/calendar', '/facilities/schedule'],
  vorstand: ['/', '/team', '/verein', '/club-events', '/club-calendar'],
  admin: ['/admin', '/admin/members', '/admin/club-event-new', '/admin/teams'],
  spieler: ['/', '/team', '/absences'],
};
for (const [who, paths] of Object.entries(plan)) {
  const { page, goto } = await b.session(who);
  for (const [i, p] of paths.entries()) {
    await goto(p); await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/rd-${who}-${i}.png`, fullPage: true });
    console.log(who, i, p, page.url().replace(/^https?:\/\/[^/]+/, ''));
  }
}
console.log(b.errors.length ? `Fehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler');
await b.close();
