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
    await page.getByRole('link', { name: 'Ich', exact: true }).first().click();
    await page.waitForTimeout(1200);
    await b.shot(page, `dt-mehr-${s.width}-${scheme}`, false);
  }
}

// Stufe 2: Termine als Liste links und Termin rechts, Team mit Kadertabelle, Aufstellungsplaner zweispaltig
{
  const { page, goto, login } = await b.session('trainer', { width: 1440, height: 900 });
  await goto('/termine');
  await page.waitForTimeout(3000);
  // Ein Scrollbereich: Liste links, Kalender rechts daneben; Antippen eines Termins öffnet die Terminseite
  const kalender = await page
    .getByText('Kalender', { exact: true })
    .filter({ visible: true })
    .first()
    .boundingBox();
  const woche = await page
    .getByText(/^Woche \d|Als Nächstes/)
    .filter({ visible: true })
    .first()
    .boundingBox();
  ok(
    !!kalender && !!woche && kalender.x > woche.x + 400,
    'Termine: Liste links, Kalender rechts (ein Scrollbereich)',
  );
  await b.shot(page, `dt-termine-detail-1440-${scheme}`, false);
  const before = page.url();
  await page
    .getByRole('button')
    .filter({ hasText: /Training|Spiel/ })
    .filter({ visible: true })
    .nth(2)
    .click();
  await page.waitForTimeout(1500);
  ok(
    page.url() !== before && page.url().includes('/events/'),
    'Termine: Antippen öffnet die Terminseite',
  );

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
    // Das Etikett „Bank“ der rechten Spalte liegt rechts neben dem Spielfeld (Spalte ab ca. x = 930)
    const labels = page.getByText('Bank', { exact: true }).filter({ visible: true });
    let right = false;
    for (let i = 0; i < (await labels.count()); i++) {
      const box = await labels.nth(i).boundingBox();
      if (box && box.x > 940 && box.y < 120) right = true;
    }
    ok(right, 'Aufstellung: Bank und Kader rechts neben dem Spielfeld');
    await b.shot(page, `dt-aufstellung-1440-${scheme}`, false);
  }
}

// Stufe 3 und 4: Home, Verein und Mehr mehrspaltig, Bereiche mit fester Leiste und Spalten
{
  const x = async (page, label, o = {}) =>
    (
      await page
        .getByText(label, { exact: true, ...o })
        .filter({ visible: true })
        .first()
        .boundingBox()
    )?.x;
  const { page, goto } = await b.session('admin', { width: 1440, height: 900 });
  await goto('/');
  await page.waitForTimeout(3500);
  const news = await x(page, 'Neuigkeiten');
  const week = await x(page, 'Diese Woche');
  ok(
    news !== undefined && week !== undefined && news > week + 400,
    'Home: Neuigkeiten rechts, Offen und Diese Woche links',
  );
  await b.shot(page, `dt-home2-1440-${scheme}`, false);

  await goto('/verein');
  await page.waitForTimeout(3000);
  const groupXs = [];
  for (const g of ['Veranstaltungen', 'Neuigkeiten', 'Vereinsleben']) {
    const gx = await x(page, g);
    if (gx !== undefined) groupXs.push(Math.round(gx));
  }
  ok(
    new Set(groupXs).size >= 2,
    `Verein: Kachelgruppen stehen nebeneinander (${groupXs.join(', ')})`,
  );
  await b.shot(page, `dt-verein2-1440-${scheme}`, false);

  await goto('/mehr');
  await page.waitForTimeout(3000);
  const sx = await x(page, 'Einstellungen');
  const ax = await x(page, 'Mein Bereich');
  ok(
    sx !== undefined && ax !== undefined && ax > sx + 300,
    'Mehr: Einstellungen links, Profil und Bereich rechts',
  );
  await b.shot(page, `dt-mehr2-1440-${scheme}`, false);

  await goto('/admin');
  await page.waitForTimeout(3000);
  ok(
    (await page.getByRole('tab').filter({ visible: true }).count()) >= 3,
    'Verwaltung: Bereichsleiste mit beschrifteten Reitern',
  );
  await b.shot(page, `dt-admin-1440-${scheme}`, false);

  await goto('/club-cash');
  await page.waitForTimeout(3500);
  await b.shot(page, `dt-kasse-1440-${scheme}`, false);
  await goto('/club-cash/stats');
  await page.waitForTimeout(3500);
  await b.shot(page, `dt-kasse-stats-1440-${scheme}`, false);
}

