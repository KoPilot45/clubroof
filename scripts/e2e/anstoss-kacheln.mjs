/**
 * Paket AK: Maße der großen Kacheln messen (Breite ca. 165, Höhe ≥ 124, Spalten 2, Abstand 14).
 * pnpm browser-check scripts/e2e/anstoss-kacheln.mjs --no-build
 */
import { launch } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto } = await b.session('eltern', { width: 390, height: 1400 });
let fail = false;
for (const path of ['/verein', '/']) {
  await goto(path);
  await page.waitForTimeout(2500);
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('[role="button"]')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height >= 120 && r.height < 200 && r.width > 150 && r.width < 180)
      .map((r) => ({
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      })),
  );
  const cols = new Set(boxes.map((r) => r.x)).size;
  const gap =
    boxes.length > 1 && boxes[0].y === boxes[1].y ? boxes[1].x - (boxes[0].x + boxes[0].w) : null;
  console.log(
    path,
    `${boxes.length} Kacheln`,
    'Spalten',
    cols,
    'Breite',
    boxes[0]?.w,
    'Höhe',
    boxes[0]?.h,
    'Abstand',
    gap,
  );
  if (cols !== 2 || boxes[0].h < 124 || Math.abs(boxes[0].w - 165) > 6 || Math.abs(gap - 14) > 3)
    fail = true;
}
console.log(fail ? '✗ Maße weichen ab' : '✓ Kachelmaße stimmen');
await b.close();
process.exit(fail ? 1 : 0);
