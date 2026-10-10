/**
 * Optik-Durchgang: ausgewählte Bildschirme hell und dunkel in einer Übersicht (.check/optik/uebersicht.png).
 * Aufruf: pnpm browser-check scripts/e2e/optik.mjs [--no-build]
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { api, launch } from '../lib/e2e.mjs';

const OUT = '.check/optik';
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

const trainer = await b.session('trainer');
const me = await api('/me', trainer.login.token);
const b1 = me.teams.find((t) => t.badge === 'B1')?.id ?? me.teams[0].id;
const events = await api('/events', trainer.login.token);
const match = events.find((e) => e.match && e.status === 'scheduled');

// hell
await shot(trainer, '/mehr', 'hell-mehr');
const spieler = await b.session('spieler');
const sp = (await api('/me', spieler.login.token)).teams[0].id;
await shot(spieler, `/teams/${sp}/cash`, 'hell-kasse');
if (match) await shot(trainer, `/events/${match.id}`, 'hell-spiel');
await shot(trainer, `/teams/${b1}/roster`, 'hell-kader');
const admin = await b.session('admin', { width: 390 });
await shot(admin, '/admin', 'hell-verwaltung');

// dunkel
await api('/me/preferences', trainer.login.token, {
  method: 'PUT',
  body: JSON.stringify({ colorMode: 'dark' }),
});
await shot(trainer, '/', 'dunkel-home');
await shot(trainer, '/team', 'dunkel-team');
await shot(trainer, '/termine', 'dunkel-termine');
if (match) await shot(trainer, `/events/${match.id}`, 'dunkel-spiel');
await api('/me/preferences', trainer.login.token, {
  method: 'PUT',
  body: JSON.stringify({ colorMode: 'light' }),
});

const html = files
  .map(
    (f) =>
      `<img style="width:390px;height:844px" src="data:image/png;base64,${readFileSync(f).toString('base64')}">`,
  )
  .join('');
const m = await trainer.page.context().newPage();
await m.setViewportSize({ width: 390 * 5, height: 844 * 2 });
await m.setContent(
  `<body style="margin:0;display:flex;flex-wrap:wrap;width:1950px">${html}</body>`,
);
await m.screenshot({ path: `${OUT}/uebersicht.png` });
await b.close();
console.log(`📷 ${OUT}/uebersicht.png`);
if (b.errors.length) console.log(`Konsolenfehler:\n${b.errors.join('\n')}`);
