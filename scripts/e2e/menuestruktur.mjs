/** MS: Menüstruktur – Kategorien im Team- und Verein-Tab, Newsticker, Verwaltung nur mit Rechten, Schiedsrichter unter Mehr. */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const y = async (page, label, o = { exact: true }) => (await text(page, label, o).boundingBox()).y;
const count = (page, label) => page.getByText(label, { exact: true }).count();

// ── Team als Trainer ──────────────────────────────────────────────────────
{
  const { page, goto } = await b.session('trainer');
  await goto('/team');
  await text(page, 'Spiel- & Trainingsbetrieb', { exact: true }).waitFor({ timeout: 20_000 });
  await text(page, 'Nächste Spiele', { exact: true }).waitFor(); // Layout ist erst danach stabil
  await text(page, 'Trainingswoche', { exact: true }).waitFor();
  const [play, org, admin] = [
    await y(page, 'Spiel- & Trainingsbetrieb'),
    await y(page, 'Organisation'),
    await y(page, 'Verwaltung'),
  ];
  ok(
    play < org && org < admin,
    'Team: Spiel- & Trainingsbetrieb, Organisation, Verwaltung in dieser Reihenfolge',
  );
  const yTermin = await y(page, 'Nächster Termin');
  ok(yTermin < play, 'Team: „Nächster Termin“ steht über den Kategorien');
  ok(
    (await y(page, 'Abwesenheit melden')) < org,
    'Team: Abwesenheit melden gehört zum Spielbetrieb',
  );
  ok((await y(page, 'Termin anlegen')) > admin, 'Team: Termin anlegen steht unter Verwaltung');
  ok(
    await text(page, 'Kader verwalten', { exact: true }).isVisible(),
    'Team: Kader verwalten (Trainerteam)',
  );
}
{
  const { page, goto } = await b.session('spieler');
  await goto('/team');
  await text(page, 'Spiel- & Trainingsbetrieb', { exact: true }).waitFor({ timeout: 20_000 });
  ok((await count(page, 'Verwaltung')) === 0, 'Team: Spieler sehen keine Kategorie Verwaltung');
}

// ── Verein als Administration ─────────────────────────────────────────────
{
  const { page, goto } = await b.session('admin');
  await goto('/verein');
  await text(page, 'Veranstaltungen', { exact: true }).first().waitFor({ timeout: 20_000 });
  await text(page, 'Alle anzeigen ›').waitFor();
  ok(
    (await count(page, 'Vereinsnews')) === 0,
    'Verein: Abschnitt „Vereinsnews“ ist im Newsticker aufgegangen',
  );
  const titles = ['Veranstaltungen', 'Neuigkeiten', 'Vereinsleben', 'Verwaltung'];
  const ys = [];
  for (const t of titles)
    ys.push(await y(page, t.toUpperCase(), { exact: true }).catch(() => y(page, t)));
  ok(
    ys.every((v, i) => i === 0 || v > ys[i - 1]),
    'Verein: Kategorien in der festgelegten Reihenfolge',
  );
  for (const label of [
    'Übersicht',
    'Rollen & Rechte',
    'Änderungsprotokoll',
    'Einladen',
    'Funktionen',
  ])
    ok(await text(page, label, { exact: true }).isVisible(), `Verein/Verwaltung: ${label}`);
  ok(
    (await count(page, 'Schiedsrichter')) === 0,
    'Verein: Schiedsrichter steht nicht mehr bei den Kacheln',
  );

  // Newsticker wechselt nach etwa 5 Sekunden
  const slide = page.getByTestId('ticker-slide');
  const first = await slide.getAttribute('aria-label');
  await page.waitForTimeout(5800);
  const second = await slide.getAttribute('aria-label');
  ok(first !== second, `Newsticker wechselt automatisch die Slide (${first} → ${second})`);
}
{
  const { page, goto } = await b.session('spieler');
  await goto('/verein');
  await text(page, 'Alle anzeigen ›').waitFor({ timeout: 20_000 });
  ok(
    (await count(page, 'VERWALTUNG')) + (await count(page, 'Verwaltung')) === 0,
    'Verein: ohne Rechte entfällt die Kategorie Verwaltung',
  );
}

// ── Mehr: Schiedsrichter ──────────────────────────────────────────────────
{
  const { page, goto } = await b.session('trainer');
  await goto('/mehr');
  await text(page, 'Schiedsrichter', { exact: true }).waitFor({ timeout: 20_000 });
  ok(true, 'Mehr: Schiedsrichter für aktive Schiedsrichter');
}

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
