/** Sichtbarkeit je Rolle: Meldungen aus /me und die Texte der fünf Reiter → .check/rollen/<rolle>.json */
import { launch, loginAs } from '../lib/e2e.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('.check/rollen', { recursive: true });
const roles = ['admin', 'vorstand', 'trainer', 'spieler', 'eltern', 'kasse', 'mitglied'];
const b = await launch();
for (const who of roles) {
  const { page, goto, login } = await b.session(who, { height: 1500 });
  const me = login.me;
  const out = {
    who,
    teams: (me.teams ?? []).map((t) => `${t.badge}:${t.role ?? t.function ?? ''}`),
    roles: (me.roles ?? me.assignments ?? [])
      .map((r) => r.roleName ?? r.name ?? JSON.stringify(r))
      .slice(0, 8),
    flags: {
      canAdminister: me.canAdminister,
      admin: me.admin,
      news: me.news,
      clubCash: me.clubCash,
      children: (me.children ?? []).length,
    },
    pages: {},
  };
  for (const [name, path] of [
    ['home', '/'],
    ['team', '/team'],
    ['termine', '/termine'],
    ['verein', '/verein'],
    ['mehr', '/mehr'],
  ]) {
    await goto(path);
    await page.waitForTimeout(2200);
    const lines = (await page.innerText('body'))
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && s.length < 60);
    out.pages[name] = lines;
  }
  // Admin-Zugang prüfen
  await goto('/admin');
  await page.waitForTimeout(1800);
  out.adminPage = (await page.innerText('body'))
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  writeFileSync(`.check/rollen/${who}.json`, JSON.stringify(out, null, 1));
  console.log(who, 'ok');
}
console.log(b.errors.length ? b.errors.slice(0, 5).join('\n') : 'keine Konsolenfehler');
await b.close();
