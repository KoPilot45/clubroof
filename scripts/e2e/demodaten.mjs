/**
 * DEMODATEN-AUSBAU: Trainingsbeteiligung aller Mannschaften, Avatare, News mit Bildern, Hilfe mit Downloads.
 * pnpm browser-check scripts/e2e/demodaten.mjs --reset   (Bilder: SHOTS=1; hell: SCHEME=light)
 */
import { api, launch, loginAs, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const shots = !!process.env.SHOTS;

// ── API: Trainingsquote je Mannschaft aus Sicht der Verwaltung ─────────────────────────────
const coach = await loginAs('trainer');
let withRate = 0;
for (const t of coach.me.teams) {
  const stats = await api(`/teams/${t.id}/stats`, coach.token);
  const rate = stats.highlights?.trainingRate ?? null;
  if (rate != null) withRate++;
  console.log(`  ${t.badge}: Trainingsquote ${rate ?? '–'} %`);
}
ok(
  withRate === coach.me.teams.length,
  'Trainerin sieht eine Trainingsquote bei allen ihren Mannschaften',
);

// offene Anwesenheit (Kachel „Anwesenheit erfassen“) bei B1 und C1
const home = await api('/home', coach.token);
const open = (home.actions ?? []).filter((a) => a.title === 'Anwesenheit erfassen');
ok(open.length >= 1, 'Startseite der Trainerin bietet „Anwesenheit erfassen“ an');

// ── Oberfläche ─────────────────────────────────────────────────────────────────────────
const { page, goto } = await b.session('trainer', { width: 1280, height: 900 });
const b1 = coach.me.teams.find((t) => t.badge === 'B1');
await goto(`/team?teamId=${b1.id}`);
await text(page, 'Kader', { exact: true }).waitFor({ timeout: 15_000 });
if (shots) await b.shot(page, 'dd-team-b1', false);
await goto(`/teams/${b1.id}/roster`);
await page.waitForTimeout(1500);
if (shots) await b.shot(page, 'dd-kader', false);
await goto('/news');
await page.waitForTimeout(1500);
if (shots) await b.shot(page, 'dd-news', false);
await goto('/verein');
await text(page, 'Neuigkeiten', { exact: false })
  .waitFor({ timeout: 15_000 })
  .catch(() => {});
if (shots) await b.shot(page, 'dd-verein', false);
const adminSession = await b.session('admin', { width: 1280, height: 900 });
await adminSession.goto('/help');
const q = adminSession.page.getByText('Gibt es Beispieldateien zum Ausprobieren?').first();
await q.waitFor({ timeout: 15_000 });
await q.click();
ok(
  await adminSession.page.getByText('Mitglieder (CSV)').first().isVisible(),
  'Hilfe zeigt die Download-Knöpfe der Beispieldateien',
);
const csv = await fetch(
  `${process.env.CLUBROOF_API ?? 'http://localhost:3999'}/beispieldateien/mitglieder.csv`,
);
ok(csv.ok, 'Beispieldatei lässt sich laden');

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
