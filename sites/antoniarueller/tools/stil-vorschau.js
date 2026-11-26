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
  head: ['#arbeiten .sec-head', 300, -20],
  hero: ['.ar-hero', 720, 0],
  questions: ['section[aria-label="Was mich antreibt"]', 600, 0],
  list: ['.clip-list', 640, 0],
  editor: ['.ar-ed-desk', 640, 0],
  podcast: ['#podcast', 640, 0],
  about: ['#ueber', 700, 0],
  cv: ['#rf', 640, 0],
  off: ['#offtherecord', 640, 0],
  contact: ['#kontakt', 640, 0],
};
const php = (...args) => execFileSync('php', [path.join(root, 'tools', 'stil-setzen.php'), ...args]);
const registry = JSON.parse(execFileSync('php', ['-r', "$root=" + JSON.stringify(root) + "; $cfg=require $root.'/config.php'; require $root.'/lib/bootstrap.php'; echo json_encode(array_map(fn($d)=>array_keys($d[1]), style_registry()));"]).toString());
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 0.5 });
  const p1 = await ctx.newPage();
  const p2 = await (await b.newContext({ viewport: { width: 520, height: 1500 }, deviceScaleFactor: 1.2 })).newPage();
  require('fs').mkdirSync(out, { recursive: true });
  for (const [area, styles] of Object.entries(registry)) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(area)) continue;
    for (const st of styles) {
      php(area + '=' + st);
      const p = area === 'head' ? p2 : p1;
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
      const dh = await p.evaluate(() => document.documentElement.scrollHeight);
      const W = area === 'head' ? 520 : 1280;
      const H = area === 'head' ? 325 : Math.min(800, Math.round(bb.height + 10));
      const y0 = Math.max(0, Math.min(bb.y + sy + off - 10, dh - H));
      const file = path.join(out, area + '-' + st + '.jpg');
      await p.screenshot({ path: file, type: 'jpeg', quality: 82, fullPage: true, clip: { x: 0, y: y0, width: W, height: H } });
      // auf das Seitenverhältnis der Karten (8:5) auffüllen, damit nichts angrenzendes zu sehen ist und nichts abgeschnitten wird
      execFileSync('python3', ['-c', "from PIL import Image;import sys;f=sys.argv[1];c=sys.argv[2]=='1';im=Image.open(f).convert('RGB');W=im.width;T=round(W*0.625);\nif im.height<T:\n S=Image.new('RGB',(W,T),im.getpixel((2,2)));S.paste(im,(0,(T-im.height)//2 if c else 0));im=S\nim.save(f,quality=82)", file, area === 'head' ? '1' : '0']);
      console.log('ok', area, st);
    }
  }
  php();
  await b.close();
})();
