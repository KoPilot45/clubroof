/**
 * Aufräumpaket: Austrittsschutz bei Transfer, Mannschaftstermin und Börse (U04) und Terminkarte mit abgelaufener Frist.
 * pnpm browser-check scripts/e2e/aufraeumen.mjs --no-build   (hell: SCHEME=light; Bilder: SHOTS=1)
 */
import { api, del, launch, loginAs, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const shots = !!process.env.SHOTS;

// ── U04: Austrittsschutz ──────────────────────────────────────────────────────────────
async function guard(who, path, prepare, name) {
  const s = await b.session(who);
  await s.goto('/');
  await s.goto(path);
  await prepare(s.page, s.login);
  const back = () =>
    s.page.getByRole('button', { name: 'Zurück' }).filter({ visible: true }).first();
  await back().click();
  const shown = await text(s.page, 'Änderungen speichern?')
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  ok(shown, `${name}: Rückfrage beim Verlassen mit Eingaben`);
  if (shown) {
    await s.page.getByText('Bleiben', { exact: true }).filter({ visible: true }).first().click();
    ok(s.page.url().includes(path.split('?')[0]), `${name}: „Bleiben“ lässt das Formular stehen`);
  }
  // ohne Eingaben keine Rückfrage
  await s.goto('/');
  await s.goto(path);
  await s.page.waitForTimeout(800);
  await back().click();
  const asked = await text(s.page, 'Änderungen speichern?')
    .waitFor({ timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  ok(!asked, `${name}: leeres Formular ohne Rückfrage`);
}
const trainer = await loginAs('trainer');
const b1 = trainer.me.teams.find((t) => t.badge === 'B1');
await guard(
  'admin',
  '/admin/transfer-new',
  async (p) => {
    await text(p, 'Zugang', { exact: true }).click();
  },
  'Spielerbewegung',
);
await guard(
  'trainer',
  `/teams/${b1.id}/event-new`,
  async (p) => {
    await p.getByRole('textbox').last().fill('Kurze Notiz zum Termin');
  },
  'Mannschaftstermin',
);
await guard(
  'trainer',
  '/exchange/new-demand',
  async (p) => {
    await p.getByRole('textbox').last().fill('Wir suchen einen Torwart');
  },
  'Börse: Bedarf',
);
await guard(
  'trainer',
  '/exchange/new-offer',
  async (p) => {
    await p.getByRole('textbox').last().fill('Zwei Spieler übrig');
  },
  'Börse: Angebot',
);

// ── Terminkarte: Frist abgelaufen ──────────────────────────────────────────────────────
const start = new Date(Date.now() + 45 * 60_000);
const created = await api(`/teams/${b1.id}/events`, trainer.token, {
  method: 'POST',
  body: JSON.stringify({
    type: 'training',
    title: null,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 90 * 60_000).toISOString(),
    locationText: 'Kunstrasen (Test)',
    allowConflict: true,
  }),
});
try {
  const s = await b.session('spieler', { width: 390, height: 1400 });
  await s.goto('/termine');
  const seen = await text(s.page, 'Frist abgelaufen')
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  ok(seen, 'Terminkarte zeigt „Frist abgelaufen“ mit Hinweis');
  if (shots) await b.shot(s.page, 'au-frist', false);
} finally {
  await del(`/events/${created.id}`, trainer.token).catch(() => {});
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
