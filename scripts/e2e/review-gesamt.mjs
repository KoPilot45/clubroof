/** Gesamtprüfung (Optik, Wording, Navigation): Bilder der Hauptbildschirme je Rolle nach .check/shots/review-*.png */
import { launch } from '../lib/e2e.mjs';
import { mkdirSync } from 'node:fs';

const out = '.check/shots';
mkdirSync(out, { recursive: true });
const b = await launch();
const plan = {
  trainer: ['/', '/team', '/termine', '/verein', '/mehr'],
  eltern: ['/', '/team', '/termine', '/verein', '/mehr'],
  admin: ['/admin', '/admin/members', '/admin/modules', '/admin/club', '/search'],
  kasse: ['/', '/team', '/mehr', '/help', '/notification-settings'],
};
for (const [who, paths] of Object.entries(plan)) {
  const { page, goto } = await b.session(who);
  for (const [i, p] of paths.entries()) {
    await goto(p);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/review-${who}-${i}.png`, fullPage: true });
  }
  const text = [];
  for (const p of paths) {
    await goto(p);
    await page.waitForTimeout(1200);
    text.push(`### ${who} ${p}\n` + (await page.innerText('body')));
  }
  (await import('node:fs')).writeFileSync(`${out}/review-${who}.txt`, text.join('\n\n'));
}
console.log(b.errors.length ? `Fehler:\n${b.errors.join('\n')}` : 'keine Konsolenfehler');
await b.close();
