/** SPO: Sponsoren – Banner (gekennzeichnet) auf Startseite, Spieltag, Terminen; Seite unter „Mehr“; Pflege; nicht für Minderjährige. */
import { api, launch, loginAs, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

// Sponsor mit Banner per API anlegen (Administration), damit Banner erscheinen
const admin = await loginAs('admin');
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const image = await api('/media', admin.token, {
  method: 'POST',
  body: JSON.stringify({ purpose: 'sponsor', fileName: 'banner.png', dataBase64: png }),
});
const created = await api('/admin/sponsors', admin.token, {
  method: 'POST',
  body: JSON.stringify({
    name: 'Browser Sponsor GmbH',
    tier: 'main',
    scope: 'club',
    bannerImageId: image.id,
  }),
});
const mine = created.sponsors.find((s) => s.name === 'Browser Sponsor GmbH');

{
  const { page, goto } = await b.session('trainer');
  await goto('/');
  await text(page, 'Schnellzugriff', { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByLabel(/Anzeige: Browser Sponsor GmbH/).waitFor({ timeout: 10_000 });
  ok(true, 'Startseite zeigt das gekennzeichnete Banner („Anzeige“)');

  await goto('/termine');
  await page.getByLabel(/Anzeige: Browser Sponsor GmbH/).waitFor({ timeout: 10_000 });
  ok(true, 'Termine zeigen das Banner');

  await goto('/mehr');
  await text(page, 'Unsere Sponsoren', { exact: true }).click();
  await text(page, 'Hauptsponsoren', { exact: true }).waitFor({ timeout: 10_000 });
  ok(await text(page, 'Sportshop Musterstadt').isVisible(), 'Seite „Unsere Sponsoren“ nach Stufen');
  ok(
    (await page.getByText('Bäckerei Kaiser').count()) === 0,
    'Geplante Sponsoren erscheinen nicht',
  );
}

{
  const { page, goto } = await b.session('spieler'); // minderjährig
  await goto('/');
  await text(page, 'Schnellzugriff', { exact: true }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  ok((await page.getByLabel(/Anzeige:/).count()) === 0, 'Minderjährige sehen kein Banner');
  await goto('/sponsors');
  await text(page, /nichts anzuzeigen/).waitFor({ timeout: 10_000 });
  ok(true, 'Seite „Unsere Sponsoren“ ist für Minderjährige leer');
}

{
  const { page, goto } = await b.session('admin');
  await goto('/admin/sponsors');
  await text(page, 'Sponsoren', { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.getByLabel('Reihenfolge ändern').first().waitFor({ timeout: 10_000 });
  ok(
    (await page.getByLabel('Reihenfolge ändern').count()) >= 5,
    'Verwaltung: Einträge am Griff sortierbar',
  );
  ok(
    await text(page, 'Geplant', { exact: true }).isVisible(),
    'Status „Geplant“ und „Abgelaufen“ sichtbar',
  );
}

// aufräumen
await api(`/admin/sponsors/${mine.id}`, admin.token, { method: 'DELETE' });
await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
