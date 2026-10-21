/**
 * AV: Admin-Verwaltung (violett) und Vereinskasse (blau) als eigene Bereiche – Zugänge in „Mehr“, Kopfband mit
 * „Beenden“, beschriftete Reiter, Kategorien mit farbigen Untergruppen.
 * Aufruf: pnpm browser-check scripts/e2e/bereiche.mjs [--no-build|--reset]
 */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const vis = (page, re, o = {}) => page.getByText(re, o).filter({ visible: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const rgb = (c) => c.match(/\d+/g).slice(0, 3).map(Number);
// Das Kopfband ist ein SVG-Farbverlauf (GradientFill): erste Verlaufsfarbe des nächsten Elternelements lesen
const bandColor = (btn) =>
  btn.evaluate((e) => {
    for (let up = e.parentElement, n = 0; up && n < 6; up = up.parentElement, n++) {
      const stop = up.querySelector('stop');
      const hex = stop?.getAttribute('stop-color') ?? getComputedStyle(stop ?? up).stopColor;
      if (/^#[0-9a-f]{6}$/i.test(hex ?? ''))
        return `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
    }
    return 'rgb(0, 0, 0)';
  });

// ── Zugänge in „Verein › Meine Vereinsaufgaben“ je nach Rechten ────────────────────────────────────────
const access = async (who) => {
  const s = await b.session(who);
  await s.goto('/verein');
  await text(s.page, 'Mannschaften').waitFor({ timeout: 20_000 });
  await s.page.waitForTimeout(1500);
  return {
    s,
    admin: (await s.page.getByRole('button', { name: /^Verwaltung/ }).count()) > 0,
    cash: (await s.page.getByRole('button', { name: 'Vereinskasse' }).count()) > 0,
  };
};
const adm = await access('admin');
ok(adm.admin && adm.cash, 'Admin sieht beide Zugänge');
const kasse = await access('kasse');
ok(!kasse.admin && kasse.cash, 'Kassenzugriff: nur „Vereinskasse“');
const spieler = await access('spieler');
ok(!spieler.admin && !spieler.cash, 'Spieler: kein Zugang');

// ── Admin-Verwaltung ─────────────────────────────────────────────────────────
const page = adm.s.page;
await page
  .getByRole('button', { name: /^Verwaltung/ })
  .first()
  .click();
await tab(page, 'Mitglieder').waitFor({ timeout: 20_000 });
await page.waitForTimeout(1500);
for (const name of ['Übersicht', 'Mitglieder', 'Sport', 'Inhalte', 'Verein'])
  ok((await tab(page, name).count()) === 1, `Reiter „${name}“ beschriftet`);
ok((await button(page, /^zur app$/i).count()) > 0, 'Kopfband mit „Zur App“');
ok(
  (await vis(page, 'Aktive Mitglieder', { exact: true }).count()) > 0,
  'Übersicht: Blickfläche Mitglieder',
);
ok((await vis(page, 'Für dich', { exact: true }).count()) > 0, 'Übersicht: „Für dich“');
ok(
  (await vis(page, 'Mitglied anlegen', { exact: true }).count()) === 0,
  'Übersicht ohne Funktionskacheln',
);
const band = await bandColor(button(page, /^zur app$/i));
const [vr, vg, vb] = rgb(band);
ok(vr > vg && vb > vg, `Kopfband violett (${vr},${vg},${vb})`);
await tab(page, 'Mitglieder').click();
await text(page, 'Personen', { exact: true }).waitFor({ timeout: 8000 });
for (const g of ['Personen', 'Zugang & Rechte', 'Bewegung'])
  ok((await vis(page, g, { exact: true }).count()) > 0, `Mitglieder: Untergruppe „${g}“`);
ok(
  (await vis(page, 'Bald verfügbar').count()) > 0,
  'Noch fehlende Funktionen als „Bald verfügbar“',
);
await b.shot(page, 'av-mitglieder', false);
await page
  .getByRole('button', { name: /^Mitglieder/ })
  .filter({ visible: true })
  .first()
  .click();
await page.getByRole('button', { name: 'Verwaltung', exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Unterseite: Pfad „Verwaltung › Mitglieder“');
ok(
  (await tab(page, 'Mitglieder').getAttribute('aria-selected')) === 'true',
  'Reiter „Mitglieder“ bleibt markiert',
);
for (const [name, group] of [
  ['Sport', 'Mannschaften'],
  ['Inhalte', 'Mitteilungen'],
  ['Verein', 'Auftritt'],
]) {
  await tab(page, name).click();
  await text(page, group, { exact: true }).waitFor({ timeout: 8000 });
  ok(true, `${name}: Untergruppe „${group}“`);
}
await button(page, /^zur app$/i).click();
await page.waitForTimeout(1500);
ok(new URL(page.url()).pathname === '/verein', '„Zur App“ führt zurück nach „Verein“');

// ── Vereinskasse ─────────────────────────────────────────────────────────────
const c = kasse.s.page;
await c.getByRole('button', { name: 'Vereinskasse' }).click();
await tab(c, 'Beiträge').waitFor({ timeout: 20_000 });
await c.waitForTimeout(1500);
for (const name of ['Übersicht', 'Buchung', 'Beiträge', 'Planung', 'Auswertung'])
  ok((await tab(c, name).count()) === 1, `Kasse: Reiter „${name}“`);
const cband = await bandColor(button(c, /^zur app$/i));
const [cr, cg, cb] = rgb(cband);
ok(cb > cr && cb > cg, `Kopfband blau (${cr},${cg},${cb})`);
ok((await vis(c, 'Gesamtbestand aller Konten').count()) > 0, 'Kasse: Übersicht mit Gesamtbestand');
await tab(c, 'Beiträge').click();
await text(c, 'Mahnwesen', { exact: true }).waitFor({ timeout: 8000 });
for (const g of ['Mitglieder', 'Einrichtung', 'Mahnwesen'])
  ok((await vis(c, g, { exact: true }).count()) > 0, `Beiträge: Untergruppe „${g}“`);
await tab(c, 'Planung').click();
await text(c, 'Haushalt', { exact: true }).waitFor({ timeout: 8000 });
for (const g of ['Haushalt', 'Abschluss'])
  ok((await vis(c, g, { exact: true }).count()) > 0, `Planung: Untergruppe „${g}“`);
await tab(c, 'Buchung').click();
await text(c, 'Kassenbuch', { exact: true }).first().waitFor({ timeout: 8000 });
await c
  .getByRole('button', { name: /^Kassenbuch/ })
  .filter({ visible: true })
  .first()
  .click();
await c.getByRole('button', { name: 'Vereinskasse', exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Kassenbuch: Pfad „Vereinskasse › Kassenbuch“');
await b.shot(c, 'av-kasse', false);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
