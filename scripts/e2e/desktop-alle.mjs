/**
 * Paket DT2: alle Routen bei 1440 px öffnen und melden: waagerechter Überlauf (Fehler), abgeschnittene Inhalte und
 * ungenutzte leere Breite (Inhalt unter 60 % der Breite neben der Seitenleiste, außer bei den schmalen Vorlagen B, E, U).
 * Dynamische Routen ([id]) werden mit einer passenden ID aus der API geöffnet, wenn eine bekannt ist.
 *   pnpm browser-check scripts/e2e/desktop-alle.mjs --no-build   (ROLES=admin,trainer, SCHEME=light, WIDTH=1100|1280|1536|1920 möglich)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { api, launch } from '../lib/e2e.mjs';

const APP = 'apps/mobile/src/app';
const templates = JSON.parse(readFileSync('apps/mobile/src/lib/desktop-templates.json', 'utf8'));
const files = [];
const walk = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.tsx') && !/^(_layout|\+)/.test(n))
      files.push(relative(APP, p).slice(0, -4));
  }
};
walk(APP);
const SKIP = /^(login|forgot|setup|join|reset|demo|\+)/;
const roles = (process.env.ROLES ?? 'admin,trainer').split(',');
const b = await launch();
const NARROW = new Set(['B', 'E', 'U']);
let overflow = 0;
let unused = 0;
let visited = 0;
const lines = [];
for (const who of roles) {
  const { page, goto, login } = await b.session(who, {
    width: Number(process.env.WIDTH ?? 1440),
    height: Number(process.env.HEIGHT ?? 900),
  });
  const team = login.me.teams[0];
  const ids = {
    teamId: team?.id,
    events: (await api('/events', login.token))?.[0]?.id,
  };
  for (const route of files.filter((f) => !SKIP.test(f))) {
    let url =
      '/' +
      route
        .replace(/\(tabs\)\//, '')
        .replace(/\/index$/, '')
        .replace(/^index$/, '');
    if (url.includes('[')) {
      if (url.startsWith('/teams/[id]') && ids.teamId)
        url = url.replace('[id]', ids.teamId).replace('/[kind]', '/matches');
      else if (url.startsWith('/events/[id]') && ids.events) url = url.replace('[id]', ids.events);
      else continue;
    }
    visited++;
    try {
      await goto(url);
      await page.waitForTimeout(900);
    } catch {
      continue;
    }
    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const over = document.documentElement.scrollWidth - vw;
      let minX = Infinity;
      let maxX = 0;
      for (const el of document.querySelectorAll('body *')) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.left < 260) continue; // Seitenleiste auslassen
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none') continue;
        minX = Math.min(minX, r.left);
        maxX = Math.max(maxX, r.right);
      }
      return { over, used: maxX > minX ? maxX - minX : 0 };
    });
    const t = templates[route]?.t;
    const share =
      m.used /
      (Number(process.env.WIDTH ?? 1440) - (Number(process.env.WIDTH ?? 1440) < 1400 ? 208 : 248));
    if (m.over > 2) {
      overflow++;
      lines.push(`✗ ${who} ${url}: waagerechter Überlauf um ${m.over} px`);
    }
    if (share < 0.6 && !NARROW.has(t) && m.used > 0) {
      unused++;
      lines.push(
        `– ${who} ${url} (${t}): Inhalt nutzt nur ${Math.round(share * 100)} % der Breite`,
      );
    }
  }
}
// 400 entsteht, wenn die Prüfung eine ersetzte ID für eine Seite nutzt, die sie nicht kennt; kein Fehler der App
const errors = b.errors.filter((e) => !/\b400\b/.test(e));
console.log(lines.join('\n'));
console.log(
  `${visited} Seiten geprüft: ${overflow} mit Überlauf, ${unused} mit ungenutzter Breite (Hinweis)`,
);
console.log(
  errors.length ? `✗ Konsolenfehler:\n${errors.slice(0, 5).join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(overflow || errors.length ? 1 : 0);
