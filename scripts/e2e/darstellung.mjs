/**
 * Paket LH: Darstellung wählen (Hell, Dunkel, Wie Gerät), je Gerät gespeichert.
 * pnpm browser-check scripts/e2e/darstellung.mjs --no-build
 */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto } = await b.session('eltern', { width: 390, height: 900 });
let fail = false;

/** Hintergrundfarbe der Seite: größte Fläche mit deckender Farbe */
const background = () =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll('div')].filter((e) => {
      const r = e.getBoundingClientRect();
      const c = getComputedStyle(e).backgroundColor;
      return r.width >= 380 && r.height >= 600 && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent';
    });
    return els.length ? getComputedStyle(els[0]).backgroundColor : null;
  });
const lum = (css) => {
  const m = css?.match(/\d+/g)?.map(Number);
  return m ? (m[0] + m[1] + m[2]) / 3 : null;
};
const check = (label, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) fail = true;
};

await goto('/account');
await text(page, 'Darstellung').waitFor({ timeout: 15_000 });
check('Standard „Wie Gerät“ folgt dem dunklen Gerät', lum(await background()) < 60);

await text(page, 'Hell', { exact: true }).click();
await page.waitForTimeout(500);
check('„Hell“ macht den Hintergrund hell', lum(await background()) > 200);
await page.reload();
await text(page, 'Darstellung').waitFor({ timeout: 15_000 });
await page.waitForTimeout(500);
check('die Wahl bleibt nach dem Neuladen (je Gerät)', lum(await background()) > 200);

await text(page, 'Dunkel', { exact: true }).click();
await page.waitForTimeout(500);
check('„Dunkel“ macht den Hintergrund dunkel', lum(await background()) < 60);

await text(page, 'Wie Gerät', { exact: true }).click();
await page.waitForTimeout(500);
check('„Wie Gerät“ folgt wieder dem Gerät', lum(await background()) < 60);

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(fail || b.errors.length ? 1 : 0);
