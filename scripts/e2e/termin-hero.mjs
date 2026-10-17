/**
 * Paket TH: Termin-Hero mit Zu-/Absagen, Freigabe je Mannschaft, Helfer-Wischleiste, Antwort nach Fristablauf.
 * pnpm browser-check scripts/e2e/termin-hero.mjs --no-build   (danach pnpm db:reset)
 */
import { api, launch, loginAs, text } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};

const b = await launch();

// Trainer: Spiel mit Balken im Hero, Beschriftung nur aus AttendanceBar
{
  const { page, goto, login } = await b.session('trainer');
  const events = await api('/events', login.token);
  const match = events.find((e) => e.type === 'match' && e.status === 'scheduled' && e.counts);
  ok(!!match, 'Trainer findet ein Spiel mit Zu-/Absage-Zahlen');
  await goto(`/events/${match.id}`);
  await text(page, 'Zu- und Absagen', { exact: true }).waitFor({ timeout: 15_000 });
  await text(page, /\d+ Zusagen?/).waitFor({ timeout: 5_000 });
  await text(page, /\d+ offen/).waitFor({ timeout: 5_000 });
  ok(true, 'Hero zeigt „Zu- und Absagen“ mit Zusagen und offen');
  const heroes = await page.getByText('Zu- und Absagen', { exact: true }).count();
  ok(heroes === 1, 'genau ein Hero mit Balken');
}

// Spieler: Freigabe aus → kein Balken im Hero; danach wieder an
{
  const trainer = await loginAs('trainer');
  const spieler = await loginAs('spieler');
  const team = trainer.me.teams.find((t) => spieler.me.teams.some((x) => x.id === t.id));
  const profile = await api(`/teams/${team.id}/profile`, trainer.token);
  const put = (v) =>
    api(`/teams/${team.id}/profile`, trainer.token, {
      method: 'PUT',
      body: JSON.stringify({ ...profile, responsesVisible: v }),
    });
  await put(false);
  try {
    const { page, goto, login } = await b.session('spieler');
    const events = await api('/events', login.token);
    const training = events.find((e) => e.team && e.status === 'scheduled' && e.myResponses.length);
    ok(!!training && training.counts === null, 'Spieler bekommt ohne Freigabe keine Zahlen');
    await goto(`/events/${training.id}`);
    await text(page, 'Deine Antwort', { exact: true }).waitFor({ timeout: 15_000 });
    ok(
      (await page.getByText('Zu- und Absagen', { exact: true }).count()) === 0,
      'ohne Freigabe kein Balken im Hero, eigene Antwort bleibt',
    );
  } finally {
    await put(true);
  }
}

// Verein-Tab: Helfer-Wischleiste, Antippen öffnet die Helfer-Seite der Veranstaltung
{
  const { page, goto, login } = await b.session('mitglied');
  const helpers = await api('/helpers', login.token);
  const open = helpers.filter((h) => h.openSpots > 0);
  await goto('/verein');
  if (open.length) {
    await text(page, 'Helfer gesucht', { exact: true }).waitFor({ timeout: 15_000 });
    await text(page, /Helfer fehlt|Helfer fehlen/).click();
    await page.waitForURL(/helpers\?event=/, { timeout: 10_000 });
    ok(true, 'Karte öffnet /helpers?event=…');
  } else {
    ok(true, 'keine offenen Schichten in den Demodaten (Leiste entfällt)');
  }
}

// Antwort nach Fristablauf bleibt sichtbar (Schloss, keine Knöpfe)
{
  const { page, goto, login } = await b.session('spieler');
  const events = await api('/events', login.token);
  const locked = events.find(
    (e) => e.status === 'scheduled' && e.myResponses.length && !e.myResponses[0].canRespond,
  );
  if (locked) {
    await goto(`/events/${locked.id}`);
    await text(page, 'Frist abgelaufen', { exact: true }).waitFor({ timeout: 15_000 });
    ok(true, 'abgelaufene Frist: Schloss „Frist abgelaufen“ statt Knöpfen');
  } else {
    console.log('– kein Termin mit abgelaufener Frist in den Demodaten');
  }
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(fail || b.errors.length ? 1 : 0);
