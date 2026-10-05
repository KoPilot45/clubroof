/**
 * Startet Backend und App gemeinsam in einem Fenster (statt zwei Terminals).
 * Aufruf: pnpm dev   ·   Beenden mit Strg + C
 */
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const processes = [
  { name: 'API', color: '\x1b[36m', args: ['--filter', '@clubroof/api', 'dev'] },
  { name: 'APP', color: '\x1b[35m', args: ['--filter', '@clubroof/mobile', 'web'] },
];

// E-Mails (Einladungen, Passwort vergessen) landen lokal im Test-Postfach Mailpit
const env = {
  ...process.env,
  SMTP_URL: process.env.SMTP_URL ?? 'smtp://localhost:1025',
  APP_URL: process.env.APP_URL ?? 'http://localhost:8081',
};

const children = processes.map(({ name, color, args }) => {
  const child = spawn('pnpm', args, { shell: isWindows, stdio: ['ignore', 'pipe', 'pipe'], env });
  const prefix = (line) => `${color}[${name}]\x1b[0m ${line}`;
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) console.log(prefix(line));
    });
  }
  child.on('exit', (code) => {
    console.log(prefix(`beendet (Code ${code ?? 'unbekannt'})`));
    stop();
  });
  return child;
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) {
      if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f']);
      else child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log('\nClubroof startet. API: http://localhost:3000 · App: http://localhost:8081');
console.log('Beenden mit Strg + C.\n');
