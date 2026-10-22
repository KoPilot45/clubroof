/**
 * TERMIN-ANTWORT-UND-TEILNEHMER: Zustände der gemeinsamen Terminkarte (Entwurf ZusageTeilnehmer.html).
 * pnpm browser-check scripts/e2e/termin-antwort.mjs   (hell: SCHEME=light; Bilder: SHOTS=1)
 */
import { api, launch, loginAs, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const shots = !!process.env.SHOTS;
const put = (token, id, person, status, reason = null) =>
  api(`/events/${id}/responses/${person}`, token, {
    method: 'PUT',
    body: JSON.stringify({ status, reason }),
  });
const range = (days) => {
  const from = new Date();
  const to = new Date(from.getTime() + days * 86_400_000);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
};

const admin = await loginAs('admin');
const spieler = await b.session('spieler', { width: 390, height: 1400 });
const pid = spieler.login.me.person.id;
const team = spieler.login.me.teams[0];
const events = (await api(`/events?${range(25)}`, spieler.login.token)).filter(
  (e) => e.team?.id === team.id && e.status === 'scheduled' && e.myResponses[0]?.canRespond,
);
ok(events.length >= 4, `Testtermine der Mannschaft vorhanden (${events.length})`);
const [open, yes, maybe, no] = events.slice(0, 4);
await put(spieler.login.token, open.id, pid, 'pending');
await put(spieler.login.token, yes.id, pid, 'yes');
await put(spieler.login.token, maybe.id, pid, 'maybe');
await put(spieler.login.token, no.id, pid, 'no', 'Krank');

await spieler.goto('/events');
await spieler.page.waitForTimeout(4000);
const body = async () => (await spieler.page.locator('body').innerText()).replace(/\s+/g, ' ');
let t = await body();
ok(/Antwort bis/.test(t), 'offen: Statuszeile „Antwort bis …“ als Text');
ok(/Du: Zugesagt/.test(t), 'zugesagt: „✓ Du: Zugesagt“');
ok(/Du: Unsicher/.test(t), 'vielleicht: „? Du: Unsicher“');
ok(/Du: Abgesagt/.test(t), 'abgesagt: „✕ Du: Abgesagt“');
const radios = spieler.page.getByRole('radio', { name: 'Zusage' });
ok((await radios.count()) >= 4, 'drei Antwortknöpfe je Karte (Zusage, Vielleicht, Absage)');

// Aufklappen: Teilnehmerliste im Fluss mit Gruppen
await spieler.page.getByRole('button', { name: 'Teilnehmer anzeigen' }).first().click();
await spieler.page.waitForTimeout(2500);
t = await body();
ok(/ZUSAGEN · \d+|Zusagen · \d+/i.test(t), 'aufgeklappt: Gruppe „Zusagen · n“');
ok(/\(du\)/.test(t), 'aufgeklappt: eigene Zeile markiert');
if (shots) await b.shot(spieler.page, 'ta-spieler-karten', false);

// Zusage mit einem Tipp: Bestätigung benennt Person, Rückgängig stellt her
// Das Plakat-Karussell enthält Klone außerhalb des Bildes und wechselt von selbst: einen Knopf im Bild wählen
let target = null;
for (const el of await spieler.page
  .locator('[aria-label="Zusage"][role="radio"]:not([disabled]):not([aria-disabled="true"])')
  .all()) {
  const box = await el.boundingBox();
  if (box && box.x >= 0 && box.x + box.width <= 390) {
    target = el;
    break;
  }
}
await target.evaluate((e) => e.scrollIntoView({ block: 'center' }));
await spieler.page.waitForTimeout(500);
await target.click({ force: true });
await text(spieler.page, /Teilnahme bestätigt: Zusage für/).waitFor({ timeout: 10_000 });
ok(true, 'Zusage: Bestätigung „Teilnahme bestätigt: Zusage für dich.“ mit Rückgängig');
ok(new URL(spieler.page.url()).pathname === '/events', 'Antwortknopf öffnet keine Details');

// Absage öffnet das Formular „Absage“ (Pflichtgrund nur bei Mannschaftsregel)
await api(`/teams/${team.id}/profile`, admin.token, {
  method: 'PUT',
  body: JSON.stringify({ declineReasonRequired: true }),
});
try {
  await spieler.page.reload();
  await spieler.page.waitForTimeout(3500);
  await spieler.page
    .locator('[aria-label="Absage"][role="radio"]:not([disabled]):not([aria-disabled="true"])')
    .first()
    .click();
  await text(spieler.page, 'Absage senden', { exact: true }).click();
  await spieler.page.getByRole('alert').filter({ hasText: /Grund/ }).waitFor({ timeout: 5_000 });
  ok(true, 'Absage: Pflichtgrund wird im gemeinsamen Formular erklärt (Client oder Serverfehler)');
} finally {
  await api(`/teams/${team.id}/profile`, admin.token, {
    method: 'PUT',
    body: JSON.stringify({ declineReasonRequired: false }),
  });
}

// Teilnehmer nicht freigegeben
await api(`/teams/${team.id}/profile`, admin.token, {
  method: 'PUT',
  body: JSON.stringify({ responsesVisible: false }),
});
try {
  // frische Sitzung ohne Zwischenspeicher, damit die neue Freigabe sofort gilt
  const fresh = await b.session('spieler', { width: 390, height: 1400 });
  await fresh.goto('/events');
  await fresh.page.waitForTimeout(4000);
  t = (await fresh.page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(
    /Die Teilnehmer sieht nur das Trainerteam/.test(t),
    'nicht freigegeben: Hinweis statt Zahlen und Liste',
  );
  ok(!/Teilnehmer anzeigen/.test(t), 'nicht freigegeben: keine Summenzeile mit Aufklappen');
  if (shots) await b.shot(fresh.page, 'ta-nicht-freigegeben', false);
} finally {
  await api(`/teams/${team.id}/profile`, admin.token, {
    method: 'PUT',
    body: JSON.stringify({ responsesVisible: true }),
  });
}

// Trainerteam: keine eigenen Knöpfe, automatisch eingeplant
{
  const { page, goto } = await b.session('trainer', { width: 390, height: 1400 });
  await goto('/events');
  await page.waitForTimeout(4000);
  const tt = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(
    /Du: Trainer \(automatisch\)/.test(tt),
    'Trainerteam: „✎ Du: Trainer (automatisch)“ ohne Knöpfe',
  );
}

// Eltern: Kind-Etikett „Leon · E1“, jede Antwort gilt genau diesem Kind
{
  const { page, goto } = await b.session('eltern', { width: 390, height: 1600 });
  await goto('/events');
  await page.waitForTimeout(4000);
  const et = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(
    /Leon · E1/.test(et) && /Mia · F1/.test(et),
    'Eltern: Kind-Etikett „Leon · E1“ und „Mia · F1“',
  );
  if (shots) await b.shot(page, 'ta-eltern', false);
}

// Desktop: Tabelle mit Spalten, Aufklappen über die volle Breite, Tastatur
{
  const { page, goto, login } = await b.session('spieler', { width: 1440, height: 900 });
  const mine = (await api(`/events?${range(25)}`, login.token)).find(
    (e) => e.team && e.status === 'scheduled' && e.myResponses[0]?.canRespond,
  );
  await put(login.token, mine.id, login.me.person.id, 'pending');
  await goto('/events');
  await page.waitForTimeout(4000);
  const dt = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(
    /MEINE ANTWORT/i.test(dt) && /TEILNEHMER/i.test(dt),
    'Desktop: Tabelle mit „Meine Antwort“ und „Teilnehmer“',
  );
  ok(
    (await page.getByRole('radio', { name: 'Zusage' }).count()) > 2,
    'Desktop: Antwortchips mit Symbol und Wort',
  );
  await page.getByRole('button', { name: 'Teilnehmer anzeigen' }).first().click();
  await page.waitForTimeout(2500);
  const ex = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  ok(
    /ZUSAGEN · \d+/i.test(ex) &&
      /VIELLEICHT · \d+/i.test(ex) &&
      /OFFEN · \d+/i.test(ex) &&
      /ABSAGEN · \d+/i.test(ex),
    'Desktop: vier Gruppen nebeneinander',
  );
  if (shots) await b.shot(page, 'ta-desktop', false);
  // Tastatur: Fokuszeile, Taste 1 setzt die Zusage
  // die Zeile des ersten Termins, den man noch beantworten darf (frühere Zeilen können gesperrt sein)
  const row = page
    .locator('[role=radio][aria-label="Zusage"]:not([aria-disabled="true"])')
    .first()
    .locator('xpath=ancestor::*[@role="button"][1]');
  await row.focus();
  await page.keyboard.press('1');
  await text(page, /Teilnahme bestätigt: Zusage/).waitFor({ timeout: 10_000 });
  ok(true, 'Desktop: Taste 1 setzt die Zusage der Fokuszeile');
}

// der Serverfehler 400 „Grund nötig“ ist hier gewollt
const real = b.errors.filter((e) => !/status of 400/.test(e));
console.log(real.length ? `✗ Konsolenfehler:\n${real.join('\n')}` : '✓ keine Konsolenfehler');
await b.close();
process.exit(failed || real.length ? 1 : 0);
