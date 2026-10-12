/**
 * Design „Anstoß“: Hauptmenü-Seiten in Referenzgröße aufnehmen (zum Vergleich mit docs/design/anstoss).
 * pnpm browser-check scripts/e2e/anstoss-menue.mjs --no-build   → Bilder in .check/shots/menue-*.png
 */
import { launch } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto } = await b.session(process.env.WHO ?? 'trainer', { width: 390, height: 1700 });
for (const [name, path] of [
  ['home', '/'],
  ['team', '/team'],
  ['termine', '/termine'],
  ['verein', '/verein'],
  ['mehr', '/mehr'],
]) {
  await goto(path);
  await page.waitForTimeout(1500);
  await b.shot(page, `menue-${process.env.WHO ?? 'trainer'}-${name}`, false);
}
console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
