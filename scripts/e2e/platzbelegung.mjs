/** PB: Platzbelegung als Stundenplan – Tag (Spalte je Platz), Woche (Mo–Fr + Wochenende), Details per Antippen. */
import { api, button, del, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const s = await b.session('admin');
const { page } = s;
// Sperrung in den nächsten Stunden anlegen (Demodaten enthalten keine; Vergangenes ist nicht erlaubt)
const d = new Date();
const mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
const week = `from=${mon.toISOString().slice(0, 10)}&to=${new Date(mon.getTime() + 6 * 86_400_000).toISOString().slice(0, 10)}`;
const occ = await api(`/facilities/occupancy?${week}`, s.login.token);
const kunst = occ.facilities.find((f) => f.facility.name.includes('Kunstrasen')).facility;
await api('/facilities/blocks', s.login.token, {
  method: 'POST',
  body: JSON.stringify({
    facilityId: kunst.id,
    startsAt: new Date(Date.now() + 2 * 60_000).toISOString(),
    endsAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    reason: 'Platzpflege',
  }),
});
const after = await api(`/facilities/occupancy?${week}`, s.login.token);
const blockId = after.facilities.flatMap((f) => f.bookings).find((x) => x.kind === 'block')?.id;
const radio = (name) => page.getByRole('radio', { name, exact: true });
await s.goto('/facilities');
await radio('Woche').waitFor({ timeout: 20_000 });
await page.waitForTimeout(1200);

// Tag: Spalte je Platz mit Zeitachse
ok((await page.getByText('Sperrung anlegen').count()) > 0, 'Verwalter sieht „Sperrung anlegen“');
await radio('Woche').click();
await page.waitForTimeout(1200);
await page.getByRole('radio', { name: /Kunstrasen/ }).click();
await page.waitForTimeout(800);
const blocks = page.getByRole('button', { name: /Gesperrt:/ });
ok((await blocks.count()) > 0, 'Woche: Sperrung als Block im Stundenplan');
const events = page.getByRole('button', { name: /^(?!Gesperrt).*\d\d:\d\d–\d\d:\d\d/ });
ok((await events.count()) > 1, `Woche: Termine als Blöcke (${await events.count()})`);
ok((await text(page, /Wischen wechselt die Woche/).count()) > 0, 'Hinweis zum Wischen');
await b.shot(page, 'pb-woche');

// Block antippen: Details
// in die Mitte holen: unten verdeckt die schwebende Leiste sonst den Block
await blocks.first().evaluate((e) => e.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await blocks.first().click();
await text(page, /Sperrung aufheben/).waitFor({ timeout: 5000 });
ok(true, 'Sperrung antippen zeigt Details mit „Sperrung aufheben“');
await page.getByRole('button', { name: 'Schließen' }).last().click();
await page.waitForTimeout(400);
const first = events.first();
await first.evaluate((e) => e.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await first.click();
await button(page, 'Termin öffnen').waitFor({ timeout: 5000 });
ok(
  (await button(page, 'Platz sperren').count()) > 0,
  'Termin antippen: „Termin öffnen“ und „Platz sperren“',
);
await page.getByRole('button', { name: 'Schließen' }).last().click();

// Tagesansicht mit Datum der Woche (Mittwoch)
await radio('Tag').click();
await page.waitForTimeout(800);
await b.shot(page, 'pb-tag');
await del(`/facilities/blocks/${blockId}`, s.login.token);
await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
