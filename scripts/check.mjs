#!/usr/bin/env node
/**
 * Prüflauf mit knapper Ausgabe: eine Zeile je Schritt, bei Fehlern nur die relevanten Zeilen.
 * Die vollständige Ausgabe liegt in .check/<schritt>.log (nicht eingecheckt).
 *
 *   pnpm check                      Lint, Typprüfung und alle Tests (vor jedem Commit)
 *   pnpm check --only=test          nur einzelne Schritte (lint, typecheck, test)
 *   pnpm check --grep="Kasse"       nur API-Tests, deren Name passt (schnell beim Entwickeln)
 *   pnpm check --routes             vorher die typisierten App-Routen neu erzeugen
 *                                   (nötig nach neuen Bildschirmen, sonst meldet tsc Fehler)
 *
 * Kümmert sich selbst um die Datenbank: startet PostgreSQL, falls es nicht läuft, und setzt
 * DATABASE_URL, damit die Datenbanktests nie versehentlich übersprungen werden.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = (opt('only') ?? 'lint,typecheck,test').split(',');
const grep = opt('grep');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://clubroof:clubroof@localhost:5432/clubroof';
const env = { ...process.env, DATABASE_URL, FORCE_COLOR: '0', NO_COLOR: '1' };

function dbReachable() {
  const { hostname, port } = new URL(DATABASE_URL);
  const r = spawnSync('pg_isready', ['-h', hostname, '-p', port || '5432'], {
    encoding: 'utf8',
  });
  if (r.error) return null; // pg_isready nicht installiert
  return r.status === 0;
}

/** PostgreSQL bereitstellen (Cloud-Container: Dienst starten; sonst Hinweis auf Docker). */
function ensureDatabase() {
  if (dbReachable() !== false) return;
  spawnSync('service', ['postgresql', 'start'], { stdio: 'ignore' });
  spawnSync('sleep', ['2']);
  if (dbReachable() === false) {
    console.error(
      '✗ Datenbank nicht erreichbar. Lokal: pnpm db:up (Docker) – oder PostgreSQL starten.',
    );
    process.exit(2);
  }
}

function run(label, cmd, cmdArgs, cwd = root, timeoutMs = 20 * 60_000) {
  mkdirSync(join(root, '.check'), { recursive: true });
  const logFile = join(root, '.check', `${label.replace(/\W+/g, '-')}.log`);
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd, env });
    let out = '';
    const collect = (d) => (out += d);
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      writeFileSync(logFile, out);
      resolve({ label, code, out, logFile, seconds: Math.round((Date.now() - started) / 1000) });
    });
  });
}

/** Nur die aussagekräftigen Zeilen eines fehlgeschlagenen Laufs. */
function excerpt(out) {
  const lines = out.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  const keep = lines.filter((l) =>
    /error|✗|×|FAIL|AssertionError|Expected|Received|expected|\.tsx?:\d+|Error:/i.test(l),
  );
  return (keep.length ? keep : lines.slice(-25)).slice(0, 40).join('\n');
}

function summary(out) {
  const text = out.replace(/\x1b\[[0-9;]*m/g, '');
  const tests = [...text.matchAll(/Tests\s+(?:(\d+) failed \| )?(\d+) passed/g)];
  const total = tests.reduce((a, m) => a + Number(m[2]), 0);
  const failed = tests.reduce((a, m) => a + Number(m[1] ?? 0), 0);
  const skipped = [...text.matchAll(/(\d+) skipped/g)].reduce((a, m) => a + Number(m[1]), 0);
  return { total, failed, skipped };
}

let failed = false;
const report = (r, extra = '') => {
  console.log(`${r.code === 0 ? '✓' : '✗'} ${r.label} (${r.seconds} s)${extra}`);
  if (r.code !== 0) {
    failed = true;
    console.log(excerpt(r.out));
    console.log(`  → vollständig: ${r.logFile}`);
  }
};

if (args.includes('--routes')) {
  // Routen-Typen entstehen beim Start des Expo-Servers; nach 40 s wird er beendet
  await run(
    'routes',
    'sh',
    ['-c', 'CI=1 timeout 40 npx expo start --offline --port 8099 || true'],
    join(root, 'apps/mobile'),
    90_000,
  );
  console.log('✓ Routen-Typen erzeugt');
}

if (only.includes('lint')) report(await run('lint', 'pnpm', ['lint']));
if (only.includes('typecheck')) report(await run('typecheck', 'pnpm', ['typecheck']));
if (only.includes('test')) {
  ensureDatabase();
  const r = grep
    ? await run('test (API, Auswahl)', 'pnpm', [
        '--filter',
        '@clubroof/api',
        'exec',
        'vitest',
        'run',
        '-t',
        grep,
      ])
    : await run('test', 'pnpm', ['test', '--force']); // nie aus dem Cache, Tests hängen an der Datenbank
  const s = summary(r.out);
  report(r, ` – ${s.total} Tests bestanden${s.failed ? `, ${s.failed} fehlgeschlagen` : ''}`);
  // Die API-Tests laden die Demodaten mit festem Datum in die Entwicklungsdatenbank:
  // danach wieder auf „heute“ zurücksetzen, sonst stimmen Kader und Termine in der App nicht
  if (r.code === 0) {
    const reset = await run('db-reset', 'pnpm', ['db:reset']);
    console.log(
      reset.code === 0
        ? '✓ Demodaten zurückgesetzt'
        : '✗ db:reset fehlgeschlagen (siehe .check/db-reset.log)',
    );
    if (reset.code !== 0) failed = true;
  }
  // Übersprungene API-Tests sind meist ein Zeichen für eine fehlende Datenbank
  if (!grep && s.skipped > 0) {
    console.log(
      `⚠ ${s.skipped} Tests übersprungen – Datenbank erreichbar? (DATABASE_URL=${DATABASE_URL})`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(
  grep ? '✓ Auswahl bestanden – vor dem Commit einmal ohne --grep prüfen.' : '✓ Alles bestanden.',
);
