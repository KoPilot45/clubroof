/**
 * Design „Anstoß“: Home in Blau, Rot und Gelb (Vergleich mit DarkHomeBlau/Rot/Gelb). Stellt Grün danach wieder ein.
 * pnpm browser-check scripts/e2e/anstoss-farben.mjs --no-build
 */
import { api, launch } from '../lib/e2e.mjs';

const b = await launch();
const admin = await b.session('admin');
const { page, goto } = await b.session('eltern', { width: 390, height: 1100 });
const set = (colorTheme) =>
  api('/admin/club', admin.login.token, { method: 'PATCH', body: JSON.stringify({ colorTheme }) });
try {
  for (const c of ['blue', 'red', 'yellow']) {
    await set(c);
    await goto('/');
    await page.waitForTimeout(2500);
    await b.shot(page, `farbe-${c}`, false);
  }
} finally {
  await set('green');
}
console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
