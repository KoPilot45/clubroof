/** Bildübersicht MS (einmalig zur Sichtprüfung): Team-Tab (Trainer) und Verein-Tab (Administration). */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { launch, text } from '../lib/e2e.mjs';

const SHOTS = process.env.CLUBROOF_SHOTS ?? join(process.cwd(), '.check', 'shots');
mkdirSync(SHOTS, { recursive: true });
const b = await launch();
const files = [];
for (const [who, path, wait, name] of [
  ['trainer', '/team', 'Organisation', 'team'],
  ['admin', '/verein', 'Neuigkeiten', 'verein'],
]) {
  const { page, goto } = await b.session(who);
  await goto(path);
  await text(page, wait, { exact: true }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  files.push(await b.shot(page, `ms-${name}`, true));
}
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${files
  .map((f) => `<img src="${img(f)}" style="width:330px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'ms.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 700, height: 900 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'ms.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'ms.png')}`);
await b.close();
