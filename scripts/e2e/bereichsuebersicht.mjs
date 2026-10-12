/**
 * BU: Bereichsübersicht im Team-Tab für Vorstand/Leitung – Filter, Blickfläche, Mannschaftskarten, Ampel, nicht antippbar.
 * Aufruf: pnpm browser-check scripts/e2e/bereichsuebersicht.mjs [--no-build|--reset]
 */
import { api, del, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const vis = (page, re) => page.getByText(re).filter({ visible: true });

const s = await b.session('vorstand');
const { page } = s;
const me = await api('/me', s.login.token);
await s.goto('/team');
await text(page, 'Bereichsübersicht', { exact: true }).waitFor({ timeout: 20_000 });
await page.waitForTimeout(2500);
const radio = (name) => page.getByRole('radio', { name, exact: true });
ok(
  (await radio('Senioren').count()) > 0 &&
    (await radio('Frauen').count()) > 0 &&
    (await radio('Jugend').count()) > 0,
  'Filter Alle · Senioren · Frauen · Jugend',
);
ok(
  (await vis(page, 'Mannschaften').count()) > 0 &&
    (await vis(page, 'Spiele diese Woche').count()) > 0,
  'Blickfläche mit Kennzahlen',
);
ok((await vis(page, 'Bilanz Saison').count()) > 0, 'Bilanz der Saison beim Verein');
ok((await vis(page, /Training Ø/).count()) > 0, 'Training Ø beim Verein');
ok(
  (await vis(page, /^Kader: \d+ von \d+ verfügbar$/).count()) > 3,
  'Karten mit Kader verfügbar/gesamt',
);
ok((await vis(page, /Trainerteam/).count()) > 3, 'Trainerteam je Mannschaft');
ok((await vis(page, 'Trainingsbeteiligung').count()) > 3, 'Trainingsbeteiligung je Mannschaft');
ok((await vis(page, /\d+ % · (gut|mittel|niedrig)/).count()) > 0, 'Ampel mit Prozent und Wort');
ok((await vis(page, 'zu wenig Daten').count()) > 0, 'Wenig Daten: grauer Balken mit Hinweis');
ok(
  (await vis(page, /\d+ zugesagt · \d+ abgesagt · \d+ offen/).count()) > 0,
  'Nächstes Spiel mit zugesagt / abgesagt / offen',
);
ok(
  (await vis(page, /gut ab 65 %/).count()) === 0,
  'Keine Legende unter der Blickfläche (Paket ZE)',
);
// reine Übersicht: Karten sind nicht antippbar
const clickable = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(
    (e) => e.textContent?.trim() === 'Trainingsbeteiligung' && e.children.length === 0,
  );
  let n = el;
  while (n && n !== document.body) {
    if (n.getAttribute('role') === 'button' || n.tagName === 'A') return true;
    n = n.parentElement;
  }
  return false;
});
ok(!clickable, 'Mannschaftskarten sind nicht antippbar');
ok(
  !/Absagegründe|Kasse|Anwesenheitsliste/i.test(
    await page
      .locator('body')
      .innerText()
      .then((t) => t.replace(/Kasse|Verein/g, (m) => (m === 'Kasse' ? '' : m))),
  ),
  'Keine Gründe, Kasse oder Listen',
);
await b.shot(page, 'bu-oben', false);

// Reihenfolge: Jugend A → B → C
await radio('Jugend').click();
await page.waitForTimeout(1500);
const badges = await page.evaluate(() =>
  [...document.querySelectorAll('div[dir="auto"]')]
    .map((e) => e.textContent?.trim())
    .filter((t) => /^[A-G]\d$/.test(t ?? '')),
);
const sorted = [...badges].sort();
ok(
  badges.length > 2 && JSON.stringify(badges) === JSON.stringify(sorted),
  `Jugend nach Altersklasse sortiert (${badges.join(' ')})`,
);
ok((await vis(page, 'Bilanz Saison').count()) === 0, 'Bilanz nur beim gesamten Verein');
await radio('Alle').click();

// Umschalter nur mit eigener Mannschaft
const switchCount = await radio('Meine Mannschaft').count();
ok(
  me.teams.length > 0 ? switchCount > 0 : switchCount === 0,
  `Umschalter „Meine Mannschaft | Übersicht“ nur mit eigener Mannschaft (${me.teams.length} Mannschaften)`,
);

// Trainer ohne Leitungsrolle: keine Übersicht
const t = await b.session('trainer');
await t.goto('/team');
await t.page.waitForTimeout(3000);
ok((await vis(t.page, 'Bereichsübersicht').count()) === 0, 'Trainer sieht keine Bereichsübersicht');

// Trainer mit zusätzlicher Rolle „Sportliche Leitung“: Umschalter „Meine Mannschaft | Übersicht“
const admin = await b.session('admin');
const tme = await api('/me', t.login.token);
const detail = await api(`/admin/members/${tme.person.id}/roles`, admin.login.token, {
  method: 'POST',
  body: JSON.stringify({ roleKey: 'sports_director', scopeType: 'club' }),
});
const assignment = detail.roles.find((r) => r.roleKey === 'sports_director');
try {
  await t.page.reload();
  await t.page.waitForTimeout(3000);
  const modeRadio = (name) => t.page.getByRole('radio', { name, exact: true });
  await modeRadio('Meine Mannschaft').waitFor({ timeout: 20_000 });
  ok(
    (await modeRadio('Übersicht').count()) > 0,
    'Leitung mit Mannschaft: Umschalter „Meine Mannschaft | Übersicht“',
  );
  ok((await vis(t.page, 'Bereichsübersicht').count()) === 0, 'Standard: Meine Mannschaft');
  await modeRadio('Übersicht').click();
  await t.page.waitForTimeout(2000);
  ok((await vis(t.page, 'Bereichsübersicht').count()) > 0, 'Umschalten zeigt die Übersicht');
  await t.page.reload();
  await t.page.waitForTimeout(3000);
  ok((await vis(t.page, 'Bereichsübersicht').count()) > 0, 'Letzte Wahl wird gemerkt');
  await b.shot(t.page, 'bu-umschalter', false);
  await t.page.evaluate(() => localStorage.removeItem('clubroof.setting.teamTabMode'));
} finally {
  await del(`/admin/members/${tme.person.id}/roles/${assignment.id}`, admin.login.token);
}

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
