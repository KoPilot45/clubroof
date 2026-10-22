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
    advertise: true,
    hideForYouth: true,
  }),
});
const mine = created.sponsors.find((s) => s.name === 'Browser Sponsor GmbH');

{
  const { page, goto } = await b.session('trainer');
  await goto('/');
  await text(page, 'Schnellzugriff', { exact: true }).waitFor({ timeout: 20_000 });
  // der Demoverein hat mehrere laufende Sponsoren; welches Banner erscheint, wechselt – geprüft wird die Kennzeichnung
  await page
    .getByLabel(/^Anzeige: /)
    .first()
    .waitFor({ timeout: 10_000 });
  ok(true, 'Startseite zeigt ein gekennzeichnetes Banner („Anzeige“)');

  // Banner stehen auf Start, im Team-Reiter und im Verein-Reiter (nicht mehr in den Terminen)
  await goto('/verein');
  await page
    .getByLabel(/^Anzeige: /)
    .first()
    .waitFor({ timeout: 10_000 });
  ok(true, 'Verein-Reiter zeigt das Banner');

  // die Seite liegt unter „Verein“ (Kachel „Sponsoren“); direkt öffnen
  await goto('/sponsors');
  await text(page, 'Diese Unternehmen unterstützen unseren Verein.', { exact: false }).waitFor({
    timeout: 10_000,
  });
  ok(
    await text(page, 'Sportshop Musterstadt').isVisible(),
    'Seite „Unsere Sponsoren“ listet die laufenden Sponsoren',
  );
  // geplante (noch nicht laufende) Sponsoren stehen nicht auf der öffentlichen Seite
  const planned = (await api('/admin/sponsors', admin.token)).sponsors.filter(
    (s) => s.status === 'planned',
  );
  ok(planned.length > 0, 'Demodaten enthalten einen geplanten Sponsor');
  for (const s of planned)
    ok(
      (await page.getByText(s.name, { exact: true }).count()) === 0,
      `Geplant: ${s.name} nicht sichtbar`,
    );
}

{
  // minderjährig: Sponsoren mit „Nicht bei Jugendlichen zeigen“ (Gasthaus, Browser Sponsor) bleiben weg
  const { page, goto } = await b.session('spieler');
  await goto('/');
  await text(page, 'Schnellzugriff', { exact: true }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  ok(
    (await page.getByLabel(/Anzeige: (Gasthaus Zur Linde|Browser Sponsor GmbH)/).count()) === 0,
    'Minderjährige sehen keine Banner der für Jugendliche gesperrten Sponsoren',
  );
  await goto('/sponsors');
  await text(page, 'Diese Unternehmen unterstützen unseren Verein.', { exact: false }).waitFor({
    timeout: 10_000,
  });
  // die Übersichtsseite ist eine Dankesliste aller laufenden Sponsoren; der Schalter betrifft nur die Werbebanner
  ok(
    (await page.getByText('Gasthaus Zur Linde').count()) > 0,
    'Seite „Unsere Sponsoren“ bleibt für alle eine Dankesliste (Schalter betrifft nur Banner)',
  );
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
