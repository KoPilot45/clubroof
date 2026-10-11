/** Bildübersicht Q1 (einmalig zur Sichtprüfung): Team-Tab als Trainer, Schnellzugriff-Editor. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { launch, text } from '../lib/e2e.mjs';

const SHOTS = process.env.CLUBROOF_SHOTS ?? join(process.cwd(), '.check', 'shots');
mkdirSync(SHOTS, { recursive: true });
const b = await launch();
const { page, goto } = await b.session('trainer');
const files = [];
await goto('/team');
await text(page, 'Nächste Spiele', { exact: true }).waitFor({ timeout: 20_000 });
files.push(await b.shot(page, 'q1-team', false));
await goto('/');
await text(page, 'Schnellzugriff', { exact: true }).waitFor({ timeout: 20_000 });
await text(page, 'Hinzufügen', { exact: true }).click();
await text(page, 'Schnellzugriff anpassen').waitFor();
files.push(await b.shot(page, 'q1-editor', false));
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${files
  .map((f) => `<img src="${img(f)}" style="width:300px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'q1.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 660, height: 700 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'q1.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'q1.png')}`);
await b.close();
