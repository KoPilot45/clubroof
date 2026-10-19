/**
 * BEDIENUNG-STABILISIEREN: U07 Pflichtgrund bei Absagen, U10 Home übersteht Fensterwechsel.
 * pnpm browser-check scripts/e2e/bedienung.mjs --no-build   (hell: SCHEME=light)
 */
import { api, launch, loginAs, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

// ── U07: Mannschaft verlangt einen Absagegrund ──────────────────────────────
const admin = await loginAs('admin');
const trainer = await loginAs('trainer');
const b1 = trainer.me.teams.find((t) => t.badge === 'B1');
await api(`/teams/${b1.id}/profile`, admin.token, {
  method: 'PUT',
  body: JSON.stringify({ declineReasonRequired: true }),
});
try {
  const { page, goto, login } = await b.session('spieler');
  // Ein kommender Termin der Mannschaft steht auf „offen“, damit ✓/✕ in der Liste erscheinen
  const from = new Date();
  const to = new Date(from.getTime() + 20 * 86_400_000);
  const events = await api(
    `/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    login.token,
  );
  const target = events.find(
    (e) => e.team?.id === b1.id && e.type === 'match' && e.myResponses.some((r) => r.canRespond),
  );
  ok(!!target, 'Testtermin der B-Jugend gefunden');
  const reset = await api(`/events/${target.id}/responses/${login.me.person.id}`, login.token, {
    method: 'PUT',
    body: JSON.stringify({ status: 'pending', reason: null }),
  });
  ok(reset.myResponses?.[0]?.status === 'pending', 'Testtermin steht auf offen');
  await goto('/termine');
  const decline = page.getByRole('button', { name: 'Absagen' }).filter({ visible: true }).first();
  await decline.waitFor({ timeout: 20_000 });
  await decline.click();
  await text(page, 'Absage senden', { exact: true }).click();
  const hint = page.getByRole('alert').filter({ hasText: 'Wähle einen Grund' });
  await hint.waitFor({ timeout: 5_000 });
  ok(true, 'Absagedialog der Liste: leere Pflichtangabe wird erklärt, nichts gesendet');
  await text(page, 'Krank', { exact: true }).click();
  ok(!(await hint.isVisible()), 'Meldung verschwindet mit der Eingabe');
} finally {
  await api(`/teams/${b1.id}/profile`, admin.token, {
    method: 'PUT',
    body: JSON.stringify({ declineReasonRequired: false }),
  });
}

// ── U01: Karussellpunkte überlagern nichts (360 und 390 px, kleine und große Schrift) ──
for (const width of [360, 390]) {
  for (const zoom of [1, 1.3]) {
    const { page, goto } = await b.session('trainer', { width, height: 900 });
    await goto('/');
    await page.getByTestId('poster-dots').waitFor({ timeout: 20_000 });
    await page.evaluate((z) => (document.body.style.zoom = String(z)), zoom);
    await page.waitForTimeout(600);
    const dots = await page.getByTestId('poster-dots').boundingBox();
    // alles Sichtbare im Plakat darf die Punktzeile nicht schneiden
    const clash = await page.evaluate((d) => {
      const hits = [];
      for (const el of document.querySelectorAll('div, span')) {
        if (el.dataset.testid === 'poster-dots' || el.closest('[data-testid="poster-dots"]'))
          continue;
        if (el.children.length > 0 || !el.textContent?.trim()) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const overlap =
          r.left < d.x + d.width && r.right > d.x && r.top < d.y + d.height && r.bottom > d.y;
        if (overlap) hits.push(el.textContent.trim().slice(0, 30));
      }
      return hits;
    }, dots);
    ok(
      clash.length === 0,
      `Plakat ${width} px, Schrift ×${zoom}: Punkte überlagern nichts ${clash.join(', ')}`,
    );
  }
}

// ── U04: begonnene Eingaben im Anlageformular gehen nicht still verloren ──────
{
  const { page, goto } = await b.session('admin');
  const open = async () => {
    await goto('/verein');
    await text(page, 'Mitglied anlegen', { exact: true }).click();
    await page.getByLabel('Vorname').waitFor({ timeout: 15_000 });
  };
  const back = () => page.getByRole('button', { name: 'Zurück' }).filter({ visible: true }).first();
  await open();
  await back().click();
  await page.waitForTimeout(600);
  ok(
    !(await text(page, 'Änderungen speichern?').isVisible()),
    'leeres Formular: Zurück ohne Rückfrage',
  );
  await open();
  await page.getByLabel('Vorname').fill('Entwurf');
  await back().click();
  await text(page, 'Änderungen speichern?').waitFor({ timeout: 5_000 });
  ok(true, 'begonnenes Formular: Rückfrage beim Verlassen');
  await text(page, 'Bleiben', { exact: true }).click();
  ok((await page.getByLabel('Vorname').inputValue()) === 'Entwurf', 'Bleiben erhält die Eingabe');
}

// ── U10: Fensterbreite wechseln, ohne dass eine Ansicht leer wird ────────────
{
  const { page, goto } = await b.session('trainer', { width: 1500, height: 900 });
  for (const route of ['/', '/team', '/termine', '/verein', '/mehr']) {
    await goto(route);
    await page.waitForTimeout(2500);
    let alive = true;
    for (const width of [1200, 800, 390, 1500, 1000, 390, 1300]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(700);
      const body = await page.locator('body').innerText();
      if (body.trim().length < 150 || body.includes('schiefgelaufen')) {
        alive = false;
        console.log(`  leer bei ${route} @ ${width}px (${body.trim().length} Zeichen)`);
      }
    }
    ok(alive, `Ansicht ${route} übersteht den Wechsel zwischen schmal, mittel und breit`);
  }
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
