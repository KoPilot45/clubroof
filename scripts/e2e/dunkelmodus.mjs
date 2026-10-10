/**
 * Paket L, Schritt 8: Dunkelmodus-Durchgang. Öffnet viele Seiten dunkel (Trainer, Vorstand/Admin),
 * prüft Konsolenfehler und horizontales Scrollen und baut Kontaktbögen (.check/shots/dunkel-*.png).
 * Aufruf: pnpm browser-check scripts/e2e/dunkelmodus.mjs [--hell | HELL=1]
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { api, launch } from '../lib/e2e.mjs';

const mode = (process.argv.includes('--hell') || process.env.HELL) ? 'light' : 'dark';
const prefix = mode === 'dark' ? 'dunkel' : 'hell';
const SHOTS = process.env.CLUBROOF_SHOTS ?? join(process.cwd(), '.check', 'shots');
mkdirSync(SHOTS, { recursive: true });
let failed = 0;

const b = await launch();
const shots = [];

async function sweep(who, pages) {
  const { page, login, goto } = await b.session(who);
  await api('/me/preferences', login.token, {
    method: 'PUT',
    body: JSON.stringify({ colorMode: mode }),
  });
  const b1 = login.me.teams.find((t) => t.badge === 'B1') ?? login.me.teams[0];
  const overview = b1 ? await api(`/teams/${b1.id}`, login.token) : null;
  const event = overview?.nextEvent ?? overview?.trainingWeek?.[0];
  for (const [name, path] of pages({ login, b1, event })) {
    if (!path) continue;
    await goto(path);
    await page.waitForTimeout(1800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (overflow > 0) {
      failed++;
      console.log(`✗ ${who} ${name}: horizontales Scrollen (${overflow} px)`);
    }
    const file = join(SHOTS, `${prefix}-${who}-${name.replace(/\W+/g, '_')}.png`);
    await page.screenshot({ path: file });
    shots.push({ who, name, file });
  }
  await api('/me/preferences', login.token, {
    method: 'PUT',
    body: JSON.stringify({ colorMode: 'light' }),
  });
}

await sweep('trainer', ({ b1, event, login }) => [
  ['Home', '/'],
  ['Team', `/team?teamId=${b1?.id}`],
  ['Termine', '/termine'],
  ['Verein', '/verein'],
  ['Mehr', '/mehr'],
  ['Termin', event ? `/events/${event.id}` : null],
  ['Kader', b1 ? `/teams/${b1.id}/roster` : null],
  ['Kasse', b1 ? `/teams/${b1.id}/cash` : null],
  ['Statistik', b1 ? `/teams/${b1.id}/stats` : null],
  ['Aufgaben', b1 ? `/teams/${b1.id}/tasks` : null],
  ['Profil', `/profile/${login.me.person.id}`],
  ['Benachrichtigungen', '/notifications'],
  ['Abwesenheiten', '/absences'],
  ['News', '/news'],
  ['Umfragen', '/polls'],
  ['Forum', '/forum'],
  ['Dokumente', '/documents'],
  ['Wissen', '/wiki'],
  ['Helfer', '/helpers'],
  ['Kontakte', '/contacts'],
  ['Mannschaften', '/club-teams'],
  ['Kalender', '/club-calendar'],
  ['Hilfe', '/help'],
  ['Konto', '/account'],
]);
await sweep('admin', () => [
  ['Verwaltung', '/admin'],
  ['Mitglieder', '/admin/members'],
  ['Rollen', '/admin/roles'],
  ['Module', '/admin/modules'],
  ['Verein', '/admin/club'],
  ['Mannschaften', '/admin/teams'],
  ['Protokoll', '/admin/audit'],
  ['Einladen', '/admin/invites'],
]);

// Kontaktbögen: 8 Bilder je Bogen (4 × 2)
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const per = 8;
for (let i = 0; i * per < shots.length; i++) {
  const part = shots.slice(i * per, i * per + per);
  const html = `<body style="margin:0;background:#777;display:grid;grid-template-columns:repeat(4,300px);gap:10px;padding:10px;font:12px sans-serif;color:#fff">${part
    .map(
      (s) =>
        `<div><div style="padding:2px 0">${s.who} · ${s.name}</div><img src="data:image/png;base64,${readFileSync(s.file).toString('base64')}" style="width:300px;display:block;border-radius:6px"></div>`,
    )
    .join('')}</body>`;
  const f = join(SHOTS, `${prefix}-bogen-${i + 1}.html`);
  writeFileSync(f, html);
  const p = await br.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(`file://${f}`);
  await p.screenshot({ path: join(SHOTS, `${prefix}-bogen-${i + 1}.png`), fullPage: true });
  console.log(`📷 ${join(SHOTS, `${prefix}-bogen-${i + 1}.png`)}`);
}
await br.close();

const real = b.errors.filter((e) => !/Failed to load resource/.test(e));
console.log(real.length ? `✗ Konsolenfehler:\n${real.join('\n')}` : '✓ keine Konsolenfehler');
await b.close();
process.exit(failed || real.length ? 1 : 0);
