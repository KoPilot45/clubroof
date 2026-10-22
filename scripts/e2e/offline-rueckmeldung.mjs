/**
 * Offline-Warteschlange: Zusage ohne Netz wird gemerkt, angezeigt und beim Wiederverbinden gesendet.
 * Aufruf: pnpm browser-check scripts/e2e/offline-rueckmeldung.mjs
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};
const { page, login, goto } = await b.session('spieler');
const home = await api('/home', login.token);
const match = home.matches.find(
  (m) => m.myResponses.length === 1 && m.myResponses[0].canRespond && m.status === 'scheduled',
);
if (!match) {
  console.log('– Demodaten: kein Spiel mit Rückmeldung für den Spieler');
  await b.close();
  process.exit(0);
}
const personId = match.myResponses[0].personId;
const put = (status) =>
  api(`/events/${match.id}/responses/${personId}`, login.token, {
    method: 'PUT',
    body: JSON.stringify({ status, reason: null }),
  });
await put('pending');
// Alle antwortbaren Termine der nächsten Wochen auf „offen“, damit die erste Karte sicher eine offene ist
const range = `from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 21 * 86_400_000).toISOString())}`;
const before = [];
for (const e of await api(`/events?${range}`, login.token)) {
  for (const r of e.myResponses.filter((x) => x.canRespond && x.status !== 'pending')) {
    before.push({ id: e.id, personId: r.personId, status: r.status, reason: r.reason ?? null });
    await api(`/events/${e.id}/responses/${r.personId}`, login.token, {
      method: 'PUT',
      body: JSON.stringify({ status: 'pending', reason: null }),
    });
  }
}

await goto('/');
await text(page, 'Diese Woche').waitFor({ timeout: 20_000 });
// Server nicht erreichbar (Anfragen schlagen sofort fehl)
await page.route(/:3999\//, (route) => route.abort());
await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await text(page, 'Du bist offline').waitFor({ timeout: 10_000 });

// seit der neuen Terminkarte sind die Antworten Radioknöpfe „Zusage“; den ersten antwortbaren nehmen
await page
  .locator('[aria-label="Zusage"][role="radio"]:not([disabled]):not([aria-disabled="true"])')
  .first()
  .click();
await text(page, /wird gesendet, sobald du wieder online bist/)
  .first()
  .waitFor({ timeout: 10_000 });
ok(true, 'Offline: Hinweis „wird gesendet, sobald du wieder online bist“');
ok(
  await text(page, 'Wird gesendet', { exact: true }).isVisible(),
  'Offline: Karte zeigt sofort „Wird gesendet“ (Antwort gesperrt, bis sie ankommt)',
);
const stored = await page.evaluate(() => localStorage.getItem('clubroof.outbox'));
// beantwortet wurde die erste antwortbare Karte der Seite – ihren Termin der Warteschlange entnehmen
const queued = stored ? JSON.parse(stored)[0] : null;
const eventId = queued?.eventId ?? match.id;
const statusOf = async () =>
  (await api(`/events/${eventId}`, login.token)).myResponses.find((r) => r.personId === personId)
    ?.status;
ok(!!queued, 'Offline: Rückmeldung auf dem Gerät gemerkt');
ok((await statusOf()) === 'pending', 'Offline: Server kennt die Antwort noch nicht');

await page.unroute(/:3999\//);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await text(page, /Rückmeldung gesendet/).waitFor({ timeout: 15_000 });
ok(true, 'Online: Meldung „Rückmeldung gesendet“');
ok((await statusOf()) === 'yes', 'Online: Zusage beim Server angekommen');
const emptied = await page.evaluate(() => localStorage.getItem('clubroof.outbox'));
ok(!emptied || !emptied.includes(eventId) || emptied === '[]', 'Online: Warteschlange geleert');
await api(`/events/${eventId}/responses/${personId}`, login.token, {
  method: 'PUT',
  body: JSON.stringify({ status: 'pending', reason: null }),
});
await put('pending');
// ursprüngliche Antworten wiederherstellen
for (const r of before)
  await api(`/events/${r.id}/responses/${r.personId}`, login.token, {
    method: 'PUT',
    body: JSON.stringify({ status: r.status, reason: r.reason }),
  }).catch(() => {});

ok(
  b.errors.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e)).length === 0,
  'keine unerwarteten Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
