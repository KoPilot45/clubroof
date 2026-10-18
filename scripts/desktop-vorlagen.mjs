/**
 * Paket DT2: Jede Route unter apps/mobile/src/app braucht eine Seitenvorlage für die Desktop-Ansicht
 * (`apps/mobile/src/lib/desktop-templates.json`). Das Skript schlägt fehl, wenn eine Route fehlt oder übrig ist,
 * und prüft, dass `docs/DESKTOP-VORLAGEN.md` zur Zuordnung passt.
 *   node scripts/desktop-vorlagen.mjs          prüfen
 *   node scripts/desktop-vorlagen.mjs --write  Tabelle in docs/DESKTOP-VORLAGEN.md neu schreiben
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const app = join(root, 'apps/mobile/src/app');
const mapFile = join(root, 'apps/mobile/src/lib/desktop-templates.json');
const docFile = join(root, 'docs/DESKTOP-VORLAGEN.md');

const TEMPLATES = {
  A: 'Liste bzw. Detailseite',
  B: 'Formular (eine Spalte, 720 px, Speichern-Leiste unten)',
  C: 'Tabelle mit Filterleiste',
  D: 'Kachelraster / Übersicht',
  E: 'Assistent (720 px)',
  F: 'Bericht und Diagramme (Spalten)',
  S: 'Sonderfall mit eigenem Entwurf',
  H: 'Hauptseite (Paket DT)',
  U: 'bewusst unverändert',
};

const routes = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.tsx') && !f.startsWith('_layout') && !f.startsWith('+'))
      routes.push(relative(app, p).slice(0, -4));
  }
};
walk(app);
routes.sort();

const map = JSON.parse(readFileSync(mapFile, 'utf8'));
const missing = routes.filter((r) => !map[r]);
const extra = Object.keys(map).filter((r) => !routes.includes(r));
const invalid = Object.entries(map).filter(([, v]) => !TEMPLATES[v.t] || !v.note || !v.status);
const problems = [];
if (missing.length)
  problems.push(`Routen ohne Vorlage in desktop-templates.json:\n  ${missing.join('\n  ')}`);
if (extra.length) problems.push(`Einträge ohne Route:\n  ${extra.join('\n  ')}`);
if (invalid.length)
  problems.push(
    `Ungültige Einträge (Vorlage, Notiz, Status):\n  ${invalid.map(([r]) => r).join('\n  ')}`,
  );

const table = [
  '# Desktop-Vorlagen (Paket DT2)',
  '',
  'Erzeugt aus `apps/mobile/src/lib/desktop-templates.json` mit `node scripts/desktop-vorlagen.mjs --write`; nicht von Hand ändern.',
  'Jede Route unter `apps/mobile/src/app` hat eine Vorlage; `pnpm check` prüft die Vollständigkeit.',
  '',
  '| Kürzel | Vorlage |',
  '| ------ | ------- |',
  ...Object.entries(TEMPLATES).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  'Status: **fertig** = Seite für den Desktop umgesetzt, **Breite** = nur die Breite der Vorlage (Inhalt wie auf dem Handy), **offen** = noch zuzuordnen.',
  '',
  '| Route | Vorlage | Status | Notiz |',
  '| ----- | ------- | ------ | ----- |',
  ...routes
    .filter((r) => map[r])
    .map((r) => `| \`${r}\` | ${map[r].t} | ${map[r].status} | ${map[r].note} |`),
  '',
].join('\n');

if (process.argv.includes('--write')) {
  writeFileSync(docFile, table);
  console.log(`docs/DESKTOP-VORLAGEN.md geschrieben (${routes.length} Routen).`);
} else {
  let current = '';
  try {
    current = readFileSync(docFile, 'utf8');
  } catch {
    /* fehlt */
  }
  if (current !== table)
    problems.push(
      'docs/DESKTOP-VORLAGEN.md passt nicht zur Zuordnung: node scripts/desktop-vorlagen.mjs --write',
    );
}
if (problems.length) {
  console.error(problems.join('\n\n'));
  process.exit(1);
}
const count = (t) => routes.filter((r) => map[r].t === t).length;
console.log(
  `Alle ${routes.length} Routen haben eine Desktop-Vorlage (${Object.keys(TEMPLATES)
    .map((k) => `${k} ${count(k)}`)
    .join(', ')}).`,
);
