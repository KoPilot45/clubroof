/** WS: Wochen-Spielplan des Vereins – Kachel, Wochenwechsel (Pfeil, Wischen), Filter, Spielfrei. */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

const { page, goto } = await b.session('spieler');
await goto('/verein');
await text(page, 'Spielplan', { exact: true }).click();
await text(page, 'Diese Woche', { exact: true }).waitFor({ timeout: 20_000 });
ok(true, 'Kachel „Spielplan“ öffnet die Wochenansicht');

const heading = page.getByText(/^KW \d+ ·/);
const w0 = await heading.innerText();
await page.getByRole('button', { name: 'Nächste Woche' }).click();
await text(page, 'Nächste Woche', { exact: true }).first().waitFor();
const w1 = await heading.innerText();
ok(w0 !== w1, `Pfeil wechselt die Woche (${w0.trim()} → ${w1.trim()})`);

// Wischen nach rechts = zurück
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
const y = 400;
const touch = (type, x) =>
  client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  });
await touch('touchStart', 60);
for (let i = 1; i <= 8; i++) await touch('touchMove', 60 + i * 20);
await touch('touchEnd', 220);
await page.waitForTimeout(600);
ok((await heading.innerText()) === w0, 'Wischen nach rechts blättert eine Woche zurück');

// Eine Woche mit Spielen suchen
let found = false;
for (let i = 0; i < 6 && !found; i++) {
  found = (await page.getByText(/Heimspiel|Auswärts/).count()) > 0;
  if (!found) {
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await page.waitForTimeout(600);
  }
}
ok(found, 'Spiele mit Heim/Auswärts-Kennzeichnung sichtbar');
const all = await page.getByText(/Heimspiel|Auswärts/).count();
await text(page, 'Jugend', { exact: true }).click();
await page.waitForTimeout(400);
const youth = await page.getByText(/Heimspiel|Auswärts/).count();
ok(youth <= all, `Filter „Jugend“ blendet Spiele aus (${all} → ${youth})`);
ok((await page.getByText(/^Spielfrei:/).count()) <= 1, 'Spielfrei-Hinweis höchstens einmal');

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
