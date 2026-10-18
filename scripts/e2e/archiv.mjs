/**
 * Paket AR (Stufe 1): Wissensartikel löschen → Archiv → wiederherstellen; Namenskonflikt fragt nach.
 * pnpm browser-check scripts/e2e/archiv.mjs [--no-build]   (danach pnpm db:reset)
 */
import { api, button, del, launch, text } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const b = await launch();
{
  const { page, goto, login } = await b.session('admin');
  const wiki = await api('/wiki', login.token, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Schlüsselordnung',
      category: 'Anlage',
      body: 'Schlüssel nur gegen Unterschrift.',
    }),
  });
  await del(`/wiki/${wiki.id}`, login.token);
  await goto('/admin/archive');
  await text(page, 'Schlüsselordnung').waitFor({ timeout: 20_000 });
  ok(true, 'gelöschter Artikel steht im Archiv');
  await api('/wiki', login.token, {
    method: 'POST',
    body: JSON.stringify({ title: 'Schlüsselordnung', category: 'Anlage', body: 'neu' }),
  });
  await button(page, 'Wiederherstellen').first().click();
  await text(page, /Der Name ist inzwischen vergeben/)
    .first()
    .waitFor({ timeout: 15_000 });
  ok(true, 'Namenskonflikt: App fragt nach einem neuen Namen');
  await page
    .getByLabel(/Neuer Name/)
    .last()
    .fill('Schlüsselordnung (alt)');
  await button(page, 'Änderungen speichern').click();
  await text(page, 'Wiederhergestellt.').waitFor({ timeout: 15_000 });
  ok(true, 'mit neuem Namen wiederhergestellt');
}
// Stufe 2: Trainerteam stellt eine gelöschte Aufgabe im Archiv der Mannschaft wieder her
{
  const { page, goto, login } = await b.session('trainer');
  const b1 = login.me.teams.find((t) => t.badge === 'B1');
  const made = await api(`/teams/${b1.id}/tasks`, login.token, {
    method: 'POST',
    body: JSON.stringify({ title: 'Bälle aufpumpen' }),
  });
  const task = made.open.find((t) => t.title === 'Bälle aufpumpen');
  await del(`/tasks/${task.id}`, login.token);
  await goto(`/teams/${b1.id}/archive`);
  await text(page, 'Bälle aufpumpen').waitFor({ timeout: 20_000 });
  ok(true, 'gelöschte Aufgabe steht im Archiv der Mannschaft');
  ok(
    (await page.getByRole('button', { name: 'Endgültig löschen' }).count()) === 0,
    'Trainerteam hat kein „Endgültig löschen“',
  );
  await button(page, 'Wiederherstellen').first().click();
  await text(page, 'Wiederhergestellt.').waitFor({ timeout: 15_000 });
  ok(true, 'Aufgabe wiederhergestellt');
}
// Der erwartete 409 (Namenskonflikt) erscheint im Browser als Konsolenmeldung
const errors = b.errors.filter((e) => !e.includes('409'));
console.log(errors.length ? `✗ Konsolenfehler:\n${errors.join('\n')}` : '✓ keine Konsolenfehler');
await b.close();
process.exit(fail || errors.length ? 1 : 0);
