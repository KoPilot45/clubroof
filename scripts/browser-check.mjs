#!/usr/bin/env node
/**
 * Browserprüfung der Web-App: baut die Web-Version, startet API und Web-Server und führt
 * optional ein Playwright-Skript aus. Räumt danach auf.
 *
 *   pnpm browser-check                         baut, startet, prüft den Startbildschirm
 *   pnpm browser-check mein-test.mjs           führt ein eigenes Skript aus
 *   pnpm browser-check --no-build              Web-Export überspringen (nur API-Änderungen)
 *   pnpm browser-check --reset                 vorher Demodaten neu laden (pnpm db:reset)
 *   pnpm browser-check --keep                  Server nach dem Lauf weiterlaufen lassen
 *
 * Eigene Skripte importieren Hilfen aus ./lib/e2e.mjs (launch, loginAs, text, button) und sollten
 * Bilder nur mit shot() speichern, wenn sie wirklich gebraucht werden. Rückgabewert ≠ 0 bei Fehlern
 * in der Browser-Konsole.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const script = args.find((a) => !a.startsWith('--'));
const API_PORT = 3999;
const WEB_PORT = 8081;
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://clubroof:clubroof@localhost:5432/clubroof';
const env = { ...process.env, DATABASE_URL };

const sh = (cmd, cmdArgs, cwd = root, extra = {}) =>
  spawnSync(cmd, cmdArgs, { cwd, env: { ...env, ...extra }, encoding: 'utf8' });

// Datenbank bereitstellen (Cloud-Container); lokal läuft sie über Docker
if (spawnSync('pg_isready', ['-h', 'localhost'], { encoding: 'utf8' }).status === 1) {
  sh('service', ['postgresql', 'start']);
  sh('sleep', ['2']);
}

if (flag('reset')) {
  const r = sh('pnpm', ['db:reset']);
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(2);
  }
  console.log('✓ Demodaten neu geladen');
}

const dist = join(root, 'apps/mobile/dist');
if (!flag('no-build') || !existsSync(dist)) {
  const r = sh('npx', ['expo', 'export', '--platform', 'web'], join(root, 'apps/mobile'), {
    EXPO_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
  });
  if (r.status !== 0) {
    console.error((r.stderr || r.stdout).split('\n').slice(-25).join('\n'));
    process.exit(2);
  }
  console.log('✓ Web-Version gebaut');
}

// Alte API-Prozesse beenden, neue starten
spawnSync('sh', ['-c', 'pkill -f "tsx.*src/index.ts" || true']);
const api = spawn('npx', ['tsx', '--env-file-if-exists=../../.env', 'src/index.ts'], {
  cwd: join(root, 'apps/api'),
  env: { ...env, PORT: String(API_PORT), JOBS_ENABLED: 'false' },
  stdio: 'ignore',
  detached: true,
});
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://localhost:${API_PORT}/health`)).ok) break;
  } catch {
    /* noch nicht bereit */
  }
  await new Promise((r) => setTimeout(r, 500));
  if (i === 59) {
    console.error('✗ API startet nicht');
    process.exit(2);
  }
}
console.log(`✓ API läuft (Port ${API_PORT})`);

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};
const web = createServer((req, res) => {
  let p = join(dist, decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(dist, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
});
web.on('error', (e) => {
  console.error(
    `✗ Web-Server: ${e.code === 'EADDRINUSE' ? `Port ${WEB_PORT} ist belegt (alter Server läuft noch?)` : e.message}`,
  );
  process.exit(2);
});
web.listen(WEB_PORT);
console.log(`✓ Web-App läuft (http://localhost:${WEB_PORT})`);

let code = 0;
try {
  if (script) {
    // asynchron starten – der Web-Server läuft in diesem Prozess und darf nicht blockieren
    code = await new Promise((done) => {
      const child = spawn('node', [resolve(script)], {
        cwd: root,
        env: {
          ...env,
          CLUBROOF_WEB: `http://localhost:${WEB_PORT}`,
          CLUBROOF_API: `http://localhost:${API_PORT}`,
        },
        stdio: 'inherit',
      });
      child.on('close', (c) => done(c ?? 1));
    });
  } else {
    // Mindestprüfung: Anmeldeseite lädt ohne Konsolenfehler, Demo-Login funktioniert
    const { launch, loginAs, text } = await import('./lib/e2e.mjs');
    const b = await launch();
    const { page, goto } = await b.session('trainer');
    await goto('/');
    await text(page, 'Hallo,').waitFor({ timeout: 20_000 });
    await loginAs('admin');
    console.log(
      b.errors.length
        ? `✗ Konsolenfehler:\n${b.errors.join('\n')}`
        : '✓ Start und Anmeldung ohne Konsolenfehler',
    );
    code = b.errors.length ? 1 : 0;
    await b.close();
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  code = 1;
}
if (!flag('keep')) {
  web.close();
  try {
    process.kill(-api.pid);
  } catch {
    api.kill();
  }
}
process.exit(code);
