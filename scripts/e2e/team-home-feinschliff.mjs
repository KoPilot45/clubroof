/** Q1: Team-Tab (Reihenfolge, Nächste Spiele für Trainer) und Schnellzugriff per Drag & Drop sortieren. */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

// Ziehen mit Touch-Ereignissen (wie auf dem Handy)
async function dragBy(page, locator, dy) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y0 = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touch = (type, y) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  await touch('touchStart', y0);
  for (let i = 1; i <= 8; i++) await touch('touchMove', y0 + (dy * i) / 8);
  await touch('touchEnd', y0 + dy);
}

// ── Team-Tab als Trainer ──────────────────────────────────────────────────
{
  const { page, goto } = await b.session('trainer');
  await goto('/team');
  await text(page, 'Nächster Termin', { exact: true }).waitFor({ timeout: 20_000 });
  const y = async (t, o = {}) => (await text(page, t, o).boundingBox()).y;
  const yTermin = await y('Nächster Termin', { exact: true });
  const yKacheln = await y('Termin anlegen', { exact: true });
  ok(yTermin < yKacheln, 'Nächster Termin steht über den Navigationskacheln');
  await text(page, 'Nächste Spiele', { exact: true }).waitFor();
  ok(true, 'Trainer sehen die Wisch-Reihe „Nächste Spiele“');
  ok((await text(page, /\d+ zugesagt/).count()) > 0, 'Karten zeigen den Zu-/Absage-Balken');
  const yWoche = await y('Trainingswoche', { exact: true });
  const yErgebnisse = await y('Letzte Ergebnisse', { exact: true });
  ok(yWoche < yErgebnisse, 'Letzte Ergebnisse stehen unter der Trainingswoche');
}

// ── Spieler: keine Wisch-Reihe ────────────────────────────────────────────
{
  const { page, goto } = await b.session('spieler');
  await goto('/team');
  await text(page, 'Nächster Termin', { exact: true }).waitFor({ timeout: 20_000 });
  ok(
    (await page.getByText('Nächste Spiele', { exact: true }).count()) === 0,
    'Spieler sehen keine Kaderplanungs-Reihe',
  );
}

// ── Schnellzugriff sortieren ──────────────────────────────────────────────
{
  const { page, goto, login } = await b.session('trainer');
  await goto('/');
  await text(page, 'Schnellzugriff', { exact: true }).waitFor({ timeout: 20_000 });
  await text(page, 'Hinzufügen', { exact: true }).click();
  await text(page, 'Schnellzugriff anpassen').waitFor();
  const handles = page.getByLabel('Reihenfolge ändern');
  const n = await handles.count();
  ok(n >= 2, `Anfasser zum Sortieren sichtbar (${n})`);
  const labels = async () =>
    page
      .locator('[role=checkbox][aria-checked=true]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const before = await labels();
  await dragBy(page, handles.first(), 60); // eine Zeile (52 px) nach unten
  await page.waitForTimeout(300);
  const during = await labels();
  ok(during[1] === before[0] && during[0] === before[1], 'Eintrag wandert beim Ziehen nach unten');
  await button(page, 'Speichern').click();
  await page.waitForTimeout(1200);
  const me = await api('/me', login.token);
  ok(
    Array.isArray(me.user.quickLinks) && me.user.quickLinks.length === n,
    'Reihenfolge gespeichert',
  );
  await text(page, 'Hinzufügen', { exact: true }).click();
  await page.waitForTimeout(400);
  const reopened = await labels();
  ok(reopened[1] === before[0], 'Gespeicherte Reihenfolge erscheint wieder');
  await button(page, 'Speichern').click();
  await page.waitForTimeout(800);
  // Zurücksetzen
  await text(page, 'Hinzufügen', { exact: true }).click();
  await button(page, 'Zurücksetzen').click();
  await page.waitForTimeout(1000);
  ok(
    (await api('/me', login.token)).user.quickLinks === null,
    'Zurücksetzen stellt den Standard wieder her',
  );
}

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
