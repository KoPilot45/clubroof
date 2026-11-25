// Erzeugt die Screenshots für die Hilfe (admin/hilfe-bilder/*.webp) aus Beispieldaten.
//
// Aufruf (frische Entwicklungsdatenbank, Server läuft):
//   rm data/ar_*.sqlite
//   PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:8080 tools/router.php &
//   NODE_PATH=$(npm root -g) node tools/hilfe-bilder.js [http://127.0.0.1:8080] [nur-dieses-Bild]
// Voraussetzungen: Node mit playwright, Python 3 mit Pillow (für WebP), PHP in der Konsole.
// Namen, E-Mail-Adressen und Zugangsdaten werden vor dem Foto durch Beispielwerte ersetzt.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const ONLY = process.argv[3] || '';
const OUT = path.join(root, 'admin', 'hilfe-bilder');
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'hilfe-'));
const cfg = fs.readFileSync(path.join(root, 'config.php'), 'utf8');
const owner = cfg.match(/'owner_email'\s*=>\s*'([^']+)'/)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

function php(code) {
  return execFileSync('php', ['-r', '$_SERVER["SCRIPT_NAME"]="/index.php"; require "' + root + '/lib/bootstrap.php"; ' + code], { cwd: root }).toString().trim();
}

// Nummerierte Markierung: roter Rahmen + Nummer
async function mark(page, marks) {
  const boxes = [];
  for (const m of marks) {
    const sel = typeof m === 'string' ? { sel: m } : m;
    const loc = page.locator(sel.sel).nth(sel.nth || 0);
    await loc.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error('Marke nicht gefunden: ' + sel.sel);
    boxes.push(b);
  }
  await page.evaluate((bx) => {
    bx.forEach((b, i) => {
      const f = document.createElement('div');
      f.style.cssText = 'position:fixed;z-index:99998;pointer-events:none;border:3px solid #e5483a;border-radius:8px;left:' + (b.x - 4) + 'px;top:' + (b.y - 4) + 'px;width:' + (b.width + 8) + 'px;height:' + (b.height + 8) + 'px;box-shadow:0 0 0 2px rgba(255,255,255,.6)';
      const n = document.createElement('div');
      n.textContent = String(i + 1);
      n.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;width:26px;height:26px;border-radius:50%;background:#e5483a;color:#fff;font:700 14px/26px system-ui,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);left:' + Math.max(2, b.x - 17) + 'px;top:' + Math.max(2, b.y - 17) + 'px';
      document.body.appendChild(f);
      document.body.appendChild(n);
    });
  }, boxes);
}

// Persönliches durch Beispielwerte ersetzen
async function mask(page) {
  await page.evaluate((own) => {
    const who = (document.querySelector('.who') || {}).textContent || '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      let t = n.nodeValue;
      if (who && who.trim() && t.indexOf(who.trim()) !== -1) t = t.split(who.trim()).join('Antonia Rüller');
      t = t.split(own).join('antonia@beispiel.de').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => (m === 'antonia@beispiel.de' ? m : 'name@beispiel.de'));
      if (t !== n.nodeValue) n.nodeValue = t;
    });
    document.querySelectorAll('input[type=email],input[name=email]').forEach((i) => { if (i.value) i.value = 'antonia@beispiel.de'; });
  }, owner);
}

