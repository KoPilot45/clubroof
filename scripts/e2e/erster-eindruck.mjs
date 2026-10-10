/**
 * Browserprüfung „Erster Eindruck“: Willkommens-Tour, Zusage mit „Rückgängig“, Offline-Hinweis, leere Zustände.
 * Aufruf: pnpm browser-check scripts/e2e/erster-eindruck.mjs [--no-build]
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

// ── Willkommens-Tour ─────────────────────────────────────────────────────────
const fresh = await b.session('spieler', { tour: true });
await fresh.goto('/');
await text(fresh.page, 'Willkommen bei', {}).waitFor({ timeout: 20_000 });
ok(true, 'Tour erscheint beim ersten Start');
await text(fresh.page, 'Weiter', { exact: true }).click();
ok(
  await text(fresh.page, 'Zu- und Absagen mit einem Tipp', { exact: true }).isVisible(),
  'Weiter zeigt die nächste Karte',
);
await text(fresh.page, 'Überspringen', { exact: true }).click();
await fresh.page.reload();
await fresh.page.waitForTimeout(3000);
ok(
  !(await text(fresh.page, 'Willkommen bei', {})
    .isVisible()
    .catch(() => false)),
  'Nach dem Überspringen kommt die Tour nicht wieder',
);

// ── Zusage mit „Rückgängig“ ──────────────────────────────────────────────────
const s = await b.session('spieler');
const events = await api('/events', s.login.token);
const target = events.find(
  (e) => e.myResponses[0]?.canRespond && e.myResponses[0].status === 'pending',
);
ok(!!target, 'Es gibt einen Termin mit offener Antwort');
if (target) {
  await s.goto(`/events/${target.id}`);
  await button(s.page, 'Zusagen').click();
  await text(s.page, 'Rückgängig', { exact: true }).waitFor({ timeout: 10_000 });
  ok(true, 'Nach der Zusage erscheint „Rückgängig“');
  await text(s.page, 'Rückgängig', { exact: true }).click();
  await s.page.waitForTimeout(1500);
  const after = (await api(`/events/${target.id}`, s.login.token)).myResponses[0].status;
  ok(after === 'pending', 'Rückgängig setzt die Antwort wieder auf offen');
}

// ── Offline-Hinweis ──────────────────────────────────────────────────────────
await s.goto('/team');
await s.page.waitForTimeout(2000);
await s.page.evaluate(() => window.dispatchEvent(new Event('offline')));
await text(s.page, 'Keine Verbindung', {}).waitFor({ timeout: 5_000 });
ok(true, 'Offline-Hinweis erscheint');
await s.page.evaluate(() => window.dispatchEvent(new Event('online')));

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
