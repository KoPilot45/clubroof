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

await goto('/');
await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
// Server nicht erreichbar (Anfragen schlagen sofort fehl)
await page.route(/:3999\//, (route) => route.abort());
await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await text(page, 'Du bist offline').waitFor({ timeout: 10_000 });

await button(page, 'Zusagen').click();
await text(page, /wird gesendet, sobald du wieder online bist/)
  .first()
  .waitFor({ timeout: 10_000 });
ok(true, 'Offline: Hinweis „wird gesendet, sobald du wieder online bist“');
ok(await button(page, 'Zugesagt').isVisible(), 'Offline: Antwort erscheint sofort als „Zugesagt“');
const stored = await page.evaluate(() => localStorage.getItem('clubroof.outbox'));
ok(!!stored && stored.includes(match.id), 'Offline: Rückmeldung auf dem Gerät gemerkt');
const still = await api(`/home`, login.token);
ok(
  still.matches.find((m) => m.id === match.id).myResponses[0].status === 'pending',
  'Offline: Server kennt die Antwort noch nicht',
);

await page.unroute(/:3999\//);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await text(page, /Rückmeldung gesendet/).waitFor({ timeout: 15_000 });
ok(true, 'Online: Meldung „Rückmeldung gesendet“');
const after = await api('/home', login.token);
ok(
  after.matches.find((m) => m.id === match.id).myResponses[0].status === 'yes',
  'Online: Zusage beim Server angekommen',
);
const emptied = await page.evaluate(() => localStorage.getItem('clubroof.outbox'));
ok(!emptied || !emptied.includes(match.id) || emptied === '[]', 'Online: Warteschlange geleert');
await put('pending');

ok(
  b.errors.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e)).length === 0,
  'keine unerwarteten Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
