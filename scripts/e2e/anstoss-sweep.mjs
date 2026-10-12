/**
 * Design „Anstoß“: alle wichtigen Seiten aufnehmen (Abnahme-Durchgang). Bilder: .check/shots/sweep-*.png
 * pnpm browser-check scripts/e2e/anstoss-sweep.mjs --no-build   (ONLY=a,b für eine Auswahl)
 */
import { api, launch } from '../lib/e2e.mjs';

const b = await launch();
const S = {};
for (const who of ['admin', 'trainer', 'eltern', 'kasse', 'vorstand'])
  S[who] = await b.session(who, { width: 390, height: 1100 });
const coach = S.trainer.login;
const b1 = coach.me.teams.find((t) => t.badge === 'B1');
const ev = await api('/events', coach.token);
const match = ev.find((e) => e.type === 'match' && e.team?.id === b1.id);
const polls = await api('/polls', coach.token);
const news = await api('/news', coach.token);
const wiki = await api('/wiki', coach.token).catch(() => []);
const members = await api('/admin/members?status=active', S.admin.login.token);
const teams = await api('/admin/teams', S.admin.login.token).catch(() => []);
const t = b1.id;

const pages = [
  ['events', 'trainer', '/events'],
  ['archive', 'trainer', '/events/archive'],
  ['absences', 'eltern', '/absences'],
  ['absences-new', 'eltern', '/absences/new'],
  ['account', 'eltern', '/account'],
  ['notifications', 'eltern', '/notifications'],
  ['notif-settings', 'eltern', '/notification-settings'],
  ['help', 'eltern', '/help'],
  ['search', 'eltern', '/search'],
  ['contacts', 'trainer', '/contacts'],
  ['forum', 'eltern', '/forum'],
  ['wiki', 'eltern', '/wiki'],
  ['board', 'eltern', '/board'],
  ['polls', 'eltern', '/polls'],
  ['polls-new', 'trainer', '/polls/new'],
  ...(polls[0] ? [['poll', 'eltern', `/polls/${polls[0].id}`]] : []),
  ['news', 'eltern', '/news'],
  ['club-events', 'eltern', '/club-events'],
  ['club-schedule', 'eltern', '/club-schedule'],
  ['club-teams', 'eltern', '/club-teams'],
  ['helpers', 'eltern', '/helpers'],
  ['facilities', 'eltern', '/facilities'],
  ['equipment', 'trainer', '/equipment'],
  ['equipment-items', 'trainer', '/equipment/items'],
  ['exercises', 'trainer', '/exercises'],
  ['exchange', 'trainer', '/exchange'],
  ['referees', 'trainer', '/referees'],
  ['sponsors', 'eltern', '/sponsors'],
  ['calendar', 'eltern', '/calendar'],
  ['expense-claims', 'eltern', '/expense-claims'],
  ['team-modules', 'trainer', `/teams/${t}/modules`],
  ['team-manage', 'trainer', `/teams/${t}/manage`],
  ['team-fines', 'trainer', `/teams/${t}/fines`],
  ['team-jerseys', 'trainer', `/teams/${t}/jerseys`],
  ['cash-admin', 'trainer', `/teams/${t}/cash-admin`],
  ['cash-entries', 'trainer', `/teams/${t}/cash-entries`],
  ['cash-new', 'trainer', `/teams/${t}/cash-new`],
  ['cash-fees', 'trainer', `/teams/${t}/cash-fees`],
  ['cash-drinks', 'trainer', `/teams/${t}/cash-drinks`],
  ['cash-stats', 'trainer', `/teams/${t}/cash-stats`],
  ['stats', 'trainer', `/teams/${t}/stats`],
  ...(match
    ? [
        ['lineup', 'trainer', `/match/${match.id}/lineup`],
        ['report', 'trainer', `/match/${match.id}/report`],
      ]
    : []),
  ['admin-teams', 'admin', '/admin/teams'],
  ['admin-roles', 'admin', '/admin/roles'],
  ['admin-modules', 'admin', '/admin/modules'],
  ['admin-audit', 'admin', '/admin/audit'],
  ['admin-invites', 'admin', '/admin/invites'],
  ['admin-departments', 'admin', '/admin/departments'],
  ['admin-news', 'admin', '/admin/news'],
  ['admin-sponsors', 'admin', '/admin/sponsors'],
  ['admin-import', 'admin', '/admin/import'],
  ['admin-funds', 'admin', '/admin/funds'],
  ['admin-transfers', 'admin', '/admin/transfers'],
  ['admin-club-events', 'admin', '/admin/club-events'],
  ...(members[0] ? [['admin-member', 'admin', `/admin/member/${members[0].id}`]] : []),
  ...(teams[0] ? [['admin-team', 'admin', `/admin/team/${teams[0].id}`]] : []),
  ['cc-entries', 'kasse', '/club-cash/entries'],
  ['cc-new', 'kasse', '/club-cash/new'],
  ['cc-fees', 'kasse', '/club-cash/fees'],
  ['cc-budget', 'kasse', '/club-cash/budget'],
  ['cc-closing', 'kasse', '/club-cash/closing'],
  ['cc-donations', 'kasse', '/club-cash/donations'],
  ['cc-audit', 'kasse', '/club-cash/audit'],
  ['cc-manage', 'kasse', '/club-cash/manage'],
  ['cc-funds', 'kasse', '/club-cash/funds'],
  ['cc-reserves', 'kasse', '/club-cash/reserves'],
  ['cc-overview', 'vorstand', '/club-cash-overview'],
];
void news;
void wiki;
const only = process.env.ONLY?.split(',');
for (const [name, who, path] of pages) {
  if (only && !only.includes(name)) continue;
  try {
    await S[who].goto(path);
    await S[who].page.waitForTimeout(1200);
    await b.shot(S[who].page, `sweep-${name}`, false);
  } catch (e) {
    console.log('✗', name, e.message.slice(0, 80));
  }
}
console.log(
  b.errors.length
    ? `✗ Konsolenfehler:\n${[...new Set(b.errors)].slice(0, 8).join('\n')}`
    : '✓ keine Konsolenfehler',
);
await b.close();
