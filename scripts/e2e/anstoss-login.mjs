/**
 * Design „Anstoß“: Anmeldung aufnehmen (Vergleich mit DarkLogin1/2).
 * pnpm browser-check scripts/e2e/anstoss-login.mjs --no-build
 */
import { launch } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto } = await b.anonymous({ width: 390, height: 844 });
await goto('/login');
await page.waitForTimeout(2000);
await b.shot(page, 'login', false);
console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
