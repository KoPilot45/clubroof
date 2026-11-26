// Erzeugt die Vorschaubilder der Stile (Ausschnitte der echten Seite in Standardfarben und Standardschrift) nach assets/stile/vorschau/.
// Voraussetzung: frische Entwicklungsdatenbank mit den Demodaten, Server auf http://127.0.0.1:8080 (php -S 127.0.0.1:8080 tools/router.php),
// Playwright installiert. Aufruf: node tools/stil-vorschau.js
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'assets', 'stile', 'vorschau');
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
// Bereich => [Selektor, maximale Höhe in CSS-Pixeln]
const AREAS = {
  head: ['section[aria-label="Was mich antreibt"]', 100, 60],
  hero: ['.ar-hero', 720, 0],
  questions: ['section[aria-label="Was mich antreibt"]', 600, 90],
  list: ['.clip-list', 640, 0],
  editor: ['.ar-ed-desk', 640, 0],
  podcast: ['#podcast', 640, 100],
  about: ['#ueber', 700, 100],
  cv: ['#rf', 640, 0],
  off: ['#offtherecord', 640, 110],
  contact: ['#kontakt', 640, 110],
};
const php = (...args) => execFileSync('php', [path.join(root, 'tools', 'stil-setzen.php'), ...args]);
const registry = JSON.parse(execFileSync('php', ['-r', "$root=" + JSON.stringify(root) + "; $cfg=require $root.'/config.php'; require $root.'/lib/bootstrap.php'; echo json_encode(array_map(fn($d)=>array_keys($d[1]), style_registry()));"]).toString());
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 0.5 });
  const p = await ctx.newPage();
  require('fs').mkdirSync(out, { recursive: true });
  for (const [area, styles] of Object.entries(registry)) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(area)) continue;
    for (const st of styles) {
      php(area + '=' + st);
      await p.goto(BASE + '/'); await p.waitForTimeout(500);
      await p.addStyleTag({ content: '#topbar,.to-top{visibility:hidden!important}' });
      const [sel, maxH, off] = AREAS[area];
      const el = await p.$(sel);
      if (!el) { console.log('fehlt:', area, st); continue; }
      await p.evaluate(async (s) => { const e0 = document.querySelector(s); const t0 = e0.getBoundingClientRect().top + window.scrollY; for (let y = Math.max(0, t0 - 600); y <= t0 + 200; y += 150) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); } }, sel);
      await p.evaluate((s) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 30); }, sel);
      await p.waitForTimeout(2400);
      const bb = await el.boundingBox();
      const sy = await p.evaluate(() => window.scrollY);
      const y0 = Math.max(0, bb.y + sy + off - 10);
      await p.screenshot({ path: path.join(out, area + '-' + st + '.jpg'), type: 'jpeg', quality: 82, fullPage: true, clip: { x: 0, y: y0, width: 1280, height: Math.min(maxH, bb.height - off + 20) } });
      console.log('ok', area, st);
    }
  }
  php();
  await b.close();
})();
