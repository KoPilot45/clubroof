/** Optik- und Konsistenzdurchgang: hohe Fenster, viele Bildschirme → .check/shots/op-*.png, Maße → .check/shots/op-maße.json */
import { launch } from '../lib/e2e.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = '.check/shots';
mkdirSync(out, { recursive: true });
const b = await launch();
const log = [];
const measures = {};
async function run(who, list, h = 1500) {
  const { page, goto, login } = await b.session(who, { height: h });
  const t = login.me.teams?.find((x) => x.badge === 'B1') ?? login.me.teams?.[0];
  for (const [name, path] of list) {
    const p = path.replace('{T}', t?.id ?? '');
    try {
      await goto(p);
      await page.waitForTimeout(2600);
      await page.screenshot({ path: `${out}/op-${who}-${name}.png` });
      // Maße: Abstände zwischen Abschnittsüberschriften und obere Randbreite
      measures[`${who}-${name}`] = await page.evaluate(() => {
        const vh = window.innerHeight;
        const top = document.documentElement.getBoundingClientRect().top;
        const heads = [...document.querySelectorAll('*')].filter(
          (e) =>
            (e.children.length === 0 &&
              e.textContent &&
              e.textContent === e.textContent.toUpperCase() &&
              e.textContent.trim().length > 3 &&
              getComputedStyle(e).textTransform !== 'none') ||
            (e.children.length === 0 &&
              /Saira/.test(getComputedStyle(e).fontFamily) &&
              getComputedStyle(e).textTransform === 'uppercase'),
        );
        const ys = heads.map((e) => Math.round(e.getBoundingClientRect().top));
        const body = document.body.getBoundingClientRect();
        const first = document.elementFromPoint(195, 6);
        return {
          vh,
          scrollTop: Math.round(top),
          bodyTop: Math.round(body.top),
          topBg: first ? getComputedStyle(first).backgroundColor : null,
          heads: ys.slice(0, 10),
          gaps: ys.slice(1, 10).map((y, i) => y - ys[i]),
        };
      });
      log.push(`${who} ${name}`);
    } catch (e) {
      log.push(`FEHLER ${who} ${name}: ${e.message.slice(0, 80)}`);
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
    ['home', '/'],
    ['team', '/team'],
    ['kader', '/teams/{T}/roster'],
    ['kasse', '/teams/{T}/cash'],
    ['aufgaben', '/teams/{T}/tasks'],
    ['eventnew', '/teams/{T}/event-new'],
    ['strafen', '/teams/{T}/fines'],
    ['dokumente', '/documents'],
    ['news', '/news'],
    ['umfragen', '/polls'],
    ['abwesenheit', '/absences'],
    ['helfer', '/helpers'],
    ['spielplan', '/club-schedule'],
    ['platz', '/facilities'],
    ['wissen', '/wiki'],
    ['forum', '/forum'],
    ['events', '/club-events'],
    ['kalender', '/club-calendar'],
  ],
  1300,
);
await run(
  'admin',
  [
    ['uebersicht', '/admin'],
    ['mitglieder', '/admin/members'],
    ['teams', '/admin/teams'],
    ['club', '/admin/club'],
    ['module', '/admin/modules'],
    ['rollen', '/admin/roles'],
    ['import', '/admin/import'],
  ],
  1300,
);
await run('kasse', [['vkasse', '/club-cash']], 1300);
const a = await b.anonymous({ height: 844 });
await a.goto('/login');
await a.page.waitForTimeout(2500);
await a.page.screenshot({ path: `${out}/op-login.png` });
writeFileSync(`${out}/op-maße.json`, JSON.stringify(measures, null, 1));
console.log(log.join('\n'));
console.log(
  b.errors.length ? `Fehler:\n${b.errors.slice(0, 8).join('\n')}` : 'keine Konsolenfehler',
);
await b.close();
