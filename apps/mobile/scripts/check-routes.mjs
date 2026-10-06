/**
 * Prüft, dass jeder Bildschirm unter src/app im passenden Layout registriert ist. Nicht
 * registrierte Bildschirme erben `headerShown: false` – ihnen fehlt dann die Kopfzeile mit „Zurück“.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const app = new URL('../src/app/', import.meta.url).pathname;
const names = (file) =>
  new Set([...readFileSync(join(app, file), 'utf8').matchAll(/name="([^"]+)"/g)].map((m) => m[1]));
const layouts = {
  '': names('_layout.tsx'),
  'admin/': names('admin/_layout.tsx'),
  '(tabs)/': names('(tabs)/_layout.tsx'),
};

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.tsx') && !f.startsWith('_layout'))
      files.push(relative(app, p).slice(0, -4));
  }
};
walk(app);

const missing = files.filter((route) => {
  const prefix = ['admin/', '(tabs)/'].find((x) => route.startsWith(x)) ?? '';
  return !layouts[prefix].has(route.slice(prefix.length));
});
if (missing.length) {
  console.error(`Bildschirme ohne Eintrag im Layout (keine Kopfzeile):\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`Alle ${files.length} Bildschirme sind registriert.`);
