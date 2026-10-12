/**
 * Kennzahlen in den Menükacheln (Paket PO, früher Kachel-Infos): kleine Zahl oben rechts statt Infotext darunter.
 * Aufruf: pnpm browser-check scripts/e2e/kachel-infos.mjs [--no-build]
 */
import { api, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
// Beschriftung der Kachel samt Kennzahl: „Termine, 13.10.“
const tile = async (page, name) =>
  (await page
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .filter({ visible: true })
    .first()
    .getAttribute('aria-label')
    .catch(() => null)) ?? '';

const spieler = await b.session('spieler');
await spieler.goto('/team');
await text(spieler.page, 'Kasse', { exact: true }).waitFor({ timeout: 20_000 });
await spieler.page.waitForTimeout(2000);
ok(/€/.test(await tile(spieler.page, 'Kasse')), 'Kasse: Kassenstand als Kennzahl');
ok(
  /\d\d\.\d\d\./.test(await tile(spieler.page, 'Termine')),
  'Termine: Datum des nächsten (TT.MM.)',
);
ok(
  /, \d+$/.test(await tile(spieler.page, 'Kader')) ||
    /Kader, \d+/.test(await tile(spieler.page, 'Kader')),
  'Kader: Zahl der Spieler',
);
const sp = await spieler.page.evaluate(() => document.body.innerText);
ok(
  !/Du hast .* (offen|Guthaben)|Nächster:|Antwort fehlt:/.test(sp),
  'Kein Infotext mehr unter den Kacheln',
);

await spieler.goto('/verein');
await spieler.page.waitForTimeout(2500);
ok(
  /\d\d\.\d\d\./.test(await tile(spieler.page, 'Veranstaltungen')),
  'Veranstaltungen: Datum des nächsten',
);
ok(/\d+$/.test(await tile(spieler.page, 'Mannschaften')), 'Mannschaften: Anzahl');
ok((await spieler.page.getByText('Kacheln anpassen').count()) === 0, '„Kacheln anpassen“ entfällt');

const admin = await b.session('admin');
await admin.goto('/admin/area/mitglieder');
await text(admin.page, 'Personen', { exact: true }).waitFor({ timeout: 20_000 });
await admin.page.waitForTimeout(2000);
ok(
  /Mitglieder, \d+/.test(await tile(admin.page, 'Mitglieder')),
  'Verwaltung (Mitglieder): Mitglieder mit Zahl',
);
await admin.goto('/mehr');
await admin.page.waitForTimeout(2500);
ok(
  (await admin.page.getByRole('button', { name: /^Admin-Verwaltung/ }).count()) > 0,
  'Mehr: Zugang „Admin-Verwaltung“',
);

const me = await api('/me', spieler.login.token);
const teamId = me.teams[0].id;
await admin.goto(`/teams/${teamId}/cash-admin`);
await admin.page.waitForTimeout(3000);
ok(
  (await admin.page.getByText('!', { exact: true }).filter({ visible: true }).count()) > 0,
  'Kassenverwaltung: Kennzahl „!“ (Handlungsbedarf, orange) an der Kachel',
);
ok(
  (await admin.page.getByText('1', { exact: true }).filter({ visible: true }).count()) > 0,
  'Kassenverwaltung: Zahl der Zahlungsmeldungen an der Kachel',
);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
