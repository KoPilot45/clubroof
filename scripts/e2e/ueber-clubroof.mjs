/** Über Clubroof (Mehr): Menüpunkte, Textseiten, Privatsphäre, Changelog. */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto } = await b.session('spieler');
const wait = (t, o = {}) => text(page, t, o).waitFor({ timeout: 15_000 });

await goto('/mehr');
await wait('Über Clubroof');
for (const l of [
  'AGB',
  'Datenschutz',
  'Privatsphäre-Einstellungen',
  'Impressum',
  'Changelog',
  'Support',
  'Funktion anfragen',
])
  await wait(l, { exact: true });
console.log('✓ alle sieben Menüpunkte');

await text(page, 'AGB', { exact: true }).click();
await wait('1. Geltungsbereich');
await wait('Beispielinhalt');
console.log('✓ AGB mit Beispielhinweis');

await goto('/about/impressum');
await wait('Anbieter');
await goto('/about/changelog');
await wait('Version 0.3');
console.log('✓ Impressum und Changelog');

await goto('/about/privacy');
await wait('Sichtbarkeit meiner Kontaktdaten');
await text(page, 'Benachrichtigungen', { exact: true }).click();
await page.waitForURL(/notification-settings/, { timeout: 15_000 });
console.log('✓ Privatsphäre verlinkt Einstellungen');

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(b.errors.length ? 1 : 0);
