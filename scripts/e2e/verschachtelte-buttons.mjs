/** Prüft, dass in der Termintabelle keine Schaltfläche in einer Schaltfläche steckt (HTML-Fehler / Hydration). */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto } = await b.session('trainer', { width: 1400, height: 900 });
await goto('/events');
await text(page, 'Teilnehmer').waitFor({ timeout: 20_000 });
const nested = await page.evaluate(() => document.querySelectorAll('button button, [role=button] [role=button]').length);
console.log(nested === 0 ? '✓ keine verschachtelten Schaltflächen' : `✗ ${nested} verschachtelte Schaltflächen`);
// Zeile öffnet weiterhin den Termin
await page.locator('[aria-label*=", "][role=button]').first().click({ position: { x: 30, y: 10 } });
await page.waitForURL(/\/events\//, { timeout: 10_000 });
console.log('✓ Zeile öffnet den Termin');
const bad = b.errors.filter((e) => /descendant|nested/.test(e));
console.log(bad.length ? `✗ ${bad.join('\n')}` : '✓ keine HTML-Verschachtelungsfehler');
await b.close();
process.exit(nested || bad.length ? 1 : 0);
