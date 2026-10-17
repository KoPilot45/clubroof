#!/usr/bin/env node
/**
 * Feste Farben außerhalb des Themes (Paket LH2): zählt Farbwerte (#hex, rgb/rgba, 'white'/'black') je Datei in
 * apps/mobile/src und vergleicht mit scripts/farben-basis.json. Neue Werte lassen `pnpm check` scheitern: erst
 * Theme-Wert verwenden (`useTheme`); nur auf Hero, Plakat, Kopfband, Spielfeld oder Marke darf eine Farbe fest
 * bleiben – dann mit `node scripts/farben-pruefung.mjs --update` in die Basis aufnehmen (und im Commit begründen).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const basisFile = join(root, 'scripts/farben-basis.json');
const COLOR = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|['"](?:white|black)['"]/g;
const SKIP = /help-content|\.test\./;

const counts = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !SKIP.test(p)) {
      const n = (readFileSync(p, 'utf8').match(COLOR) ?? []).length;
      if (n) counts[relative(root, p)] = n;
    }
  }
})(join(root, 'apps/mobile/src'));

if (process.argv.includes('--update')) {
  writeFileSync(basisFile, JSON.stringify(counts, null, 2) + '\n');
  console.log(`Basis aktualisiert: ${Object.keys(counts).length} Dateien.`);
  process.exit(0);
}
const basis = JSON.parse(readFileSync(basisFile, 'utf8'));
const problems = Object.entries(counts)
  .filter(([f, n]) => n > (basis[f] ?? 0))
  .map(([f, n]) => `${f}: ${n} feste Farben (erlaubt ${basis[f] ?? 0})`);
if (problems.length) {
  console.error(
    `✗ Neue feste Farben außerhalb des Themes:\n${problems.join('\n')}\n` +
      'Theme-Wert aus useTheme() nehmen; nur auf Hero/Plakat/Kopfband/Spielfeld/Marke fest lassen und dann ' +
      '`node scripts/farben-pruefung.mjs --update` ausführen.',
  );
  process.exit(1);
}
console.log('✓ keine neuen festen Farben');
