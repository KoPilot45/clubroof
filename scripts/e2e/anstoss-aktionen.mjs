/**
 * Design „Anstoß“: Aufgaben mit Hauptknopf und „…“-Menü (U13/U14), Löschen mit Rückfrage (U15).
 * pnpm browser-check scripts/e2e/anstoss-aktionen.mjs --no-build
 */
import { api, button, del, launch, text } from '../lib/e2e.mjs';

const b = await launch();
const { page, goto, login } = await b.session('trainer', { width: 390, height: 1100 });
const b1 = login.me.teams.find((t) => t.badge === 'B1');
// Altlasten früherer Läufe entfernen, damit das erste „…“-Menü sicher zum neuen Eintrag gehört
const before = await api(`/teams/${b1.id}/tasks`, login.token);
for (const t of [...before.open, ...before.done]) await del(`/tasks/${t.id}`, login.token);
const title = `Trikots waschen ${Date.now() % 10000}`;
await api(`/teams/${b1.id}/tasks`, login.token, {
  method: 'POST',
  body: JSON.stringify({ title, note: 'Trikotsatz nach dem Spiel mitnehmen.' }),
});

await goto(`/teams/${b1.id}/tasks`);
await text(page, title).waitFor({ timeout: 15_000 });
const card = page.locator('div').filter({ hasText: title }).last();
await b.shot(page, 'aktionen-u13', false);

// „…“-Menü des neuen Eintrags öffnen
await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
await text(page, 'Löschen', { exact: true }).waitFor({ timeout: 5_000 });
await b.shot(page, 'aktionen-u14', false);
console.log('✓ Menü öffnet mit Löschen');

// Löschen fragt immer nach
await text(page, 'Löschen', { exact: true }).click();
await text(page, /^(Wirklich löschen\?|Ins Archiv verschieben\?)/).waitFor({ timeout: 5_000 });
await b.shot(page, 'aktionen-u15', false);
console.log('✓ Rückfrage („Wirklich löschen?“ bzw. „Ins Archiv verschieben?“) erscheint');
let list = await api(`/teams/${b1.id}/tasks`, login.token);
const still = [...list.open, ...list.done].some((t) => t.title === title);
console.log(still ? '✓ vor der Bestätigung ist nichts gelöscht' : '✗ Eintrag war vorzeitig weg');

// Abbrechen löscht nichts, Bestätigen löscht
await button(page, 'Abbrechen').click();
list = await api(`/teams/${b1.id}/tasks`, login.token);
console.log(
  [...list.open, ...list.done].some((t) => t.title === title)
    ? '✓ Abbrechen behält den Eintrag'
    : '✗ Abbrechen hat gelöscht',
);
await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
await text(page, 'Löschen', { exact: true }).click();
await text(page, /^(Wirklich löschen\?|Ins Archiv verschieben\?)/).waitFor({ timeout: 5_000 });
await page
  .getByRole('button', { name: /^(Löschen|Archivieren)$/ })
  .filter({ visible: true })
  .last()
  .click();
await page.waitForTimeout(1000);
await page.waitForTimeout(1500);
list = await api(`/teams/${b1.id}/tasks`, login.token);
console.log(
  [...list.open, ...list.done].some((t) => t.title === title)
    ? '✗ Eintrag noch da'
    : '✓ Bestätigen löscht',
);
void card;

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(b.errors.length ? 1 : 0);
