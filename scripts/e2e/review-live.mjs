/** Durchgang an der laufenden App: hohe Fenster, damit der ganze Bildschirm sichtbar ist → .check/shots/live-*.png */
import { launch, api } from '../lib/e2e.mjs';
import { mkdirSync } from 'node:fs';
const out = '.check/shots';
mkdirSync(out, { recursive: true });
const b = await launch();
const log = [];
async function run(who, list, h = 1700) {
  const { page, goto, login } = await b.session(who, { height: h });
  const b1 = login.me.teams?.find((t) => t.badge === 'B1') ?? login.me.teams?.[0];
  for (const [name, path] of list) {
    const p = path.replace('{T}', b1?.id ?? '');
    try {
      await goto(p);
      await page.waitForTimeout(1700);
      await page.screenshot({ path: `${out}/live-${who}-${name}.png` });
      log.push(`${who} ${name} ${p}`);
    } catch (e) {
      log.push(`FEHLER ${who} ${name}: ${e.message.slice(0, 80)}`);
    }
  }
}
await run('trainer', [
  ['home', '/'],
  ['team', '/team'],
  ['termine', '/termine'],
  ['verein', '/verein'],
  ['mehr', '/mehr'],
  ['kader', '/teams/{T}/roster'],
  ['kasse', '/teams/{T}/cash'],
  ['aufgaben', '/teams/{T}/tasks'],
  ['strafen', '/teams/{T}/fines'],
  ['manage', '/teams/{T}/manage'],
  ['umfragen', '/polls'],
  ['news', '/news'],
  ['abwesenheit', '/absences'],
  ['dokumente', '/documents'],
  ['helfer', '/helpers'],
  ['events', '/events'],
]);
await run('admin', [
  ['uebersicht', '/admin'],
  ['mitglieder', '/admin/members'],
  ['teams', '/admin/teams'],
  ['club', '/admin/club'],
  ['module', '/admin/modules'],
  ['rollen', '/admin/roles'],
]);
await run('kasse', [
  ['verein-kasse', '/club-cash'],
  ['home', '/'],
]);
await run('eltern', [
  ['home', '/'],
  ['team', '/team'],
  ['termine', '/termine'],
]);
await run('vorstand', [
  ['home', '/'],
  ['verein', '/verein'],
  ['team', '/team'],
]);
console.log(log.join('\n'));
console.log(b.errors.length ? `Fehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler');
await b.close();
