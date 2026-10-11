/** DP: Datumsauswahl mit Kalender – öffnen, Monat wechseln (Pfeil und Wischen), Tag wählen, „Heute“, Grenzen. */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

const { page, goto, login } = await b.session('trainer');
const b1 = login.me.teams.find((t) => t.badge === 'B1');
await goto(`/teams/${b1.id}/event-new`);
await text(page, 'Datum', { exact: true }).waitFor({ timeout: 20_000 });

const trigger = page.getByRole('button', { name: 'Datum: Kalender öffnen' });
const before = await trigger.innerText();
await trigger.click();
await text(page, 'Vorheriger Monat')
  .isVisible()
  .catch(() => null);
const next = page.getByRole('button', { name: 'Nächster Monat' });
await next.waitFor();
ok(true, 'Kalender öffnet beim Antippen des Datums');

// Mindestdatum: vergangene Tage dieses Monats sind gesperrt, Zurück-Pfeil gesperrt
ok(
  await page.getByRole('button', { name: 'Vorheriger Monat' }).isDisabled(),
  'Vor dem Mindestdatum kein Zurückblättern',
);

// Monat vor, dann einen Tag wählen
await next.click();
const day = page.getByRole('button', { name: /^\w+, 15\. \w+ \d{4}$/ }).first();
await day.click();
await page.waitForTimeout(400);
const after = await trigger.innerText();
ok(after !== before && /15\./.test(after), `Gewähltes Datum übernommen (${after.trim()})`);

// „Heute“ und Pfeil +1 Tag funktionieren weiter
await trigger.click();
await button(page, 'Heute').click();
await page.waitForTimeout(300);
ok((await trigger.innerText()) === before, '„Heute“ wählt den heutigen Tag');
await page.getByRole('button', { name: 'Datum: einen Tag später' }).click();
await page.waitForTimeout(200);
ok((await trigger.innerText()) !== before, 'Pfeile verschieben weiter um einen Tag');

// Wischen: nach links = nächster Monat (Touch-Ereignisse wie auf dem Handy)
await trigger.click();
const title = page.getByText(
  /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) \d{4}$/,
);
const t0 = await title.innerText();
const grid = page.getByRole('button', { name: /15\. \w+ \d{4}$/ }).first();
await page.waitForTimeout(700); // Einblend-Animation des Blatts abwarten
const box = await grid.boundingBox();
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
const y = box.y + box.height / 2;
const touch = (type, x) =>
  client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  });
const x0 = Math.min(330, page.viewportSize().width - 40);
await touch('touchStart', x0);
for (let i = 1; i <= 8; i++) await touch('touchMove', x0 - i * 20);
await touch('touchEnd', x0 - 160);
await page.waitForTimeout(400);
const t1 = await title.innerText();
ok(t0 !== t1, `Wischen wechselt den Monat (${t0.trim()} → ${t1.trim()})`);
await page.getByRole('button', { name: 'Schließen' }).last().click();
await page.waitForTimeout(700);

// Wiederholen bis: Höchstdatum etwa ein Jahr
await text(page, 'Wöchentlich bis …').click();
await page.getByRole('button', { name: 'Wiederholen bis einschließlich: Kalender öffnen' }).click();
const nextBtn = page.getByRole('button', { name: 'Nächster Monat' });
for (let i = 0; i < 14 && (await nextBtn.isEnabled()); i++) await nextBtn.click();
ok(await nextBtn.isDisabled(), 'Serienende ist auf etwa ein Jahr begrenzt');

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