async function save(page, name, clip) {
  const png = path.join(TMP, name + '.png');
  await page.screenshot(clip ? { path: png, clip } : { path: png });
  execFileSync('python3', ['-c', 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB")\nim.save(sys.argv[2],"WEBP",quality=82,method=6)', png, path.join(OUT, name + '.webp')]);
  console.log('✓', name, Math.round(fs.statSync(path.join(OUT, name + '.webp')).size / 1024) + ' KB');
}

(async () => {
  try { fs.unlinkSync(path.join(root, 'data', 'mail.log')); } catch (e) {}
  const clipId = php('echo (int)q("SELECT id FROM ar_items WHERE coll=\'clips\' AND deleted_at IS NULL ORDER BY sort LIMIT 1")->fetchColumn();');
  const trackId = php('echo (int)q("SELECT id FROM ar_items WHERE coll=\'tracks\' AND deleted_at IS NULL ORDER BY sort LIMIT 1")->fetchColumn();');
  const cvId = php('echo (int)q("SELECT id FROM ar_items WHERE coll=\'cv\' AND deleted_at IS NULL ORDER BY sort LIMIT 1")->fetchColumn();');
  // Beispiel-PDF für die Mediathek
  const pdfPath = path.join(root, 'uploads', 'beispiel-pressemappe.pdf');
  fs.writeFileSync(pdfPath, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

  const browser = await chromium.launch({ args: ['--lang=de-DE'] });
  const W = 1280;
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, deviceScaleFactor: 1, locale: 'de-DE' });
    return ctx;
  };

  // 1) Anmeldeseite (ohne Sitzung)
  {
    const ctx = await mk();
    const pg = await ctx.newPage();
    await pg.setViewportSize({ width: 900, height: 560 });
    await pg.goto(BASE + '/admin/');
    await pg.fill('input[name=email]', 'antonia@beispiel.de');
    await mark(pg, ['input[name=email]', 'button.btn']);
    if (!ONLY || ONLY === 'login') await save(pg, 'login', null);
    await ctx.close();
  }

  // Angemeldete Sitzung
  const ctx = await mk();
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('dialog', (d) => d.accept());
  pg.on('pageerror', (e) => errs.push(pg.url() + ' ' + String(e).slice(0, 100)));
  await pg.goto(BASE + '/admin/');
  await pg.fill('input[name=email]', owner);
  await pg.click('button:has-text("Code senden")');
  await sleep(800);
  const m = fs.readFileSync(path.join(root, 'data', 'mail.log'), 'utf8').match(/(\d{4}) (\d{4})/);
  await pg.fill('input[name=code]', m[1] + m[2]);
  await pg.keyboard.press('Enter');
  await pg.waitForSelector('.shell');

  const shots = [
    { name: 'uebersicht', url: '/admin/', h: 820, pre: async (p) => { await p.evaluate(() => document.querySelectorAll('.alerts').forEach((e) => e.remove())); }, marks: ['.side', '.gs-btn', '.sitemap', '#startklar'] },
    { name: 'speicherleiste', url: '/admin/?p=edit&c=clips&id=' + clipId, h: 800, after: () => php('discard_item_draft(' + clipId + ');'), scrollEnd: true, pre: async (p) => { await p.fill('#f_title', (await p.inputValue('#f_title')) + ' '); }, clip: { sel: '#actions', up: 150, down: 24, x: 250, w: 1030 },
      marks: ['button[name=mode][value=publish]', 'button[name=mode][value=draft]', '#savestate', '#livebtn', { sel: '.act-aux a.ibtn', nth: 0 }, { sel: '.act-aux a.ibtn', nth: 1 }, '.act-cancel'] },
    { name: 'suche', url: '/admin/', h: 520, pre: async (p) => { await p.keyboard.press('Control+K'); await sleep(250); await p.keyboard.type('refer', { delay: 40 }); await sleep(300); }, marks: ['#gsq', '#gsl'] },
    { name: 'liste-referenzen', url: '/admin/?p=list&c=clips', h: 640, marks: ['.toolbar .btn', { sel: '.row .star' }, { sel: '.row .tgl' }, { sel: '.row .r-act .btn' }, { sel: '.row .grip' }] },
    { name: 'featured', url: '/admin/?p=list&c=clips', h: 560, beforeLogin: () => php('foreach (items("clips", false, true) as $c) { set_item_flags((int)$c["_id"], ["featured" => false]); }'), pre: async (p) => { await p.locator('.row .star').nth(1).click(); await sleep(600); }, marks: [{ sel: '.row .star', nth: 1 }, '.pill.feat'] },
    { name: 'papierkorb', url: '/admin/?p=trash', h: 460, after: () => php('foreach (items("clips", true) as $c) { restore_item((int)$c["_id"]); }'), beforeLogin: () => php('foreach (items("clips", false, true) as $i => $c) { if ($i >= 9) trash_item((int)$c["_id"]); }'), marks: ['.row', { sel: '.row .r-act' }] },
    { name: 'hero', url: '/admin/?p=group&g=hero', h: 1700, marks: ['#f_first', '#f_lead', '#f_now_lines', '.focusbox', '#f_photo_alt'] },
    { name: 'bild-feld', url: '/admin/?p=group&g=hero', h: 640, scrollTo: '.imgbox', marks: ['.imgx', '.focusbox .fdot', 'input[type=file][name=photo]', '[data-media-pick=photo]'] },
    { name: 'abschnitte', url: '/admin/?p=group&g=sections', h: 820, scrollTo: '#f_show_label', marks: [{ sel: '.sw', nth: 1 }, { sel: '.seccard-l', nth: 2 }, '#f_show_label'] },
    { name: 'referenz-bearbeiten', url: '/admin/?p=edit&c=clips&id=' + clipId, h: 1560, marks: ['#f_title', '#f_tl_track', '#f_date', '#f_desc', '#f_still'] },
    { name: 'referenz-link', url: '/admin/?p=edit&c=clips&id=' + clipId, h: 1150, pre: async (p) => { await p.click('.seg-b[data-v=hosted]'); await sleep(250); await p.evaluate(() => { const e = document.querySelector('.seg'); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 150); }); await sleep(250); },
      marks: [{ sel: '.seg', nth: 0 }, { sel: '.seg', nth: 1 }, '#f_gallery_text', '.gal'] },
    { name: 'kategorien', url: '/admin/?p=list&c=tracks', h: 560, marks: [{ sel: '.row', nth: 0 }, { sel: '.row .grip', nth: 1 }] },
    { name: 'podcast-folge', url: '/admin/?p=edit&c=episodes', h: 1280, marks: ['#f_show', '#f_desc', '#f_spotify'] },
    { name: 'lebenslauf', url: '/admin/?p=edit&c=cv&id=' + cvId, h: 960, marks: ['#f_org', '#f_role', '#f_from', 'input[name=ongoing]'] },
    { name: 'stationen', url: '/admin/?p=list&c=cv', h: 900, marks: ['.toolbar .btn', { sel: '.row', nth: 0 }, { sel: '.embedlist .toolbar .btn' }] },
    { name: 'symbole', url: '/admin/?p=edit&c=tracks&id=' + trackId, h: 900, scrollTo: '.iconpick', marks: ['.iconpick', { sel: '.ip', nth: 0 }] },
    { name: 'uebersetzung', url: '/admin/?p=translate', h: 760, marks: [{ sel: '#trbar .chip', nth: 0 }, '#trarea', { sel: '.trrow:not([hidden]) .tr-en textarea', nth: 0 }, { sel: '.trrow:not([hidden]) .tr-copy', nth: 0 }] },
    { name: 'mediathek', url: '/admin/?p=media', h: 980, marks: ['#mf', { sel: '#mbar .chip', nth: 0 }, { sel: '.mname', nth: 0 }, { sel: '.mrep .btn', nth: 0 }, { sel: '.msel', nth: 0 }] },
    { name: 'seo', url: '/admin/?p=group&g=seo', h: 900, marks: ['input[name=noindex]', '#f_title', '#f_description'] },
    { name: 'recht', url: '/admin/?p=group&g=legal', h: 760, marks: ['.rte-bar', '.rte-area'] },
    { name: 'statistik', url: '/admin/?p=stats', h: 760, marks: [{ sel: '.kpi', nth: 0 }, { sel: 'main h2', nth: 0 }, 'text=CSV herunterladen'] },
    { name: 'zugaenge', url: '/admin/?p=users', h: 700, marks: [{ sel: '.row', nth: 0 }, { sel: '.row .r-act', nth: 1 }, { sel: '.fs', nth: 0 }] },
    { name: 'sicherung', url: '/admin/?p=backup', h: 700, marks: ['button.btn:has-text("Jetzt sichern")', { sel: 'h2:has-text("Gespeicherte Sicherungen")' }, { sel: 'h2:has-text("Aus Datei wiederherstellen")' }] },
    { name: 'systemcheck', url: '/admin/?p=check', h: 1100, marks: ['table.log', 'ul.selfchecks'] },
  ];

  for (const s of shots) {
    if (ONLY && s.name !== ONLY) continue;
    try {
      if (s.beforeLogin) s.beforeLogin();
      await pg.setViewportSize({ width: W, height: s.h || 800 });
      await pg.goto(BASE + s.url);
      await pg.waitForLoadState('load');
      await sleep(500);
      if (s.pre) await s.pre(pg);
      if (s.scrollTo) { await pg.locator(s.scrollTo).first().scrollIntoViewIfNeeded(); await pg.evaluate(() => window.scrollBy(0, -80)); await sleep(250); }
      if (s.scrollEnd) { await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(300); }
      await mask(pg);
      await mark(pg, s.marks);
      let clip = null;
      if (s.clip) {
        const b = await pg.locator(s.clip.sel).first().boundingBox();
        const y = Math.max(0, b.y - s.clip.up);
        clip = { x: s.clip.x, y, width: s.clip.w, height: Math.min(s.h - y, b.height + s.clip.up + s.clip.down) };
      }
      await save(pg, s.name, clip);
      if (s.after) s.after();
    } catch (e) {
      console.log('✗', s.name, String(e.message || e).split('\n')[0]);
    }
  }
  console.log('Fehler im Browser:', JSON.stringify(errs));
  await browser.close();
  try { fs.unlinkSync(pdfPath); } catch (e) {}
})();
