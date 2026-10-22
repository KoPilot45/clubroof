/**
 * NAVIGATION-NEUORDNUNG: Start · Termine · Team · Verein · Ich – Reihenfolge, Gruppen, nichts unerreichbar.
 * pnpm browser-check scripts/e2e/navigation.mjs --no-build   (hell: SCHEME=light)
 */
import { api, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const body = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
// Zwischenüberschriften stehen in Großbuchstaben (CSS): ohne Beachtung der Schreibweise vergleichen
const has = (haystack, word) => haystack.toLowerCase().includes(word.toLowerCase());

// ── Reihenfolge der Hauptbereiche (Handy und Desktop) ────────────────────────
{
  const { page, goto } = await b.session('trainer', { width: 390, height: 844 });
  await goto('/');
  await page.waitForTimeout(2500);
  const labels = await page
    .getByRole('tab')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent?.trim()));
  console.log('  Leiste:', labels.join(' | '));
  const order = ['Start', 'Termine', 'Team', 'Verein', 'Ich'];
  const found = order.map((n) => labels.findIndex((l) => l?.includes(n)));
  ok(
    found.every((i, k) => i >= 0 && (k === 0 || i > found[k - 1])),
    'Handy: Start · Termine · Team · Verein · Ich',
  );
}
{
  const { page, goto } = await b.session('trainer', { width: 1440, height: 900 });
  await goto('/');
  await page.waitForTimeout(2500);
  const side = await body(page);
  const idx = ['Start', 'Termine', 'Team', 'Verein', 'Ich'].map((n) => side.indexOf(n));
  ok(
    idx.every((i, k) => i >= 0 && (k === 0 || i > idx[k - 1])),
    'Desktop-Seitenleiste: gleiche Reihenfolge',
  );
}

// ── Ich: drei Abschnitte, Persönliches; Verwaltung/Kasse nicht mehr hier ─────
{
  const { page, goto } = await b.session('eltern', { width: 390, height: 844 });
  await goto('/mehr');
  await page
    .getByText(/ich und familie/i)
    .first()
    .waitFor({ timeout: 20_000 });
  const t = await body(page);
  for (const w of [
    'Meine Kinder',
    'Ich und Familie',
    'Einstellungen',
    'Hilfe und Informationen',
    'Abwesenheiten',
    'Konto & Einstellungen',
    'Hilfe & Anleitung',
    'Benachrichtigungen',
    'Meine Mannschaften',
  ])
    ok(has(t, w), `Ich (Eltern): „${w}“ erreichbar`);
  ok(!has(t, 'Admin-Verwaltung'), 'Ich: kein Verwaltungszugang mehr im Kopf');
}

// ── Verein: feste Gruppen, Vereinsaufgaben für Admin und Kasse ───────────────
for (const [who, must] of [
  ['admin', ['Meine Vereinsaufgaben', 'Verwaltung', 'Vereinskasse', 'Mitglied anlegen']],
  ['kasse', ['Meine Vereinsaufgaben', 'Vereinskasse']],
  ['mitglied', ['Aktuelles und Mitmachen', 'Wissen und Kontakte', 'Unser Verein']],
]) {
  const { page, goto } = await b.session(who, { width: 390, height: 844 });
  await goto('/verein');
  await page
    .getByText(/aktuelles und mitmachen/i)
    .first()
    .waitFor({ timeout: 20_000 });
  const t = await body(page);
  for (const w of ['Aktuelles und Mitmachen', 'Wissen und Kontakte', ...must])
    ok(has(t, w), `Verein (${who}): „${w}“`);
}
{
  const { page, goto } = await b.session('spieler', { width: 390, height: 844 });
  await goto('/verein');
  await page
    .getByText(/aktuelles und mitmachen/i)
    .first()
    .waitFor({ timeout: 20_000 });
  ok(
    !has(await body(page), 'Meine Vereinsaufgaben'),
    'Verein (Spieler): keine Vereinsaufgaben ohne Rechte',
  );
}

