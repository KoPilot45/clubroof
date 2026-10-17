/**
 * Paket LH: Übersicht des hellen Stils über viele Bildschirme (ein Bild je Vereinsfarbe-Lauf).
 * SCHEME=light pnpm browser-check scripts/e2e/hell-uebersicht.mjs [--no-build]
 */
import { api, launch } from '../lib/e2e.mjs';

const b = await launch();
const shots = [];
const run = async (who, items) => {
  const { page, goto, login } = await b.session(who);
  const events = await api('/events', login.token);
  const match = events.find((e) => e.type === 'match' && e.status === 'scheduled');
  for (const [name, path] of items) {
    const p = typeof path === 'function' ? path({ match, login }) : path;
    if (!p) continue;
    await goto(p);
    await page.waitForTimeout(2200);
    shots.push(await b.shot(page, `hell-${name}`, false));
  }
};
await run('trainer', [
  ['home', '/'],
  ['team', '/team'],
  ['termine', '/termine'],
  ['verein', '/verein'],
  ['mehr', '/mehr'],
  ['termin', ({ match }) => match && `/events/${match.id}`],
  ['aufstellung', ({ match }) => match && `/match/${match.id}/lineup`],
]);
await run('admin', [
  ['admin', '/admin'],
  ['verwaltung-sponsoren', '/admin/sponsors'],
]);
await run('kasse', [['kasse', '/club-cash']]);
await b.close();
console.log(shots.join('\n'));
