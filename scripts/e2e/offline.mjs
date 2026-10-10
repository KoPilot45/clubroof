/** Browserprüfung Offline-Lesen: Daten laden, Server „abschalten“, App neu starten, gespeicherte Inhalte sehen. */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const s = await b.session('spieler');
await s.goto('/');
await text(s.page, 'Neuigkeiten für dich', {}).waitFor({ timeout: 20_000 });
await s.page.waitForTimeout(4000); // Speichern ist gedrosselt
ok(
  await s.page.evaluate(() => !!localStorage.getItem('clubroof.offline')),
  'Daten wurden auf dem Gerät gespeichert',
);

// Server nicht erreichbar
await s.page.route(/:3999\//, (route) => route.abort());
await s.page.reload();
await text(s.page, 'Neuigkeiten für dich', {}).waitFor({ timeout: 20_000 });
ok(true, 'Ohne Verbindung zeigt Home die gespeicherten Neuigkeiten');
await text(s.page, 'Keine Verbindung', {}).waitFor({ timeout: 10_000 });
ok(true, 'Der Offline-Hinweis erscheint');

// Abmelden löscht den Zwischenspeicher: Seite online öffnen, Kontotab → Abmelden
await s.page.unroute(/:3999\//);
await s.goto('/mehr');
await text(s.page, 'Abmelden', { exact: true }).waitFor({ timeout: 20_000 });
await text(s.page, 'Abmelden', { exact: true }).click();
await s.page.waitForURL(/login/, { timeout: 15_000 }).catch(() => undefined);
ok(
  await s.page.evaluate(() => !localStorage.getItem('clubroof.offline')),
  'Nach dem Abmelden ist der Zwischenspeicher gelöscht',
);
await b.close();
console.log(
  b.errors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e)).join('\n') ||
    '✓ keine Konsolenfehler (Verbindungsfehler im Offline-Test ausgenommen)',
);
if (failed) process.exit(1);
