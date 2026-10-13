/** Heller Stil für das PDF (mit SCHEME=light starten) */
import { launch } from '../lib/e2e.mjs';
const b = await launch();
const { page, goto } = await b.session('trainer');
for (const [p, n] of [['/', 'hell-home'], ['/verein', 'hell-verein'], ['/team', 'hell-team']]) {
  await goto(p); await page.waitForTimeout(2800);
  await page.screenshot({ path: `.check/pdf/${n}.png` });
}
await b.close();
