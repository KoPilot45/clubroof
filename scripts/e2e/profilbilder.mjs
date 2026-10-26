/**
 * Paket DEMO-PROFILBILDER-LOGO: alle Profilbilder und das Wappen laden (kein kaputtes Symbol), hell und dunkel.
 * pnpm browser-check scripts/e2e/profilbilder.mjs --no-build        (hell: SCHEME=light davor)
 * Bildübersicht nur mit SHOTS=1 (sonst nur Textprüfung).
 */
import { launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = 0;
const ok = (c, m) => {
  console.log(`${c ? '✓' : '✗'} ${m}`);
  if (!c) failed++;
};

/** Zählt Bilder der Seite und meldet die, die nicht geladen haben. */
async function bilder(page, label) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() =>
    [...document.images]
      .filter((i) => /\/brand\/demo-(avatar|wappen)/.test(i.src) || i.closest('[role=img]'))
      .map((i) => ({
        src: i.src,
        ok: i.complete && i.naturalWidth > 0,
        w: i.getBoundingClientRect().width,
      })),
  );
  const kaputt = r.filter((i) => !i.ok);
  ok(
    kaputt.length === 0,
    `${label}: ${r.length} Bilder, ${kaputt.length} kaputt ${kaputt.map((k) => k.src).join(' ')}`,
  );
  return r;
}

for (const [who, width, height] of [
  ['admin', 1440, 900],
  ['admin', 390, 844],
  ['trainer', 390, 844],
  ['eltern', 390, 844],
  ['spieler', 390, 844],
]) {
  const { page, goto, login } = await b.session(who, { width, height });
  const tag = `${who} ${width}`;
  const bild = async (pfad, name, warte) => {
    await goto(pfad);
    if (warte)
      await text(page, warte)
        .first()
        .waitFor({ timeout: 20_000 })
        .catch(() => {});
    const r = await bilder(page, `${tag} ${pfad}`);
    if (process.env.SHOTS) await b.shot(page, `profilbilder-${who}-${width}-${name}`, false);
    return r;
  };
  const wappen = (await bild('/', 'start')).filter((i) => i.src.includes('demo-wappen'));
  ok(wappen.length > 0 || width < 1000, `${tag}: Wappen in Kopfzeile/Seitenleiste`);
  await bild('/profil', 'profil');
  const t = login.me.teams?.[0];
  if (t) await bild(`/team?teamId=${t.id}`, 'team');
  if (who === 'admin') {
    await bild('/admin/members', 'mitglieder');
    await bild('/admin/club', 'verein');
  }
  if (who === 'eltern') await bild('/mehr', 'kinder');
}

const anon = await b.anonymous({ width: 1440, height: 900 });
await anon.goto('/login');
await anon.page.waitForTimeout(1500);
await bilder(anon.page, 'Anmeldeseite Desktop');
if (process.env.SHOTS) await b.shot(anon.page, 'profilbilder-login', false);

ok(b.errors.length === 0, `keine Konsolenfehler ${b.errors.join(' | ')}`);
await b.close();
process.exit(failed ? 1 : 0);
