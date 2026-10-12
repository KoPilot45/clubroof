/**
 * Design „Anstoß“: Unterseiten in Referenzgröße aufnehmen (Vergleich mit docs/design/anstoss/DarkU*.html).
 * pnpm browser-check scripts/e2e/anstoss-unterseiten.mjs --no-build   → .check/shots/u-*.png
 */
import { api, launch } from '../lib/e2e.mjs';

const b = await launch();
const adminS = await b.session('admin', { width: 390, height: 1500 });
const coachS = await b.session('trainer', { width: 390, height: 1500 });
const parentS = await b.session('eltern', { width: 390, height: 1500 });

const b1 = coachS.login.me.teams.find((t) => t.badge === 'B1');
const events = await api('/events', coachS.login.token);
const trainings = events.filter((e) => e.type === 'training' && e.team?.id === b1.id);
const news = await api('/news', adminS.login.token);

const shots = [
  ['u1', adminS, '/admin/members'],
  ['u2', coachS, `/events/${trainings[0].id}`],
  ['u3', coachS, `/teams/${b1.id}/event-new`],
  ['u5', coachS, `/teams/${b1.id}/cash`],
  ['u6', coachS, `/teams/${b1.id}/roster`],
  ['u7', coachS, `/teams/${b1.id}/stats`],
  ['u8', adminS, `/news/${news[0].id}`],
  ['u9', adminS, '/admin'],
  ['u10', adminS, '/club-cash'],
  ['u11', adminS, '/admin/club'],
  ['u16', parentS, '/documents'],
];
const only = process.env.ONLY?.split(',');
for (const [name, s, path] of shots) {
  if (only && !only.includes(name)) continue;
  await s.goto(path);
  await s.page.waitForTimeout(1500);
  await b.shot(s.page, `u-${name}`, false);
}
console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
