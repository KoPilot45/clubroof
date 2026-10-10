/**
 * Paket U: Wisch-Aktionen (Benachrichtigung gelesen, Zusage per Wischen) und Ladebildschirm in Vereinsfarbe.
 * Aufruf: pnpm browser-check scripts/e2e/ios-feinschliff.mjs
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};

/** Wischen mit Touch-Ereignissen (wie auf dem Handy); die Maus löst im Browser keine Wischgeste aus. */
async function swipeLeft(page, locator, dx = 130) {
  const box = await locator.boundingBox();
  return swipeAt(page, box.x + box.width - 30, box.y + box.height / 2, dx);
}

async function swipeAt(page, x0, y, dx = 130) {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touch = (type, x) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  await touch('touchStart', x0);
  for (let i = 1; i <= 8; i++) await touch('touchMove', x0 - (dx * i) / 8);
  await touch('touchEnd', x0 - dx);
}

// Benachrichtigungen: nach links wischen → „Gelesen“
{
  const { page, login, goto } = await b.session('trainer');
  const before = await api('/notifications', login.token);
  const unread = before.find?.((n) => !n.readAt) ?? before.items?.find((n) => !n.readAt);
  await goto('/notifications');
  await text(page, 'Heute').waitFor({ timeout: 20_000 });
  if (unread) {
    const row = page.getByText(unread.title, { exact: false }).filter({ visible: true }).first();
    await swipeLeft(page, row, 100); // halb geöffnet: Aktion antippen
    await page.waitForTimeout(500);
    const act = page.locator('[role=button]:not([disabled])', { hasText: 'Gelesen' }).first();
    ok(await act.isVisible(), 'Benachrichtigung: Wischen zeigt die Aktion „Gelesen“');
    await act.click();
    await page.waitForTimeout(800);
    const after = await api('/notifications', login.token);
    const list = after.find ? after : after.items;
    ok(!!list.find((n) => n.id === unread.id)?.readAt, 'Benachrichtigung: als gelesen gespeichert');
  } else console.log('– Demodaten: keine ungelesene Benachrichtigung');
}

// Termine: Zusage per Wischen (Spieler, offener Termin)
{
  const { page, login, goto } = await b.session('spieler');
  const home = await api('/home', login.token);
  const open = home.week.find(
    (e) =>
      e.status === 'scheduled' &&
      e.myResponses.length === 1 &&
      e.myResponses[0].relation === 'self' &&
      e.myResponses[0].status === 'pending' &&
      e.myResponses[0].canRespond,
  );
  if (open) {
    const from0 = new Date();
    const beforeEvents = await api(
      `/events?from=${encodeURIComponent(from0.toISOString())}&to=${encodeURIComponent(new Date(from0.getTime() + 60 * 24 * 3600 * 1000).toISOString())}`,
      login.token,
    );
    await goto('/termine');
    await text(page, 'Als Nächstes').waitFor({ timeout: 20_000 });
    // Zeile mit dem runden ✓ (offene Rückmeldung): links davon ansetzen und nach links wischen
    const tick = page.locator('[role=button][aria-label="Zusagen"]:not([disabled])').first();
    await tick.waitFor({ timeout: 10_000 });
    const t = await tick.boundingBox();
    await swipeAt(page, t.x - 20, t.y + t.height / 2, 100); // halb geöffnet: Aktion antippen
    await page.waitForTimeout(500);
    // die Wisch-Aktion trägt sichtbaren Text (das runde ✓ nicht)
    const act = page.locator('[role=button]:not([disabled])', { hasText: 'Zusagen' }).first();
    ok(await act.isVisible(), 'Termin: Wischen zeigt die Aktion „Zusagen“');
    await act.click();
    await page.waitForTimeout(1000);
    const range = () => {
      const from = new Date();
      const to = new Date(from.getTime() + 60 * 24 * 3600 * 1000);
      return `/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    };
    const after = await api(range(), login.token);
    const yes = (list) =>
      list.filter((e) => e.myResponses.length === 1 && e.myResponses[0].status === 'yes');
    ok(
      yes(after).length === yes(beforeEvents).length + 1,
      'Termin: Zusage per Wischen gespeichert',
    );
    for (const e of yes(after))
      if (!yes(beforeEvents).find((h) => h.id === e.id))
        await api(`/events/${e.id}/responses/${e.myResponses[0].personId}`, login.token, {
          method: 'PUT',
          body: JSON.stringify({ status: 'pending', reason: null }),
        });
  } else console.log('– Demodaten: Spieler hat keinen offenen Termin');
}

// Ladebildschirm in Vereinsfarbe: Verein wird auf dem Gerät gemerkt
{
  const { page, goto } = await b.session('spieler');
  await goto('/');
  await text(page, 'Deine Woche').waitFor({ timeout: 20_000 });
  const stored = await page.evaluate(() =>
    Object.entries(localStorage).find(([k, v]) => /brand/.test(k) || /\|/.test(String(v))),
  );
  ok(!!stored, 'Verein des Geräts gemerkt (Farbe und Kürzel für den Ladebildschirm)');
}

ok(b.errors.length === 0, b.errors.length ? b.errors.join('\n') : 'keine Konsolenfehler');
await b.close();
process.exit(failed ? 1 : 0);
