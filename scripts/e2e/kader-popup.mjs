/**
 * Paket KP: Kader-Pop-up aus Termin-Hero, Home-Plakat und Team-Reiter; Rechte (Freigabe, Gründe nur Trainerteam).
 * pnpm browser-check scripts/e2e/kader-popup.mjs --no-build   (danach pnpm db:reset)
 */
import { api, launch, loginAs, text } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const b = await launch();

/** Das Home-Plakat enthält Klone außerhalb des Bildes (Endlosschleife): den sichtbaren Auslöser wählen. */
async function visibleTrigger(page) {
  const all = await page.getByRole('button', { name: /Kader anzeigen/ }).all();
  for (const el of all) {
    const box = await el.boundingBox();
    if (box && box.x >= 0 && box.x < 390) {
      // nicht unter der schwebenden unteren Leiste klicken
      await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
      return el;
    }
  }
  throw new Error('kein sichtbarer Kader-Auslöser');
}

// Trainer: Hero, Home, Team öffnen das Pop-up; Reihenfolge der Gruppen; Termin öffnen
{
  const { page, goto, login } = await b.session('trainer');
  const events = await api('/events', login.token);
  const match = events.find((e) => e.type === 'match' && e.status === 'scheduled' && e.counts);
  await goto(`/events/${match.id}`);
  await text(page, 'Kader ›', { exact: true }).click({ timeout: 15_000 });
  await text(page, /^KADER/i).waitFor({ timeout: 10_000 });
  const heads = await page
    .locator('text=/^(Zusagen|Unsicher|Offen|Absagen|Abwesend)$/')
    .allTextContents();
  const order = ['Zusagen', 'Unsicher', 'Offen', 'Absagen', 'Abwesend'];
  const idx = heads.map((h) => order.indexOf(h));
  ok(
    heads.length > 0 && idx.every((v, i) => i === 0 || v > idx[i - 1]),
    `Gruppen in Reihenfolge: ${heads.join(' · ')}`,
  );
  ok(
    (await page.getByText('Termin öffnen').count()) === 0,
    'im Termin-Detail kein „Termin öffnen“',
  );
  await page.getByRole('button', { name: 'Schließen' }).last().click();

  await goto('/');
  await text(page, 'Zum Spiel ›').waitFor({ timeout: 15_000 });
  ok(true, 'Home-Plakat zeigt „Zum Spiel ›“');
  await (await visibleTrigger(page)).click();
  await text(page, /^KADER/i).waitFor({ timeout: 10_000 });
  await text(page, 'Termin öffnen').click();
  await page.waitForURL(/\/events\//, { timeout: 10_000 });
  ok(true, 'Home: Kader-Pop-up öffnet, „Termin öffnen“ führt zum Termin');

  await goto('/team');
  await page
    .getByRole('button', { name: /Kader anzeigen/ })
    .first()
    .click({ timeout: 15_000 });
  await text(page, /^KADER/i).waitFor({ timeout: 10_000 });
  ok(true, 'Team-Reiter öffnet das Kader-Pop-up');
}

// Spieler: ohne Freigabe fehlt der Auslöser, mit Freigabe keine Gründe
{
  const trainer = await loginAs('trainer');
  const spieler = await loginAs('spieler');
  const team = trainer.me.teams.find((t) => spieler.me.teams.some((x) => x.id === t.id));
  const profile = await api(`/teams/${team.id}/profile`, trainer.token);
  const put = (v) =>
    api(`/teams/${team.id}/profile`, trainer.token, {
      method: 'PUT',
      body: JSON.stringify({ ...profile, responsesVisible: v }),
    });
  try {
    const { page, goto, login } = await b.session('spieler');
    const events = await api('/events', login.token);
    const ev = events.find((e) => e.team?.id === team.id && e.status === 'scheduled' && e.counts);
    await goto(`/events/${ev.id}`);
    await text(page, 'Kader ›', { exact: true }).click({ timeout: 15_000 });
    await text(page, /^KADER/i).waitFor({ timeout: 10_000 });
    ok((await page.getByText(/„/).count()) === 0, 'Spieler sieht keine Gründe im Kader');
    await put(false);
    await goto(`/events/${ev.id}`);
    await text(page, 'Deine Antwort', { exact: true }).waitFor({ timeout: 15_000 });
    ok(
      (await page.getByText('Kader ›', { exact: true }).count()) === 0,
      'ohne Freigabe kein „Kader ›“',
    );
  } finally {
    await put(true);
  }
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(fail || b.errors.length ? 1 : 0);
