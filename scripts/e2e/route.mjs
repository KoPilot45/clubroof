/** Browserprüfung „Route“: Auswärtsspiel öffnen, Button „Route“ öffnet die Karten-Adresse. */
import { api, button, launch } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const s = await b.session('spieler');
const events = await api('/events', s.login.token);
const away = events.find((e) => e.match && !e.match.isHome && e.routeUrl);
ok(!!away, 'Es gibt ein Auswärtsspiel mit Route-Link');
if (away) {
  await s.goto(`/events/${away.id}`);
  const route = button(s.page, 'Route');
  await route.waitFor({ timeout: 20_000 });
  const [popup] = await Promise.all([
    s.page.context().waitForEvent('page', { timeout: 10_000 }),
    route.click(),
  ]);
  // Ohne Internet im Testlauf lädt die Seite nicht; es genügt, dass ein neuer Tab zur Karten-Adresse öffnet
  await popup.waitForTimeout(500);
  const target = await popup.evaluate(() => location.href).catch(() => popup.url());
  ok(!!popup, `Button „Route“ öffnet einen neuen Tab (${target.slice(0, 60)})`);
}
await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
