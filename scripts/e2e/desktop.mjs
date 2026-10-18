/**
 * Paket DT, Stufe 1: Breitenstufen, feste Seitenleiste, zentrierter Dialog statt Fenster von unten, Kürzel `/`.
 * pnpm browser-check scripts/e2e/desktop.mjs [--no-build]   (SCHEME=light für den hellen Stil; Bilder in .check/shots/dt-*.png)
 */
import { api, launch } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const scheme = process.env.SCHEME === 'light' ? 'hell' : 'dunkel';
const b = await launch();

const sizes = [
  { width: 390, label: 'Handy 390', sidebar: false },
  { width: 800, label: 'Tablet 800', sidebar: false },
  { width: 1099, label: 'knapp unter 1100', sidebar: false },
  { width: 1100, label: 'Desktop 1100', sidebar: true },
  { width: 1440, label: 'Desktop 1440', sidebar: true },
];
for (const s of sizes) {
  const { page, goto } = await b.session('trainer', { width: s.width, height: 900 });
  await goto('/');
  await page.waitForTimeout(2500);
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  const tabs = page.getByRole('tablist');
  ok(
    (await nav.count()) > 0 === s.sidebar,
    `${s.label}: Seitenleiste ${s.sidebar ? 'sichtbar' : 'nicht vorhanden'}`,
  );
  ok(
    (await tabs.count()) > 0 !== s.sidebar,
    `${s.label}: schwebende Leiste ${s.sidebar ? 'ausgeblendet' : 'sichtbar'}`,
  );
  if (s.width === 1440 || s.width === 1100) {
    await b.shot(page, `dt-home-${s.width}-${scheme}`, false);
  }
  if (s.sidebar) {
    // Bedienung: Team öffnen, Kürzel „/“ öffnet die Suche
    await page.getByRole('link', { name: 'Team', exact: true }).first().click();
    await page.waitForTimeout(1200);
    ok(page.url().includes('/team'), `${s.label}: Punkt „Team“ führt in den Team-Bereich`);
    await b.shot(page, `dt-team-${s.width}-${scheme}`, false);
    await page.keyboard.press('/');
    await page.waitForTimeout(1200);
    ok(page.url().includes('/search'), `${s.label}: Kürzel „/“ öffnet die Suche`);
    await page.getByRole('link', { name: 'Termine', exact: true }).first().click();
    await page.waitForTimeout(1200);
    await b.shot(page, `dt-termine-${s.width}-${scheme}`, false);
    await page.getByRole('link', { name: 'Verein', exact: true }).first().click();
    await page.waitForTimeout(1200);
    await b.shot(page, `dt-verein-${s.width}-${scheme}`, false);
    await page.getByRole('link', { name: 'Mehr', exact: true }).first().click();
    await page.waitForTimeout(1200);
    await b.shot(page, `dt-mehr-${s.width}-${scheme}`, false);
  }
}

// Stufe 2: Termine als Liste links und Termin rechts, Team mit Kadertabelle, Aufstellungsplaner zweispaltig
{
  const { page, goto, login } = await b.session('trainer', { width: 1440, height: 900 });
  await goto('/termine');
  await page.waitForTimeout(3000);
  const rows = page
    .getByRole('button')
    .filter({ hasText: /Training|Spiel/ })
    .filter({ visible: true });
  const listBox = await page.getByText('Alles auf einen Blick').first().boundingBox();
  ok(!!listBox, 'Termine: Kopfzeile sichtbar');
  // rechts steht schon der nächste Termin (Hero mit Zu-/Absage), ohne Seitenwechsel
  const before = page.url();
  await rows.nth(2).click();
  await page.waitForTimeout(1500);
  ok(page.url() === before, 'Termine: Antippen eines Termins bleibt auf der Seite (Detail rechts)');
  const detailRight = await page
    .locator('text=/Zusagen|Zu- und Absage|Teilnahme/')
    .filter({ visible: true })
    .first()
    .boundingBox();
  ok(!!detailRight && detailRight.x > 420, 'Termine: Termin erscheint rechts neben der Liste');
  await b.shot(page, `dt-termine-detail-1440-${scheme}`, false);

  const b1 = login.me.teams.find((t) => t.badge === 'B1');
  await goto(`/team?teamId=${b1.id}`);
  await page.waitForTimeout(3000);
  const nr = await page.getByText('Nr.', { exact: true }).filter({ visible: true }).first().count();
  ok(nr > 0, 'Team: Kadertabelle (Nr., Spieler, Position, Status) sichtbar');
  await b.shot(page, `dt-team-tabelle-1440-${scheme}`, false);

  const overview = await api(`/teams/${b1.id}`, login.token);
  const match = overview.upcomingMatches?.[0]?.event;
  if (match) {
    await goto(`/match/${match.id}/lineup`);
    await page.waitForTimeout(3500);
    const bank = await page
      .getByText('Bank', { exact: true })
      .filter({ visible: true })
      .first()
      .boundingBox();
    ok(!!bank && bank.x > 900, 'Aufstellung: Bank und Kader rechts neben dem Spielfeld');
    await b.shot(page, `dt-aufstellung-1440-${scheme}`, false);
  }
}

// Fenster: Desktop zentriert, Handy von unten (Kader-Fenster über den Anwesenheitsbalken)
for (const w of [1440, 390]) {
  const { page, goto, login } = await b.session('trainer', { width: w, height: 900 });
  const b1 = login.me.teams.find((t) => t.badge === 'B1');
  await goto(`/team?teamId=${b1.id}`);
  await page.waitForTimeout(2500);
  const trigger = page.getByRole('button', { name: /Kader/ }).filter({ visible: true }).first();
  if (await trigger.count()) {
    await trigger.click();
    await page.waitForTimeout(800);
    // Unten in der Mitte: beim zentrierten Dialog liegt dort noch der Hintergrund (Schließen-Fläche), beim Fenster von unten das Fenster
    const overlayAtBottom = await page.evaluate(
      (x) => !!document.elementFromPoint(x, 890)?.closest('[aria-label="Schließen"]'),
      w / 2,
    );
    ok(
      w >= 1100 ? overlayAtBottom : !overlayAtBottom,
      `${w}: Fenster ${w >= 1100 ? 'zentriert (Dialog)' : 'von unten'}`,
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(fail || b.errors.length ? 1 : 0);
