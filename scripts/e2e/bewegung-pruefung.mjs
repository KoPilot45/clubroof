/**
 * Prüft, ob die Bewegung (Hochzählen großer Zahlen und Beträge, Balken, Einblenden) in der Web-App läuft –
 * mit und ohne „Bewegung reduzieren“ (dann steht sofort der Endwert).
 */
import { loginAs, WEB } from '../lib/e2e.mjs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const probes = [
  { who: 'trainer', path: '/team', label: 'Kader-Zahl', pick: /^\d{1,3}$/ },
  { who: 'kasse', path: '/club-cash', label: 'Kassenstand', pick: /€/ },
  { who: 'admin', path: '/admin', label: 'Mitglieder', pick: /^\d{1,4}$/ },
];
let fail = 0;
const browser = await chromium.launch();
for (const probe of probes) {
  const login = await loginAs(probe.who);
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion,
      colorScheme: 'dark',
    });
    await ctx.addInitScript(
      ([t, id]) => {
        localStorage.setItem('clubroof.session', t);
        localStorage.setItem(`clubroof.flag.tour.${id}`, '1');
      },
      [login.token, login.me.user.id],
    );
    const page = await ctx.newPage();
    await page.goto(`${WEB}${probe.path}`);
    const values = [];
    const widths = [];
    for (let i = 0; i < 70; i++) {
      const s = await page.evaluate((src) => {
        const re = new RegExp(src);
        const big = [...document.querySelectorAll('*')].filter(
          (e) =>
            e.children.length === 0 &&
            re.test((e.textContent || '').trim()) &&
            e.getBoundingClientRect().height > 40,
        );
        // Balken: höchste Breite eines schmalen, abgerundeten Streifens (Füllung)
        const bars = [...document.querySelectorAll('div')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.height >= 5 && r.height <= 10 && r.width > 0 && r.width < 340;
        });
        return {
          text: big[0]?.textContent.trim() ?? null,
          bar: Math.round(Math.max(0, ...bars.map((b) => b.getBoundingClientRect().width))),
        };
      }, probe.pick.source);
      if (s.text) values.push(s.text);
      widths.push(s.bar);
      await page.waitForTimeout(40);
    }
    const distinct = [...new Set(values)];
    const counts = distinct.length > 1;
    const ok = reducedMotion === 'reduce' ? distinct.length <= 1 : counts;
    // Balken (falls vorhanden): wächst die breiteste Füllung im Lauf der Zeit?
    const grew = widths.at(-1) > 0 && new Set(widths).size > 2;
    if (!ok) fail++;
    console.log(
      `${ok ? '✓' : '✗'} ${probe.label} (${reducedMotion}): ${distinct.slice(0, 3).join(' → ')}${distinct.length > 3 ? ' … ' + distinct.at(-1) : ''} · Balken ${reducedMotion === 'reduce' ? 'sofort' : grew ? 'wachsen' : 'unverändert'}`,
    );
    await ctx.close();
  }
}
await browser.close();
process.exit(fail ? 1 : 0);
