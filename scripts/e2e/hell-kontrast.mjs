/**
 * Paket LH2: Kontrastprüfung aller Routen im Browser (Text gegen die Fläche dahinter).
 * Aufruf: SCHEME=light [WIDTH=1440 HEIGHT=900] [ROLES=admin,trainer] [ROUTES=/mehr,/verein] pnpm browser-check scripts/e2e/hell-kontrast.mjs --no-build [-- rolle,rolle]
 * `ROUTES`: nur diese Routen (und ihre Unterseiten) prüfen – bei kleinen Paketen statt aller rund 150 Routen; ohne Angabe alle.
 * Ausgabe: .check/kontrast-<hell|dunkel>.json und eine Zusammenfassung. Flächen mit Verlauf (Hero, Plakat,
 * Kopfbänder) und Bilder werden übersprungen – dort bleibt die Fläche in beiden Stilen farbig.
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { api, launch } from '../lib/e2e.mjs';

const APP = 'apps/mobile/src/app';
const SKIP = /^(login|forgot|setup|join|reset|demo|about\/privacy|\+)/;
function walk(dir, base = '') {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    const rel = base ? `${base}/${n}` : n;
    return statSync(p).isDirectory() ? walk(p, rel) : [rel];
  });
}
const files = walk(APP).filter((f) => f.endsWith('.tsx') && !/_layout|\+html|\+not-found/.test(f));
const toRoute = (f) =>
  '/' +
  f
    .replace(/\.tsx$/, '')
    .replace(/\(tabs\)\//, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
const allRoutes = files.map(toRoute).filter((r) => !SKIP.test(r.slice(1)));
// ROUTES=/mehr,/verein: nur diese Routen und ihre Unterseiten (z. B. /admin ergibt auch /admin/members)
const only = (process.env.ROUTES ?? '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);
const routes = only.length
  ? allRoutes.filter((r) => only.some((o) => r === o || r.startsWith(`${o}/`)))
  : allRoutes;
if (only.length) {
  const unknown = only.filter((o) => !allRoutes.some((r) => r === o || r.startsWith(`${o}/`)));
  if (unknown.length) console.log(`✗ Unbekannte Routen in ROUTES: ${unknown.join(', ')}`);
  console.log(`Auswahl: ${routes.length} von ${allRoutes.length} Routen`);
}

const light = process.env.SCHEME === 'light';
const roles = (
  process.env.ROLES ??
  process.argv.find((a) => a.includes(',')) ??
  'trainer,eltern,kasse,admin'
).split(',');
const b = await launch();
const findings = [];
let visited = 0;

const analyse = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, bl, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b: bl, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(' ');
    if (!own) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    // SVG-Text wird mit `fill` gezeichnet, nicht mit `color`
    let fg = parse(el instanceof SVGElement ? cs.fill : cs.color);
    if (!fg) continue;
    // Fläche dahinter: erster Vorfahre mit deckender Farbe; Verlauf/Bild → überspringen
    const layers = [];
    let skip = false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') {
        skip = true;
        break;
      }
      if (
        [...n.children].some(
          (k) => k.tagName.toLowerCase() === 'svg' && getComputedStyle(k).position === 'absolute',
        )
      ) {
        skip = true;
        break;
      }
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 0.98) break;
      }
    }
    if (skip) continue;
    // Seitenhintergrund (setzt die App je Theme auf <html>), sonst Weiß
    const page = parse(getComputedStyle(document.documentElement).backgroundColor);
    const base = page && page.a > 0 ? { ...page, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    // von außen nach innen übereinanderlegen (halbtransparente Flächen addieren sich)
    let bg = base;
    for (const layer of layers.reverse()) bg = over(layer, bg);
    fg = fg.a < 1 ? over(fg, bg) : fg;
    const l1 = lum(fg);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    // Symbolschrift (Private-Use-Zeichen) zählt als Symbol: 3 : 1
    const icon = /^[\uE000-\uF8FF]+$/.test(own);
    const size = parseFloat(cs.fontSize);
    const big = size >= 24 || (size >= 18.5 && Number(cs.fontWeight) >= 700);
    const need = big || icon ? 3 : 4.5;
    if (ratio < need) {
      const key = `${own}|${cs.color}|${cs.backgroundColor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text: own.slice(0, 50),
        ratio: Math.round(ratio * 100) / 100,
        need,
        fg: cs.color,
        bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
        size,
      });
    }
  }
  return out;
};

for (const who of roles) {
  const { page, goto, login } = await b.session(who, {
    width: Number(process.env.WIDTH ?? 390),
    height: Number(process.env.HEIGHT ?? 844),
  });
  const events = await api('/events', login.token);
  const ev = events[0];
  const team = login.me.teams?.[0];
  const dyn = (r) =>
    r
      .replace('/events/[id]', ev ? `/events/${ev.id}` : '')
      .replace('/teams/[id]', team ? `/teams/${team.id}` : '')
      .replace('/club-team/[id]', team ? `/club-team/${team.id}` : '')
      .replace('/profile/[id]', `/profile/${login.me.person?.id ?? login.me.user.id}`);
  for (const route of routes) {
    const url = dyn(route);
    if (/\[/.test(url) || !url) continue;
    try {
      await goto(url);
      await page.waitForTimeout(1200);
      const res = await page.evaluate(analyse);
      visited++;
      for (const f of res) findings.push({ who, route: url, ...f });
    } catch (e) {
      findings.push({ who, route: url, error: String(e).slice(0, 100) });
    }
  }
}
mkdirSync('.check', { recursive: true });
const file = `.check/kontrast-${light ? 'hell' : 'dunkel'}.json`;
writeFileSync(file, JSON.stringify(findings, null, 1));
const byRoute = {};
for (const f of findings) (byRoute[`${f.who} ${f.route}`] ??= []).push(f);
for (const [k, v] of Object.entries(byRoute))
  console.log(
    `${k}: ${v.length} – ${v
      .slice(0, 3)
      .map((f) => `„${f.text}“ ${f.ratio}`)
      .join('; ')}`,
  );
console.log(
  `${visited} Seiten geprüft, ${findings.length} Funde in ${Object.keys(byRoute).length} Bildschirmen → ${file}`,
);
await b.close();
