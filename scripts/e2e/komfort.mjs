/** Browserprüfung Komfort: Schriftgröße im Konto ändern wirkt auf Texte und bleibt nach dem Neuladen. */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const s = await b.session('spieler');
await s.goto('/account');
const heading = text(s.page, 'Schriftgröße', { exact: true });
await heading.waitFor({ timeout: 20_000 });
const size = () =>
  text(s.page, 'So sieht ein normaler Text in dieser Größe aus.', {}).evaluate((n) =>
    parseFloat(getComputedStyle(n).fontSize),
  );
const normal = await size();
await text(s.page, 'Sehr groß', { exact: true }).click();
await s.page.waitForTimeout(500);
const big = await size();
ok(big > normal * 1.2, `Sehr groß vergrößert die Schrift (${normal}px → ${big}px)`);
await s.page.reload();
await heading.waitFor({ timeout: 20_000 });
await s.page.waitForTimeout(800);
ok((await size()) > normal * 1.2, 'Die Einstellung bleibt nach dem Neuladen erhalten');
await text(s.page, 'Normal', { exact: true }).click();
await s.page.waitForTimeout(500);
ok(Math.abs((await size()) - normal) < 0.5, 'Normal stellt die Ausgangsgröße wieder her');
await b.close();
console.log(b.errors.join('\n') || '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
