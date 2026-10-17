/** Prüft, ob die Bewegung (Hochzählen, Einblenden, Gedrückt-Zustand) in der Web-App läuft – mit und ohne „Bewegung reduzieren“ */
import { launch, loginAs, WEB } from '../lib/e2e.mjs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const login = await loginAs('trainer');
const browser = await chromium.launch();
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
  await page.goto(`${WEB}/team`);
  const samples = [];
  for (let i = 0; i < 60; i++) {
    samples.push(
      await page.evaluate(() => {
        const nums = [...document.querySelectorAll('*')]
          .filter(
            (e) =>
              e.children.length === 0 &&
              /^\d{1,3}$/.test((e.textContent || '').trim()) &&
              e.getBoundingClientRect().height > 40,
          )
          .map((e) => e.textContent.trim());
        const ops = [...document.querySelectorAll('div')]
          .map((e) => +getComputedStyle(e).opacity)
          .filter((o) => o > 0 && o < 1).length;
        return { bigNumbers: nums.slice(0, 3).join('/'), halbtransparent: ops };
      }),
    );
    await page.waitForTimeout(40);
  }
  const nz = samples.map((s) => s.bigNumbers).filter(Boolean);
  console.log(reducedMotion, 'Zahlenfolge:', [...new Set(nz)].join(' → '));
  await ctx.close();
}
await browser.close();
