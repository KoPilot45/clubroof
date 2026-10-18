/**
 * Paket LD: Ladebildschirm in allen Zuständen – mit Verein (dunkel/hell, Grün und Gelb), ohne Verein, „Bewegung
 * reduzieren“. Die Antwort von `/me` wird verzögert, damit der Ladebildschirm stehen bleibt; danach prüft das Skript
 * die Überblendung auf die Startseite.
 * pnpm browser-check scripts/e2e/ladescreen.mjs [--no-build]   (Bilder in .check/shots/ld-*.png)
 */
import { createRequire } from 'node:module';
import { launch, loginAs } from '../lib/e2e.mjs';

const WEB = process.env.CLUBROOF_WEB ?? 'http://localhost:8081';
let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const b = await launch();
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const browser = await chromium.launch();
const login = await loginAs('trainer');

async function scene(name, { scheme, brand, reduce = false, release = false }) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'de-DE',
    colorScheme: scheme,
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  });
  await ctx.addInitScript(
    ([token, value]) => {
      localStorage.setItem('clubroof.session', token);
      if (value) localStorage.setItem('clubroof.setting.brand', value);
    },
    [login.token, brand ?? null],
  );
  const page = await ctx.newPage();
  let open;
  const gate = new Promise((r) => (open = r));
  await page.route('**/me', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`${WEB}/`);
  await page.waitForTimeout(2500);
  const loading = page.getByRole('progressbar', { name: 'Lädt' });
  ok(await loading.first().isVisible(), `${name}: Ladebildschirm sichtbar (progressbar „Lädt“)`);
  await page.screenshot({ path: `.check/shots/ld-${name}.png` });
  if (release) {
    open();
    await loading.first().waitFor({ state: 'hidden', timeout: 20_000 });
    await page.waitForTimeout(600);
    ok(
      !(await loading.first().isVisible()),
      `${name}: nach dem Laden Startseite statt Ladebildschirm`,
    );
  }
  open();
  await ctx.close();
}

await scene('verein-gruen-dunkel', { scheme: 'dark', brand: 'green|SV Grün-Weiß', release: true });
await scene('verein-gruen-hell', { scheme: 'light', brand: 'green|SV Grün-Weiß' });
await scene('verein-gelb-dunkel', { scheme: 'dark', brand: 'yellow|FC Sonne' });
await scene('verein-gelb-hell', { scheme: 'light', brand: 'yellow|FC Sonne' });
await scene('ohne-verein', { scheme: 'dark' });
await scene('verein-reduziert', { scheme: 'dark', brand: 'green|SV Grün-Weiß', reduce: true });

await browser.close();
console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(fail || b.errors.length ? 1 : 0);
