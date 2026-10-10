/**
 * Browserprüfung Kachel-Infos: Hinweise in den Menükacheln je Rolle (Text, nicht Bild).
 * Aufruf: pnpm browser-check scripts/e2e/kachel-infos.mjs [--no-build]
 */
import { api, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const body = (page) => page.evaluate(() => document.body.innerText);

const spieler = await b.session('spieler');
await spieler.goto('/team');
await text(spieler.page, 'Kasse', { exact: true }).waitFor({ timeout: 20_000 });
await spieler.page.waitForTimeout(1500);
const sp = await body(spieler.page);
ok(
  /Du hast .* (offen|Guthaben)|Ausgeglichen/.test(sp),
  'Spieler sieht den eigenen Kassenstand in der Kachel „Kasse“',
);
ok(
  /Nächster:|Antwort fehlt:/.test(sp),
  'Kachel „Termine“ zeigt den nächsten Termin oder fehlende Antwort',
);

const admin = await b.session('admin');
await admin.goto('/admin');
await text(admin.page, 'Mitglieder', { exact: true }).waitFor({ timeout: 20_000 });
await admin.page.waitForTimeout(1500);
ok(
  /aktive Mitglieder/.test(await body(admin.page)),
  'Verwaltung zeigt „aktive Mitglieder“ in der Kachel',
);
await admin.goto('/mehr');
await admin.page.waitForTimeout(2500);
ok(/offene Aufgaben/.test(await body(admin.page)), 'Mehr → Verwaltung zeigt „offene Aufgaben“');

const trainerMe = await api('/me', admin.login.token).then(() => api('/me', spieler.login.token));
const teamId = trainerMe.teams[0].id;
await admin.goto(`/teams/${teamId}/cash-admin`);
await admin.page.waitForTimeout(3000);
const k = await body(admin.page);
ok(
  /Zahlungsmeldungen|Offen gesamt|Bezahlinfos fehlen/.test(k),
  'Kassenverwaltung zeigt Hinweise an den Kacheln',
);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
