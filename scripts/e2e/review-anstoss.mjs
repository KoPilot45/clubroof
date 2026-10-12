/** Abnahme-Durchgang Design Anstoß: hohe Fenster → .check/shots/an-*.png */
import { launch } from '../lib/e2e.mjs';
import { mkdirSync } from 'node:fs';
const out = '.check/shots';
mkdirSync(out, { recursive: true });
const b = await launch();
const log = [];
async function run(who, list, h = 1500) {
  const { page, goto, login } = await b.session(who, { height: h });
  const t = login.me.teams?.find((x) => x.badge === 'B1') ?? login.me.teams?.[0];
  for (const [name, path] of list) {
    const p = path.replace('{T}', t?.id ?? '');
    try {
      await goto(p);
      await page.waitForTimeout(2600);
      await page.screenshot({ path: `${out}/an-${name}.png` });
      log.push(`${name} ${p}`);
    } catch (e) {
      log.push(`FEHLER ${name}: ${e.message.slice(0, 80)}`);
    }
  }
}
await run('eltern', [
  ['home', '/'],
  ['team', '/team'],
  ['termine', '/termine'],
  ['verein', '/verein'],
  ['mehr', '/mehr'],
]);
await run(
  'trainer',
  [
    ['kader', '/teams/{T}/roster'],
    ['kasse', '/teams/{T}/cash'],
    ['aufgaben', '/teams/{T}/tasks'],
    ['eventnew', '/teams/{T}/event-new'],
    ['dokumente', '/documents'],
    ['news', '/news'],
  ],
  1300,
);
await run(
  'admin',
  [
    ['mitglieder', '/admin/members'],
    ['uebersicht', '/admin'],
    ['club', '/admin/club'],
  ],
  1300,
);
await run('kasse', [['vkasse', '/club-cash']], 1300);
const a = await b.anonymous({ height: 844 });
await a.goto('/login');
await a.page.waitForTimeout(2500);
await a.page.screenshot({ path: `${out}/an-login.png` });
console.log(log.join('\n'));
console.log(
  b.errors.length ? `Fehler:\n${b.errors.slice(0, 8).join('\n')}` : 'keine Konsolenfehler',
);
await b.close();
