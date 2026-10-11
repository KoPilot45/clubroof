/** LG: Anmeldeseite – Startauswahl ohne bekannten Verein, Vereinskopf mit Siegel, Einladungscode, Einrichtungscode. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { launch, text } from '../lib/e2e.mjs';

const SHOTS = process.env.CLUBROOF_SHOTS ?? join(process.cwd(), '.check', 'shots');
mkdirSync(SHOTS, { recursive: true });
const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const files = [];

// ── Erster Start: Clubroof in Hausfarben mit Startauswahl ─────────────────
{
  const a = await b.anonymous();
  const { page } = a;
  await a.goto('/login');
  await text(page, 'Ich habe einen Einladungscode', { exact: true }).waitFor({ timeout: 20_000 });
  ok(await text(page, 'CLUBROOF', { exact: true }).isVisible(), 'Erster Start: Clubroof-Kopf');
  ok(await text(page, 'QR scannen', { exact: true }).isVisible(), 'Startauswahl: QR scannen');
  ok(await text(page, 'Code eingeben', { exact: true }).isVisible(), 'Startauswahl: Code eingeben');
  ok(
    await text(page, 'Meinen Verein einrichten', { exact: true }).isVisible(),
    'Startauswahl: Verein einrichten',
  );
  files.push(await b.shot(page, 'lg-start', false));

  // Schon ein Konto → Formular in Clubroof-Farben mit „Zeigen“
  await text(page, 'Ich habe schon ein Konto', { exact: true }).click();
  await text(page, 'Anmelden', { exact: true }).first().waitFor();
  await page.getByLabel('Passwort', { exact: true }).fill('geheim123');
  const field = page.getByLabel('Passwort', { exact: true });
  ok((await field.getAttribute('type')) === 'password', 'Passwort ist verdeckt');
  await page.getByRole('button', { name: 'Passwort anzeigen' }).click();
  ok((await field.getAttribute('type')) === 'text', '„Zeigen“ macht das Passwort sichtbar');
  ok(await text(page, 'Passwort vergessen?', { exact: true }).isVisible(), 'Passwort vergessen?');
  await text(page, 'Zurück', { exact: true }).click();
  await text(page, 'Ich habe einen Einladungscode', { exact: true }).waitFor();

  // Code eingeben: ungültig → Fehler, Link → weiter zur Einladung
  await text(page, 'Code eingeben', { exact: true }).click();
  await page.getByLabel('Einladungscode oder Link').fill('abc');
  await text(page, 'Weiter', { exact: true }).click();
  await text(page, /kein gültiger Einladungscode/).waitFor();
  ok(true, 'Ungültiger Code wird erklärt');
  await page
    .getByLabel('Einladungscode oder Link')
    .fill('https://clubroof.example/join/abcdefghij1234');
  await text(page, 'Weiter', { exact: true }).click();
  await page.waitForURL(/\/join\/abcdefghij1234/, { timeout: 10_000 });
  ok(true, 'Link führt zur Einladung /join/<Code>');

  // Verein einrichten: Einrichtungscode wird geprüft
  await a.goto('/login');
  await text(page, 'Meinen Verein einrichten', { exact: true }).click();
  await text(page, 'Willkommen bei Clubroof', { exact: true }).waitFor();
  ok(
    await text(page, /CR-XXXX-XXXX|Einrichtungscode/)
      .first()
      .isVisible(),
    'Einrichtungscode wird verlangt',
  );
  await page.getByLabel('Einrichtungscode').fill('CR-FALSCH-0000');
  await text(page, 'Los geht’s', { exact: true }).click();
  await text(page, /Einrichtungscode stimmt nicht|bereits eingerichtet/).waitFor({
    timeout: 10_000,
  });
  ok(true, 'Falscher Einrichtungscode wird abgelehnt');
}

// ── Verein bekannt: Vereinskopf mit Siegel „Powered by Clubroof“ ───────────
{
  const a = await b.anonymous();
  const { page } = a;
  await page.addInitScript(() =>
    localStorage.setItem('clubroof.setting.brand', 'green|SV Grün-Weiß'),
  );
  await a.goto('/login');
  await text(page, /Musterstadt/).waitFor({ timeout: 20_000 });
  ok(await text(page, /SV Grün-Weiß Musterstadt/).isVisible(), 'Bekannter Verein: Name im Kopf');
  ok(await text(page, /seit 1920/).isVisible(), 'Ort und Gründungsjahr stehen im Kopf');
  ok(await page.getByLabel('Powered by Clubroof').isVisible(), 'Siegel „Powered by Clubroof“');
  ok(
    await text(page, 'Einladungscode eingeben', { exact: true }).isVisible(),
    'Einladungscode unter dem Formular',
  );
  for (const l of ['Hilfe', 'Datenschutz', 'Impressum'])
    ok(await text(page, l, { exact: true }).isVisible(), `Fußzeile: ${l}`);
  files.push(await b.shot(page, 'lg-verein', false));
  await text(page, 'Datenschutz', { exact: true }).click();
  await page.waitForURL(/about\/datenschutz/, { timeout: 10_000 });
  ok(true, 'Datenschutz ist auch ohne Anmeldung erreichbar');
}

const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const html = `<body style="margin:0;background:#888;display:flex;gap:12px;padding:12px;align-items:flex-start">${files
  .map((f) => `<img src="${img(f)}" style="width:330px;display:block;border-radius:8px">`)
  .join('')}</body>`;
const overview = join(SHOTS, 'lg.html');
writeFileSync(overview, html);
const { chromium } = createRequire(import.meta.url)('playwright');
const br = await chromium.launch();
const p2 = await br.newPage({ viewport: { width: 700, height: 900 } });
await p2.goto(`file://${overview}`);
await p2.screenshot({ path: join(SHOTS, 'lg.png'), fullPage: true });
await br.close();
console.log(`📷 ${join(SHOTS, 'lg.png')}`);

await b.close();
// 400 = absichtlich falscher Code im Test
const real = b.errors.filter((e) => !/status of 400/.test(e));
console.log(real.length ? `Konsolenfehler:\n${real.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || real.length) process.exit(1);
