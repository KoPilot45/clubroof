/**
 * Paket BE: Inhalte nachträglich bearbeiten (Stufe 1: Umfragen, Abwesenheiten, Dokumente, Vereinsveranstaltungen; Stufe 2: Forum, Aushang, Kommentar).
 * pnpm browser-check scripts/e2e/bearbeiten.mjs [--no-build]   (danach pnpm db:reset)
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const b = await launch();

// Umfrage: Frage ändern, danach „bearbeitet“-Spur; nach der ersten Stimme sind die Antworten gesperrt
{
  const { page, goto, login } = await b.session('trainer');
  const b1 = login.me.create.polls.find((t) => t.label.startsWith('B1'));
  const poll = await api('/polls', login.token, {
    method: 'POST',
    body: JSON.stringify({
      question: 'Welche Trikotfarbe fürs Turnier?',
      options: ['Grün', 'Weiß'],
      resultVisibility: 'always',
      scopeType: 'team',
      scopeId: b1.id,
    }),
  });
  await goto(`/polls/${poll.id}`);
  await button(page, 'Umfrage bearbeiten').click({ timeout: 20_000 });
  await page
    .getByLabel('Frage', { exact: true })
    .first()
    .fill('Welche Trikotfarbe tragen wir beim Turnier?');
  await button(page, 'Änderungen speichern').click();
  await text(page, 'Welche Trikotfarbe tragen wir beim Turnier?').waitFor({ timeout: 15_000 });
  await text(page, /bearbeitet · /).waitFor({ timeout: 10_000 });
  ok(true, 'Umfrage bearbeitet, „bearbeitet · vor …“ erscheint');
  // eine Stimme abgeben, dann sind die Antworten gesperrt
  const spieler = await (await import('../lib/e2e.mjs')).loginAs('spieler');
  const detail = await api(`/polls/${poll.id}`, spieler.token);
  await api(`/polls/${poll.id}/vote`, spieler.token, {
    method: 'PUT',
    body: JSON.stringify({ optionId: detail.options[0].id }),
  });
  await goto(`/polls/new?id=${poll.id}`);
  await text(page, /Es wurde schon abgestimmt/).waitFor({ timeout: 15_000 });
  ok(true, 'nach der ersten Stimme sind die Antworten gesperrt (Hinweis)');
}

// Abwesenheit: Notiz ändern über das Formular „bearbeiten“
{
  const { page, goto, login } = await b.session('spieler');
  const abs = await api('/absences', login.token, {
    method: 'POST',
    body: JSON.stringify({
      personId: login.me.person.id,
      kind: 'vacation',
      startsOn: '2027-03-01',
      endsOn: '2027-03-05',
      note: 'Skiurlaub',
    }),
  });
  await goto('/absences');
  await button(page, 'Abwesenheit bearbeiten').first().click({ timeout: 20_000 });
  await page.getByLabel('Notiz (optional)').fill('Skiurlaub in Tirol');
  await button(page, 'Änderungen speichern').click();
  await text(page, /Skiurlaub in Tirol/).waitFor({ timeout: 15_000 });
  await text(page, /bearbeitet · /).waitFor({ timeout: 10_000 });
  ok(true, 'Abwesenheit bearbeitet');
  await api(`/absences/${abs.id}`, login.token, { method: 'DELETE' }).catch(() => undefined);
}

// Vereinsveranstaltung: Titel ändern
{
  const { page, goto, login } = await b.session('vorstand');
  const at = (time) => new Date(`2027-02-06T${time}:00+01:00`).toISOString();
  const planning = await api('/admin/club-events', login.token, {
    method: 'POST',
    body: JSON.stringify({
      type: 'club_event',
      title: 'Faschingsparty',
      startsAt: at('15:00'),
      endsAt: at('19:00'),
      locationText: 'Vereinsheim',
      shifts: [{ title: 'Theke', startsAt: at('15:00'), endsAt: at('19:00'), capacity: 2 }],
    }),
  });
  const event = planning.upcoming.find((e) => e.title === 'Faschingsparty');
  await goto(`/events/${event.id}`);
  await button(page, 'Veranstaltung bearbeiten').click({ timeout: 20_000 });
  await page.getByLabel('Titel', { exact: true }).first().fill('Faschingsparty für alle');
  await button(page, 'Änderungen speichern').click();
  await page.waitForTimeout(1500);
  await goto(`/events/${event.id}`);
  await text(page, 'Faschingsparty für alle').waitFor({ timeout: 15_000 });
  ok(true, 'Vereinsveranstaltung bearbeitet');
  await api(`/events/${event.id}/cancel`, login.token, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Test beendet' }),
  });
}
// Stufe 2: Aushang bearbeiten (Fenster), Kommentar bearbeiten
{
  const { page, goto, login } = await b.session('spieler');
  const board = await api('/board', login.token, {
    method: 'POST',
    body: JSON.stringify({ kind: 'offer', title: 'Fußballschuhe Größe 38', detail: '15 €' }),
  });
  const item = board.items.find((i) => i.title === 'Fußballschuhe Größe 38');
  await goto('/board');
  await button(page, 'Bearbeiten').first().click({ timeout: 20_000 });
  await page.getByLabel('Was?', { exact: true }).last().fill('Fußballschuhe Größe 39');
  await button(page, 'Änderungen speichern').click();
  await text(page, 'Fußballschuhe Größe 39').waitFor({ timeout: 15_000 });
  await text(page, /bearbeitet · /).waitFor({ timeout: 10_000 });
  ok(true, 'Aushang bearbeitet, „bearbeitet“ erscheint');
  await api(`/board/${item.id}/done`, login.token, { method: 'POST' }).catch(() => undefined);
}
// Stufe 3: Ausrüstung bearbeiten
{
  const { page, goto, login } = await b.session('admin');
  await api('/equipment', login.token, {
    method: 'POST',
    body: JSON.stringify({
      kind: 'material',
      name: 'Hütchenset',
      quantity: 20,
      location: 'Geräteraum',
    }),
  });
  await goto('/equipment/items');
  await button(page, 'Bearbeiten').first().click({ timeout: 20_000 });
  await page.getByLabel('Zustand / Hinweis (optional)').last().fill('3 Stück fehlen');
  await button(page, 'Änderungen speichern').click();
  await text(page, /3 Stück fehlen/).waitFor({ timeout: 15_000 });
  await text(page, /bearbeitet · /)
    .first()
    .waitFor({ timeout: 10_000 });
  ok(true, 'Ausrüstung bearbeitet (Zustand), „bearbeitet“ erscheint');
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(fail || b.errors.length ? 1 : 0);
