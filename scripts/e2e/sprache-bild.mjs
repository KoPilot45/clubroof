/** Eine Übersichtsgrafik (Englisch) mit vier Bildschirmen, um Textlängen und Umbrüche zu prüfen. */
import { api, launch } from '../lib/e2e.mjs';
import { readFileSync } from 'node:fs';
const b = await launch();
const s = await b.session('trainer');
await api('/me/preferences', s.login.token, {
  method: 'PUT',
  body: JSON.stringify({ language: 'en' }),
});
const me = await api('/me', s.login.token);
const team = me.teams[0].id;
const pages = ['/team', '/termine', `/teams/${team}/cash-admin`, '/mehr'];
const files = [];
for (const [i, p] of pages.entries()) {
  await s.goto(p);
  await s.page.waitForTimeout(2500);
  const f = `.check/shots/en-${i}.png`;
  await s.page.screenshot({ path: f, fullPage: false });
  files.push(f);
}
await api('/me/preferences', s.login.token, {
  method: 'PUT',
  body: JSON.stringify({ language: null }),
});
// Bilder nebeneinander zu einer Übersicht zusammenfügen
const html = files
  .map(
    (f) =>
      `<img style="height:844px" src="data:image/png;base64,${readFileSync(f).toString('base64')}">`,
  )
  .join('');
const m = await s.page.context().newPage();
await m.setViewportSize({ width: 390 * files.length, height: 844 });
await m.setContent(`<body style="margin:0;display:flex;gap:0">${html}</body>`);
await m.screenshot({ path: '.check/shots/en-uebersicht.png' });
await b.close();
console.log('📷 .check/shots/en-uebersicht.png');
