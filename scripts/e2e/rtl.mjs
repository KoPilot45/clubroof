/**
 * Browserprüfung Arabisch (rechts-nach-links): Konto auf Arabisch stellen, Schreibrichtung, Schrift,
 * gespiegeltes Layout und waagerechten Überlauf prüfen.
 * Aufruf: pnpm browser-check scripts/e2e/rtl.mjs --no-build   (Bild: RTL_SHOT=pfad.png)
 */
import { api, launch } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

const s = await b.session('trainer');
const setLanguage = (language) =>
  api('/me/preferences', s.login.token, { method: 'PUT', body: JSON.stringify({ language }) });

await setLanguage('ar');
const routes = (process.env.LANG_ROUTES ?? '/,/team,/termine,/verein,/mehr,/account,/help').split(
  ',',
);
for (const route of routes) {
  await s.goto(route);
  await s.page.waitForTimeout(2000);
  const info = await s.page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body.innerText;
    return {
      dir: doc.dir,
      lang: doc.lang,
      arabic: /[؀-ۿ]/.test(body),
      overflow: doc.scrollWidth - doc.clientWidth,
      german: body
        .split('\n')
        .filter((l) => /[äöüß]|\b(und|nicht|für|mit)\b/i.test(l))
        .slice(0, 3),
    };
  });
  ok(info.dir === 'rtl' && info.lang === 'ar', `${route}: Richtung rtl, Sprache ar`);
  ok(info.arabic, `${route}: arabischer Text sichtbar`);
  ok(info.overflow <= 1, `${route}: kein waagerechter Überlauf (${info.overflow}px)`);
  if (info.german.length) console.log(`  noch deutsch: ${info.german.join(' | ')}`);
}

// Spiegelung: auf der Startseite steht der erste Tab rechts von den späteren
await s.goto('/');
await s.page.waitForTimeout(1500);
const mirrored = await s.page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')].map(
    (e) => e.getBoundingClientRect().x,
  );
  return tabs.length < 2 || tabs[0] > tabs[tabs.length - 1];
});
ok(mirrored, 'Navigation gespiegelt (erster Eintrag rechts)');

if (process.env.RTL_SHOT) await s.page.screenshot({ path: process.env.RTL_SHOT });
await setLanguage(null);
await s.goto('/');
await s.page.waitForTimeout(1000);
ok(
  (await s.page.evaluate(() => document.documentElement.dir)) === 'ltr',
  'Zurück auf Automatisch: Richtung ltr',
);
ok(
  b.errors.length === 0,
  b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler',
);
await b.close();
process.exit(failed ? 1 : 0);
