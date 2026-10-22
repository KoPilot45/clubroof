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
  const { page, goto, login } = await b.session('spieler', { width: 390, height: 1400 });
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
  // die Karten mit Antwortknöpfen stehen auf der Startseite („Diese Woche“); /termine zeigt zuerst nur das Plakat
  await goto('/');
  // der Offline-Zwischenspeicher zeigt sonst noch den alten Stand der Antwort
  await page.reload();
  await page.waitForTimeout(3500);
  // seit der neuen Terminkarte sind die Antworten Radioknöpfe „Absage“
  const decline = page
    .locator('[aria-label="Absage"][role="radio"]:not([disabled]):not([aria-disabled="true"])')
    .filter({ visible: true })
    .first();
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
    // die Punktzeile selbst ist breit („Spiel ansehen ›“ steht bewusst rechts in derselben Zeile): geprüft werden die Punkte
    const dots = await page.evaluate(() => {
      const rects = [...document.querySelectorAll('[data-testid="poster-dots"] > *')]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0);
      const left = Math.min(...rects.map((r) => r.left));
      const right = Math.max(...rects.map((r) => r.right));
      const top = Math.min(...rects.map((r) => r.top));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      return { x: left, y: top, width: right - left, height: bottom - top };
    });
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

// ── U08: Detail erscheint sofort sichtbar als Seitenpanel (1440 × 900) ────────
{
  const { page, goto, login } = await b.session('kasse', { width: 1440, height: 900 });
  const due = (await api('/club-cash/fees?status=overdue', login.token)).dues[0];
  await goto('/club-cash/fees');
  await text(page, due.personName, { exact: true }).click();
  const pay = page.getByText('Zahlung buchen', { exact: true }).filter({ visible: true }).first();
  await pay.waitFor({ timeout: 10_000 });
  const box = await pay.boundingBox();
  ok(
    box && box.y < 900,
    `Beiträge: Aktion „Zahlung buchen“ sofort sichtbar (y = ${Math.round(box?.y ?? 0)})`,
  );
  const panel = page.getByLabel(`${due.personName} · ${due.periodLabel}`).first();
  ok(await panel.isVisible(), 'Beiträge: Seitenpanel nennt den Datensatz');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  ok(!(await pay.isVisible()), 'Beiträge: Esc schließt das Panel, Liste bleibt');

  const entry = (await api('/club-cash/entries', login.token))[0];
  await goto('/club-cash/entries');
  await text(page, entry.purpose, { exact: true }).click();
  const entryPanel = page.getByLabel(entry.counterparty ?? entry.purpose, { exact: true }).first();
  await entryPanel.waitFor({ timeout: 10_000 });
  const pbox = await entryPanel.boundingBox();
  ok(
    pbox && pbox.y < 100 && pbox.x > 800,
    `Kassenbuch: Seitenpanel rechts, ohne Scrollen sichtbar (x = ${Math.round(pbox?.x ?? 0)}, y = ${Math.round(pbox?.y ?? 0)})`,
  );
}

// ── U03: Aufgabentitel vollständig, „Überspringen“ einzeilig, „Zur App“ ───────
for (const width of [360, 390]) {
  const { page, goto } = await b.session('trainer', { width, height: 800, tour: true });
  await goto('/');
  const skip = text(page, 'Überspringen', { exact: true });
  await skip.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);
  const sbox = await skip.boundingBox();
  ok(
    sbox && sbox.height < 30,
    `Tour ${width} px: „Überspringen“ steht in einer Zeile (Höhe ${Math.round(sbox?.height ?? 0)})`,
  );
  await skip.click();
  await goto('/absences/new');
  const title = page.getByRole('heading', { name: 'Abwesenheit eintragen' }).first();
  await title.waitFor({ timeout: 15_000 });
  const tbox = await title.boundingBox();
  ok(
    tbox && tbox.x >= 0 && tbox.x + tbox.width <= width,
    `Unterseite ${width} px: Titel „Abwesenheit eintragen“ vollständig sichtbar`,
  );
}
// ── U05: Personenkarten folgen dem Plakat ────────────────────────────────────
{
  const { page, goto, login } = await b.session('eltern', { width: 390, height: 900 });
  const home = await api('/home', login.token);
  const label = (e) => (e.match ? `vs. ${e.match.opponentName}` : e.title);
  ok(home.matches.length > 1, `Eltern-Home hat mehrere Spiele im Plakat (${home.matches.length})`);
  await goto('/');
  const next = page
    .getByRole('button', { name: 'Nächstes Spiel' })
    .filter({ visible: true })
    .first();
  await next.waitFor({ timeout: 20_000 });
  for (let i = 0; i < Math.min(3, home.matches.length); i++) {
    const e = home.matches[i];
    await page.waitForTimeout(900);
    const card = text(page, label(e), { exact: true });
    ok(
      await card.isVisible(),
      `Plakat ${i + 1}: Personenkarten nennen denselben Termin (${label(e)})`,
    );
    if (i < Math.min(3, home.matches.length) - 1) await next.click();
  }
}

// ── U06: Abwesenheit aus dem Kinderteam startet mit dem Kind ─────────────────
{
  const { page, goto, login } = await b.session('eltern', { width: 390, height: 900 });
  await goto('/team');
  await text(page, 'Abwesenheit melden', { exact: true }).click();
  const heading = page.getByText(/^Abwesenheit für /).first();
  await heading.waitFor({ timeout: 15_000 });
  const label = await heading.innerText();
  const child = login.me.managedPersons
    .filter((p) => p.relation === 'child')
    .map((p) => p.firstName);
  ok(
    child.some((name) => label === `Abwesenheit für ${name}`),
    `Abwesenheit aus dem Team: Kind vorgewählt (${label})`,
  );
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
