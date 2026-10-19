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
