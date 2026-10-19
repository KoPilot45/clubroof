#!/usr/bin/env node
/**
 * Erzeugt die Demo-Bilder (Sponsorenlogos, News-Bilder, Mannschaftsillustrationen) als PNG nach
 * `apps/api/assets/`. Alles selbst gezeichnet, reproduzierbar, keine Fotos Dritter.
 * Aufruf: `node scripts/demo-bilder.mjs`. Die API liefert sie unter `/brand/<name>` aus.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const OUT = fileURLToPath(new URL('../apps/api/assets/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function canvas(w, h, bg) {
  const png = new PNG({ width: w, height: h });
  const [r, g, b] = hex(bg);
  for (let i = 0; i < w * h; i++) png.data.set([r, g, b, 255], i * 4);
  const px = (x, y, c, a = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 4;
    const [cr, cg, cb] = hex(c);
    png.data[o] = png.data[o] * (1 - a) + cr * a;
    png.data[o + 1] = png.data[o + 1] * (1 - a) + cg * a;
    png.data[o + 2] = png.data[o + 2] * (1 - a) + cb * a;
  };
  const each = (x0, y0, x1, y1, f) => {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, Math.ceil(x1)); x++) f(x, y);
  };
  return {
    png,
    w,
    h,
    rect: (x, y, rw, rh, c, a = 1) => each(x, y, x + rw, y + rh, (px_, py_) => px(px_, py_, c, a)),
    circle: (cx, cy, r2, c, a = 1) =>
      each(cx - r2, cy - r2, cx + r2, cy + r2, (x, y) => {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2 * r2) px(x, y, c, a);
      }),
    ring: (cx, cy, r2, t, c, a = 1) =>
      each(cx - r2, cy - r2, cx + r2, cy + r2, (x, y) => {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r2 && d >= r2 - t) px(x, y, c, a);
      }),
    tri: (x0, y0, x1, y1, x2, y2, c, a = 1) =>
      each(
        Math.min(x0, x1, x2),
        Math.min(y0, y1, y2),
        Math.max(x0, x1, x2),
        Math.max(y0, y1, y2),
        (x, y) => {
          const s = (ax, ay, bx, by) => (x - bx) * (ay - by) - (ax - bx) * (y - by);
          const d1 = s(x0, y0, x1, y1),
            d2 = s(x1, y1, x2, y2),
            d3 = s(x2, y2, x0, y0);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) px(x, y, c, a);
        },
      ),
    gradient: (c1, c2) => {
      const [r1, g1, b1] = hex(c1),
        [r2, g2, b2] = hex(c2);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const t = (y / h + x / w) / 2,
            o = (y * w + x) * 4;
          png.data.set([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t, 255], o);
        }
    },
  };
}
const save = (name, c) => writeFileSync(OUT + name, PNG.sync.write(c.png));

// Sponsorenlogos: je Sponsor ein Bild (360×180), Zeichen statt Schrift
const logos = {
  'demo-logo-mueller.png': (c) => {
    c.rect(0, 0, 360, 180, '#2e7d32');
    c.tri(130, 100, 180, 50, 230, 100, '#ffffff');
    c.rect(145, 100, 70, 45, '#ffffff');
    c.rect(170, 118, 20, 27, '#2e7d32');
  },
  'demo-logo-sportshop.png': (c) => {
    c.rect(0, 0, 360, 180, '#1565c0');
    c.circle(180, 90, 52, '#ffffff');
    c.ring(180, 90, 52, 6, '#1565c0');
    c.circle(180, 90, 16, '#1565c0');
  },
  'demo-logo-lindner.png': (c) => {
    c.rect(0, 0, 360, 180, '#f9a825');
    c.rect(110, 95, 140, 36, '#212121');
    c.rect(135, 70, 90, 30, '#212121');
    c.circle(145, 135, 16, '#f9a825');
    c.circle(215, 135, 16, '#f9a825');
  },
  'demo-logo-linde.png': (c) => {
    c.rect(0, 0, 360, 180, '#6d4c41');
    c.circle(180, 75, 42, '#a5d6a7');
    c.rect(171, 100, 18, 50, '#d7ccc8');
  },
  'demo-logo-kaiser.png': (c) => {
    c.rect(0, 0, 360, 180, '#ef6c00');
    c.circle(140, 95, 40, '#ffe0b2');
    c.circle(220, 95, 40, '#ffe0b2');
    c.rect(140, 55, 80, 80, '#ffe0b2');
    for (const x of [150, 180, 210]) c.tri(x - 8, 70, x + 8, 70, x, 110, '#ef6c00');
  },
  'demo-logo-stadtwerke.png': (c) => {
    c.rect(0, 0, 360, 180, '#0277bd');
    c.tri(180, 30, 130, 120, 230, 120, '#4fc3f7');
    c.circle(180, 120, 50, '#4fc3f7');
    c.circle(165, 105, 12, '#ffffff', 0.55);
  },
  'demo-logo-meyer.png': (c) => {
    c.rect(0, 0, 360, 180, '#37474f');
    c.rect(95, 100, 170, 34, '#eceff1');
    c.rect(125, 72, 110, 32, '#eceff1');
    c.circle(135, 136, 17, '#37474f');
    c.circle(225, 136, 17, '#37474f');
    c.rect(150, 80, 60, 18, '#90a4ae');
  },
};
for (const [n, f] of Object.entries(logos)) {
  const c = canvas(360, 180, '#ffffff');
  f(c);
  save(n, c);
}

// News-Bilder (800×450): Platz, Flutlicht, Jubel, Halle
const pitch = (c, a, b) => {
  c.gradient(a, b);
  const { w, h } = c;
  c.rect(40, 40, w - 80, h - 80, '#ffffff', 0.18);
  c.rect(w / 2 - 2, 40, 4, h - 80, '#ffffff', 0.6);
  c.ring(w / 2, h / 2, 70, 4, '#ffffff', 0.6);
  c.rect(40, h / 2 - 90, 90, 180, '#ffffff', 0.15);
  c.rect(w - 130, h / 2 - 90, 90, 180, '#ffffff', 0.15);
};
const news = {
  'demo-news-flutlicht.png': (c) => {
    pitch(c, '#0b3d2e', '#14683d');
    for (const x of [120, 680]) {
      c.rect(x - 4, 30, 8, 150, '#cfd8dc');
      c.rect(x - 34, 20, 68, 26, '#fff59d');
      c.tri(x - 40, 46, x + 40, 46, x, 330, '#fff59d', 0.12);
    }
  },
  'demo-news-fanschal.png': (c) => {
    c.gradient('#1b5e20', '#43a047');
    for (let i = 0; i < 6; i++) c.rect(60 + i * 120, 0, 60, 450, '#ffffff', 0.9);
    c.rect(0, 190, 800, 70, '#1b5e20', 0.35);
  },
  'demo-news-jha.png': (c) => {
    pitch(c, '#1a237e', '#3949ab');
    c.circle(400, 225, 28, '#ffffff');
    c.ring(400, 225, 28, 4, '#1a237e');
  },
  'demo-news-sponsor.png': (c) => {
    c.gradient('#e65100', '#ffb74d');
    c.rect(250, 150, 300, 160, '#ffffff', 0.9);
    c.rect(285, 175, 230, 24, '#e65100');
    c.rect(285, 215, 160, 18, '#bdbdbd');
    c.rect(285, 245, 190, 18, '#bdbdbd');
  },
  'demo-news-ehrenamt.png': (c) => {
    c.gradient('#6a1b9a', '#ba68c8');
    for (let i = 0; i < 5; i++) {
      c.circle(160 + i * 120, 210, 38, '#ffffff', 0.92);
      c.rect(122 + i * 120, 250, 76, 90, '#ffffff', 0.92);
    }
  },
};
for (const [n, f] of Object.entries(news)) {
  const c = canvas(800, 450, '#000000');
  f(c);
  save(n, c);
}
console.log(
  `${Object.keys(logos).length + Object.keys(news).length} Bilder nach apps/api/assets/ geschrieben.`,
);
