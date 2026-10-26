/**
 * ICH-VERWALTUNGSZUGAENGE: Admin-Verwaltung (violett) und Vereinskasse (blau) als Knöpfe unter dem Profil in „Ich“ und
 * als Kacheln in „Verein → Meine Vereinsaufgaben“ – je Rolle, Handy und Desktop.
 * pnpm browser-check scripts/e2e/ich-zugaenge.mjs --no-build   (hell: SCHEME=light; Bilder: SHOTS=1)
 */
import { launch, loginAs } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const shots = !!process.env.SHOTS;

// erwartet je Rolle (aus den Demodaten): [Admin-Verwaltung, Vereinskasse]
const ROLES = {
  admin: [true, true],
  kasse: [false, true],
  trainer: [false, false],
  spieler: [false, false],
  // Kassenprüfer (Demo-Login „mitglied“) dürfen die Vereinskasse lesen und öffnen
  mitglied: [false, true],
};

for (const [who, [wantAdmin, wantCash]] of Object.entries(ROLES)) {
  const me = (await loginAs(who)).me;
  // dieselbe Prüfung wie die App (lib/areas.ts), damit Rechte und Anzeige nicht auseinanderlaufen
  const canAdmin = me.canAdminister || Object.values(me.admin).some(Boolean);
  const canCash = me.clubCash?.viewer === 'treasury';
  ok(
    canAdmin === wantAdmin && canCash === wantCash,
    `${who}: Rechte wie erwartet (Verwaltung ${wantAdmin}, Kasse ${wantCash})`,
  );

  for (const [label, size] of [
    ['Handy', { width: 390, height: 1000 }],
    ['Desktop', { width: 1280, height: 900 }],
  ]) {
    const { page, goto } = await b.session(who, size);
    await goto('/mehr');
    await page.waitForTimeout(2500);
    const adminBtn = page.getByRole('button', { name: 'Admin-Verwaltung', exact: true });
    const cashBtn = page.getByRole('button', { name: 'Vereinskasse', exact: true });
    const row = page.getByTestId('area-buttons');
    ok(
      (await adminBtn.count()) > 0 === wantAdmin && (await cashBtn.count()) > 0 === wantCash,
      `${who} ${label}: Ich zeigt ${wantAdmin ? 'Admin-Verwaltung' : 'keine Verwaltung'}, ${wantCash ? 'Vereinskasse' : 'keine Kasse'}`,
    );
    ok(
      (await row.count()) === (wantAdmin || wantCash ? 1 : 0),
      `${who} ${label}: ${wantAdmin || wantCash ? 'Knopfzeile vorhanden' : 'keine leere Zeile'}`,
    );
    if (wantAdmin || wantCash) {
      // unter dem Profil und vor „Ich und Familie“
      const hero = await page.getByText(me.user.email, { exact: true }).first().boundingBox();
      const familie = await page
        .getByText('Ich und Familie', { exact: true })
        .first()
        .boundingBox();
      const r = await row.boundingBox();
      ok(
        hero && familie && r && r.y > hero.y && r.y < familie.y,
        `${who} ${label}: Knöpfe stehen unter dem Profil und vor „Ich und Familie“`,
      );
      const first = await (wantAdmin ? adminBtn : cashBtn).boundingBox();
      ok(
        first.height >= 44,
        `${who} ${label}: Knopf mindestens 44 pt hoch (${Math.round(first.height)})`,
      );
      if (shots) await b.shot(page, `iz-${who}-${label.toLowerCase()}`, false);
    }
    // „Verein“: dieselben Zugänge als Kacheln
    await goto('/verein');
    await page.waitForTimeout(2500);
    // Die Gruppe kann auch andere Aufgaben enthalten (z. B. Redaktion); mit Zugang zu Verwaltung oder Kasse muss sie da sein
    if (wantAdmin || wantCash)
      ok(
        (await page.getByText('Meine Vereinsaufgaben', { exact: true }).count()) > 0,
        `${who} ${label}: Verein zeigt „Meine Vereinsaufgaben“`,
      );
  }
}

// Knopf führt in den Bereich
{
  const { page, goto } = await b.session('admin', { width: 390, height: 1000 });
  await goto('/mehr');
  await page.getByRole('button', { name: 'Admin-Verwaltung', exact: true }).click();
  await page.waitForURL(/\/admin/, { timeout: 15_000 });
  ok(true, 'Admin-Verwaltung öffnet den Verwaltungsbereich');
  await goto('/mehr');
  await page.getByRole('button', { name: 'Vereinskasse', exact: true }).click();
  await page.waitForURL(/\/club-cash/, { timeout: 15_000 });
  ok(true, 'Vereinskasse öffnet die Vereinskasse');
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(failed || b.errors.length ? 1 : 0);