// ── Team: Gruppen und Kontext „C1 · Trainer“ ─────────────────────────────────
{
  const { page, goto } = await b.session('trainer', { width: 390, height: 844 });
  await goto('/team');
  await page
    .getByText(/training und spiel/i)
    .first()
    .waitFor({ timeout: 20_000 });
  const t = await body(page);
  for (const w of ['Training und Spiel', 'Mannschaft', 'Organisation', 'Kader', 'Termine'])
    ok(has(t, w), `Team (Trainer): „${w}“`);
  ok(/B1 · Trainer|C1 · Trainer/.test(t), 'Team: Kontext „Mannschaft · Funktion“ sichtbar');
}
{
  const { page, goto } = await b.session('eltern', { width: 390, height: 844 });
  await goto('/team');
  await page
    .getByText(/training und spiel/i)
    .first()
    .waitFor({ timeout: 20_000 });
  ok(/Leon · E1|Mia · F1/.test(await body(page)), 'Team (Eltern): Kontext „Leon · E1“ sichtbar');
}

// ── Team am Desktop: keine Überlagerung der Kachelgruppen (kompakt 1250 px und weit 1891 px) ──
for (const width of [1250, 1440, 1891]) {
  const { page, goto } = await b.session('trainer', { width, height: 900 });
  await goto('/team');
  await page
    .getByText(/nächste spiele/i)
    .first()
    .waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  const stat = await page
    .getByRole('button', { name: /^Statistik/ })
    .first()
    .boundingBox();
  const next = await page
    .getByText(/^nächste spiele$/i)
    .first()
    .boundingBox();
  ok(
    !!stat && !!next && stat.y + stat.height <= next.y + 1,
    `Team ${width} px: Kachelgruppen überlagern „Nächste Spiele“ nicht (Statistik unten ${Math.round((stat?.y ?? 0) + (stat?.height ?? 0))}, Überschrift ${Math.round(next?.y ?? 0)})`,
  );
}

// ── Termine: Kalender-Abo auch von hier ──────────────────────────────────────
{
  const { page, goto } = await b.session('eltern', { width: 390, height: 844 });
  await goto('/termine');
  await text(page, /Kalender-Abo/).waitFor({ timeout: 20_000 });
  ok(true, 'Termine: Kalender-Abo erreichbar');
}

// ── Interaktionsregeln: Aktionsknopf führt nur die Aktion aus, Bestätigung benennt den Vorgang ──
{
  const { page, goto, login } = await b.session('spieler', { width: 390, height: 900 });
  const from = new Date();
  const to = new Date(from.getTime() + 20 * 86_400_000);
  const events = await api(
    `/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    login.token,
  );
  // alle antwortbaren Termine auf „offen“ (die erste Karte der Startseite ist dann sicher eine offene)
  const answerable = events.filter((e) => e.myResponses.some((r) => r.canRespond));
  for (const e of answerable)
    await api(`/events/${e.id}/responses/${login.me.person.id}`, login.token, {
      method: 'PUT',
      body: JSON.stringify({ status: 'pending', reason: null }),
    });
  const answered = async () => {
    const list = [];
    for (const e of answerable) {
      const d = await api(`/events/${e.id}`, login.token);
      if (d.myResponses[0].status !== 'pending') list.push(e);
    }
    return list;
  };
  const target = answerable.find((e) => e.type === 'match') ?? answerable[0];
  await goto('/');
  await page.reload();
  await page.waitForTimeout(3500);
  const yes = page
    .locator('[aria-label="Zusage"][role="radio"]:not([disabled]):not([aria-disabled="true"])')
    .filter({ visible: true })
    .first();
  await yes.waitFor({ timeout: 20_000 });
  await yes.click();
  await text(page, 'Teilnahme bestätigt').waitFor({ timeout: 10_000 });
  ok(
    new URL(page.url()).pathname === '/',
    'Antwortknopf auf der Karte öffnet keine Details, Bestätigung nennt den Vorgang',
  );
  ok((await answered()).length === 1, 'genau eine Antwort wurde gespeichert');
  await text(page, 'Rückgängig', { exact: true }).click();
  await page.waitForTimeout(800);
  ok((await answered()).length === 0, 'Rückgängig stellt die vorherige Antwort her');
  await goto('/termine');
  await page.waitForTimeout(1500);
  // Karte öffnet Details
  // welche Karten die Liste oben zeigt, hängt vom Wochentag ab: die erste sichtbare Karte eines antwortbaren Termins
  let card = null;
  for (const e of answerable) {
    const hit = page.getByText(e.title, { exact: true }).filter({ visible: true }).last();
    if (await hit.count()) {
      card = hit;
      break;
    }
  }
  await card.click();
  await page.waitForURL(/\/events\//, { timeout: 10_000 });
  ok(true, 'Karte öffnet die gemeinsamen Termindetails');
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
