/**
 * Paket LH2: Sonderfälle in einer Darstellung aufnehmen (Fenster, Dialog, Zeitwalze, Leerzustand, Menü).
 * SCHEME=light|(dunkel) pnpm browser-check scripts/e2e/hell-sonderfaelle.mjs --no-build
 * Bilder: .check/shots/sonder-<hell|dunkel>-<n>.png
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const tag = process.env.SCHEME === 'light' ? 'hell' : 'dunkel';
const b = await launch();
const shot = (page, n) => b.shot(page, `sonder-${tag}-${n}`, false);
const tryStep = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    console.log(`– ${label}: ${String(e).split('\n')[0].slice(0, 80)}`);
  }
};

const { page, goto, login } = await b.session('trainer');
const events = await api('/events', login.token);
const training = events.find((e) => e.type === 'training' && e.status === 'scheduled');

// 1 Fenster von unten: Absagegrund
await tryStep('Absagefenster', async () => {
  await goto(`/events/${training.id}`);
  await button(page, 'Absagen').click({ timeout: 8000 });
  await page.waitForTimeout(800);
  await shot(page, 1);
});

// 2 Dialog „Wirklich löschen?“
await tryStep('Löschdialog', async () => {
  const team = login.me.teams[0];
  await goto(`/teams/${team.id}/fines`);
  await page.waitForTimeout(1500);
  await page
    .getByText(/× vergeben|noch nicht vergeben/)
    .first()
    .click({ timeout: 8000 });
  await button(page, 'Entfernen').click({ timeout: 8000 });
  await page.waitForTimeout(600);
  await shot(page, 2);
});

// 3 Zeitwalze im Termin anlegen
await tryStep('Zeitwalze', async () => {
  const team = login.me.teams[0];
  await goto(`/teams/${team.id}/event-new`);
  await page.waitForTimeout(1500);
  await page
    .getByText(/^\d{2}:\d{2}$/)
    .first()
    .click({ timeout: 8000 });
  await page.waitForTimeout(600);
  await shot(page, 3);
});

// 4 Leerzustand und Fehler: Fundbüro / Tauschbörse
await tryStep('Leerzustand', async () => {
  await goto('/exchange');
  await page.waitForTimeout(1500);
  await shot(page, 4);
});

// 5 Suche und Hilfe
await tryStep('Suche', async () => {
  await goto('/search');
  await page.waitForTimeout(800);
  await page.getByRole('textbox').first().fill('Sp');
  await page.waitForTimeout(1500);
  await shot(page, 5);
});
await text(page, 'x')
  .count()
  .catch(() => 0);
await b.close();
