/** Bilder je Rolle für die Vertriebs-PDF → .check/pdf/r-*.png (zugleich Textproben zur Kontrolle) */
import { launch, api } from '../lib/e2e.mjs';
const b = await launch();
const cache = {};
async function snap(who, path, name, { h = 844, act, wait = 2600 } = {}) {
  const s = (cache[who] ??= await b.session(who, { height: 844 }));
  await s.page.setViewportSize({ width: 390, height: h });
  await s.goto(path);
  await s.page.waitForTimeout(wait);
  if (act) await act(s.page, s);
  await s.page.waitForTimeout(900);
  await s.page.screenshot({ path: `.check/pdf/r-${name}.png` });
  console.log(
    name,
    '|',
    (await s.page.innerText('body')).split('\n').filter(Boolean).slice(0, 5).join(' | '),
  );
}
const tap =
  (t, o = {}) =>
  async (p) => {
    await p.getByText(t, o).filter({ visible: true }).first().click();
    await p.waitForTimeout(2200);
  };
// Ids ermitteln
const tr = (cache.trainer = await b.session('trainer'));
const T = tr.login.token;
const teamId = (badge) => tr.login.me.teams.find((t) => t.badge === badge).id;
const now = Date.now();
const all = await api('/events?scope=upcoming', T);
const ok = (e) => new Date(e.startsAt).getTime() > now && e.status === 'scheduled';
const game =
  all.find((e) => e.type === 'match' && ok(e) && e.team?.badge === 'C1') ??
  all.find((e) => e.type === 'match' && ok(e));
const train =
  all.find((e) => e.type === 'training' && ok(e) && e.team?.badge === 'B1') ??
  all.find((e) => e.type === 'training' && ok(e));
const pastAll = await api('/events?scope=past', T);
const played = [...(pastAll ?? []), ...all].find(
  (e) => e.type === 'match' && new Date(e.startsAt).getTime() < now && e.status !== 'cancelled',
);
const sp = (
  await api(
    '/events?scope=upcoming',
    cache.spieler?.login.token ?? (cache.spieler = await b.session('spieler')).login.token,
  )
).find((e) => e.type === 'match' && ok(e));
console.log('game', game?.id, 'train', train?.id, 'played', played?.id, 'sp', sp?.id);
// Spieler
await snap('spieler', '/', 'sp-home');
await snap('spieler', `/events/${sp.id}`, 'sp-spiel');
await snap('spieler', '/absences/new', 'sp-abwesenheit');
await snap('spieler', '/termine', 'sp-termine');
await snap('spieler', '/polls', 'sp-umfragen');
await snap('spieler', '/news', 'sp-news');
// Trainer
await snap('trainer', '/team', 'tr-team');
await snap('trainer', `/events/${train.id}`, 'tr-termin');
await snap('trainer', `/teams/${teamId('B1')}/roster`, 'tr-kader');
await snap('trainer', `/teams/${teamId('B1')}/event-new`, 'tr-termin-neu');
if (played) await snap('trainer', `/match/${played.id}/report`, 'tr-bericht');
if (game) await snap('trainer', `/match/${game.id}/lineup`, 'tr-aufstellung');
await snap('trainer', `/teams/${teamId('B1')}/cash`, 'tr-kasse');
await snap('trainer', '/exchange', 'tr-spielerbedarf');
// Eltern
await snap('eltern', '/', 'el-home');
await snap('eltern', '/termine', 'el-termine');
await snap('eltern', '/absences/new', 'el-abwesenheit');
await snap('eltern', '/calendar', 'el-kalender');
await snap('eltern', '/profile/' + 'x', 'el-profil-test').catch(() => {});
// Vorstand / Admin / Kasse
await snap('vorstand', '/verein', 'vo-verein');
await snap('vorstand', '/admin', 'vo-admin');
await snap('vorstand', '/admin/members', 'vo-mitglieder');
await snap('vorstand', '/admin/teams', 'vo-teams');
await snap('vorstand', '/admin/roles', 'vo-rollen');
await snap('vorstand', '/admin/news', 'vo-news');
await snap('vorstand', '/admin/club-events', 'vo-events');
await snap('vorstand', '/facilities', 'vo-platz');
await snap('kasse', '/club-cash', 'ka-kasse');
await snap('kasse', '/club-cash/fees', 'ka-beitraege');
await snap('kasse', '/club-cash/budget', 'ka-haushalt');
await snap('kasse', '/club-cash/claims', 'ka-auslagen');
await snap('kasse', '/club-cash/entries', 'ka-buchungen');
console.log(b.errors.slice(0, 3));
await b.close();
