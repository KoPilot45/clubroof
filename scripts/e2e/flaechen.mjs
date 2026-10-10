/**
 * Flächen-Prinzip: Übersicht der Bildschirme mit Primärfarb-Fläche, dazu neue Vereinsfarben (.check/flaechen/uebersicht.png).
 * Aufruf: pnpm browser-check scripts/e2e/flaechen.mjs [--no-build]
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { api, launch } from '../lib/e2e.mjs';

const OUT = '.check/flaechen';
mkdirSync(OUT, { recursive: true });
const b = await launch();
const files = [];
const shot = async (s, path, name) => {
  await s.goto(path);
  await s.page.waitForTimeout(2800);
  const f = `${OUT}/${name}.png`;
  await s.page.screenshot({ path: f });
  files.push(f);
};
const admin = await b.session('admin');
const color = (colorTheme) =>
  api('/admin/club', admin.login.token, { method: 'PATCH', body: JSON.stringify({ colorTheme }) });
const trainer = await b.session('trainer');
const me = await api('/me', trainer.login.token);
const b1 = me.teams.find((t) => t.badge === 'B1')?.id ?? me.teams[0].id;
const reload = async (s) => s.page.reload();

await shot(trainer, '/', 'home');
await shot(trainer, '/termine', 'termine');
await shot(trainer, '/team', 'team');
await shot(trainer, '/verein', 'verein');
await shot(trainer, `/profile/${me.person.id}`, 'profil');
await shot(admin, `/teams/${b1}/cash-admin`, 'kasse-verwaltung');
await shot(trainer, '/help', 'hilfe');
await color('orange');
await shot(trainer, '/', 'orange-home');
await color('skyblue');
await shot(trainer, '/team', 'himmelblau-team');
await color('purple');
await shot(trainer, '/termine', 'lila-termine');
await color('teal');
await shot(trainer, '/verein', 'tuerkis-verein');
await color('burgundy');
await shot(trainer, '/', 'weinrot-home');
await color('green');

const html = files
  .map(
    (f) =>
      `<img style="width:390px;height:844px" src="data:image/png;base64,${readFileSync(f).toString('base64')}">`,
  )
  .join('');
const m = await trainer.page.context().newPage();
await m.setViewportSize({ width: 390 * 6, height: 844 * 2 });
await m.setContent(
  `<body style="margin:0;display:flex;flex-wrap:wrap;width:2340px">${html}</body>`,
);
await m.screenshot({ path: `${OUT}/uebersicht.png` });
await b.close();
console.log(`📷 ${OUT}/uebersicht.png`);
if (b.errors.length) console.log(`Konsolenfehler:\n${b.errors.join('\n')}`);
