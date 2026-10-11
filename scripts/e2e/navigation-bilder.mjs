/** NV: Übersichtsbild (Unterseite kurz/lang, Verwaltung, Formular) → .check/shots/nv-uebersicht.png */
import { api, launch } from '../lib/e2e.mjs';
const b = await launch();
const s = await b.session('trainer');
const me = await api('/me', s.login.token);
const team = me.teams[0].id;
const files = [];
const shot = async (sess, path, name) => {
  await sess.goto(path);
  await sess.page.waitForTimeout(2500);
  const f = `.check/shots/${name}.png`;
  await sess.page.screenshot({ path: f });
  files.push(f);
};
await shot(s, `/teams/${team}/fines`, 'nv-a');
await shot(s, `/teams/${team}/cash-payments`, 'nv-b');
await shot(s, '/events', 'nv-c');
const a = await b.session('admin');
await shot(a, '/admin/members', 'nv-d');
await b.close();
console.log(files.join(' '));