// DT2 Stufe 2: Tabellen (Mitglieder): Sortierung, Tastatur, Auswahl und Export
{
  const { page, goto } = await b.session('admin', { width: 1440, height: 900 });
  await goto('/admin/members');
  await page.waitForTimeout(3500);
  ok((await page.getByRole('table').count()) > 0, 'Mitglieder: Tabelle statt Liste');
  const first = async () => (await page.getByRole('row').nth(1).innerText()).split('\n')[0];
  const before = await first();
  await page.getByRole('columnheader', { name: /Nr\./ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('columnheader', { name: /Nr\./ }).click();
  await page.waitForTimeout(500);
  ok((await first()) !== before, 'Mitglieder: Klick auf die Spalte sortiert');
  await page.getByRole('table').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  ok(page.url().includes('/admin/member/'), 'Mitglieder: Pfeiltasten und Enter öffnen die Person');
  await goto('/admin/members');
  await page.waitForTimeout(3000);
  await page.getByRole('checkbox', { name: 'Zeile auswählen' }).first().click();
  ok(
    (await page.getByText('Auswahl exportieren').filter({ visible: true }).count()) > 0,
    'Mitglieder: Auswahl lässt sich exportieren',
  );
  await b.shot(page, `dt2-mitglieder-1440-${scheme}`, false);
  await goto('/admin/audit');
  await page.waitForTimeout(3000);
  ok((await page.getByRole('table').count()) > 0, 'Änderungsprotokoll: Tabelle');
  await goto('/admin/teams');
  await page.waitForTimeout(3000);
  ok((await page.getByRole('table').count()) > 0, 'Mannschaften: Tabelle');
}

// DT2 Stufe 3: Assistent als zentrierte Spalte (höchstens 720 breit), Weiter-Knopf in derselben Spalte
{
  const { page, goto } = await b.session('admin', { width: 1440, height: 900 });
  await goto('/admin/team-new');
  await page.waitForTimeout(3000);
  const weiter = await page
    .getByRole('button', { name: 'Weiter' })
    .filter({ visible: true })
    .first()
    .boundingBox();
  ok(
    !!weiter && weiter.width <= 720 && weiter.x > 300,
    `Assistent: Inhalt zentriert und höchstens 720 breit (${Math.round(weiter?.width ?? 0)})`,
  );
  ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Assistent: kein waagerechtes Scrollen',
  );
  await b.shot(page, `dt2-assistent-1440-${scheme}`, false);
}

// DT2 Stufe 4: Kassenbuch als Tabelle, Antippen einer Zeile zeigt die Einzelheiten darunter
{
  const { page, goto } = await b.session('kasse', { width: 1440, height: 900 });
  await goto('/club-cash/entries');
  await page.waitForTimeout(3500);
  ok((await page.getByRole('table').count()) > 0, 'Kassenbuch: Tabelle statt Liste');
  await page.getByRole('row').nth(1).click();
  await page.waitForTimeout(800);
  ok(
    (await page.getByText('Gebucht von').filter({ visible: true }).count()) > 0 ||
      (await page.getByText('Buchung stornieren').filter({ visible: true }).count()) > 0 ||
      (await page.getByText('Storniert').filter({ visible: true }).count()) > 0 ||
      (await page.getByText('Beleg ansehen').filter({ visible: true }).count()) > 0 ||
      (await page.getByText(/€/).filter({ visible: true }).count()) > 3,
    'Kassenbuch: Zeile zeigt Einzelheiten',
  );
  await b.shot(page, `dt2-kassenbuch-1440-${scheme}`, false);
  await goto('/club-cash/fees');
  await page.waitForTimeout(3500);
  ok((await page.getByRole('table').count()) > 0, 'Beiträge: Forderungen als Tabelle');
}

// DT2 Stufe 5: Anmeldung zweigeteilt (links Verlauf mit Marke, rechts das Formular)
{
  const { page, goto } = await b.anonymous({ width: 1440, height: 900 });
  await goto('/login');
  await page.waitForTimeout(3500);
  const logo = await page
    .getByText('Clubroof', { exact: true })
    .filter({ visible: true })
    .first()
    .boundingBox();
  const field = await page
    .getByText('Ich habe schon ein Konto')
    .filter({ visible: true })
    .first()
    .boundingBox();
  ok(
    !!logo && !!field && logo.x < 720 && field.x > 720,
    `Anmeldung: Marke links, Auswahl rechts (${Math.round(logo?.x ?? 0)} / ${Math.round(field?.x ?? 0)})`,
  );
  await b.shot(page, `dt2-anmeldung-1440-${scheme}`, false);
  await goto('/forgot');
  await page.waitForTimeout(2500);
  const titel = await page
    .getByText('Passwort vergessen', { exact: true })
    .filter({ visible: true })
    .first()
    .boundingBox();
  const eingabe = await page.locator('input').filter({ visible: true }).first().boundingBox();
  ok(
    !!titel && !!eingabe && titel.x < 720 && eingabe.x > 720,
    'Passwort vergessen: Titel links, Eingabe rechts',
  );
}

// DT2 Stufe 4/5 Rest: Spenden als Tabelle, Termin mit Teilnahme rechts, Platzbelegung als Wochenraster
{
  const { page, goto, login } = await b.session('kasse', { width: 1440, height: 900 });
  await goto('/club-cash/donations');
  await page.waitForTimeout(3500);
  ok(
    (await page.getByRole('table').count()) > 0 ||
      (await page.getByText('Noch keine Spende').filter({ visible: true }).count()) > 0,
    'Spenden: Tabelle (oder leer)',
  );
  await goto('/club-cash/budget');
  await page.waitForTimeout(3000);
  await goto('/club-cash/closing');
  await page.waitForTimeout(3000);
  const t = await b.session('trainer', { width: 1440, height: 900 });
  const b1 = t.login.me.teams.find((x) => x.badge === 'B1');
  const ov = await api(`/teams/${b1.id}`, t.login.token);
  const ev = ov.upcomingMatches?.[0]?.event;
  if (ev) {
    await t.goto(`/events/${ev.id}`);
    await t.page.waitForTimeout(3500);
    const tx = (
      await t.page
        .getByText('Teilnahme', { exact: true })
        .filter({ visible: true })
        .first()
        .boundingBox()
    )?.x;
    ok(
      tx !== undefined && tx > 800,
      `Termin: Teilnahme rechts neben den Angaben (${Math.round(tx ?? 0)})`,
    );
    await b.shot(t.page, `dt2-termin-1440-${scheme}`, false);
  }
  const ad = await b.session('admin', { width: 1440, height: 900 });
  await ad.goto('/admin/club-events');
  await ad.page.waitForTimeout(3000);
  ok(
    (await ad.page.getByRole('table').count()) > 0 ||
      (await ad.page.getByText('Noch keine Veranstaltungen').filter({ visible: true }).count()) > 0,
    'Veranstaltungen: Tabelle (oder leer)',
  );
  await t.goto('/club-calendar');
  await t.page.waitForTimeout(3000);
  await t.goto('/club-cash/claims');
  await t.page.waitForTimeout(500);
  await t.goto('/facilities');
  await t.page.waitForTimeout(3500);
  await b.shot(t.page, `dt2-platz-1440-${scheme}`, false);
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
