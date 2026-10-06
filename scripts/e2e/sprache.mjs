/**
 * Browserprüfung Mehrsprachigkeit: Konto auf Englisch stellen, Bildschirme durchgehen und
 * Zeilen melden, die noch deutsch aussehen (Umlaute oder typische deutsche Wörter).
 * Aufruf: pnpm browser-check scripts/e2e/sprache.mjs --no-build
 * Mit LANG_ROUTES="/a,/b" nur bestimmte Seiten.
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const GERMAN =
  /[äöüßÄÖÜ]|\b(der|die|das|und|nicht|für|mit|keine|keinen|noch|alle|ist|sind|bitte|zu|von|im|auf|dein|deine|deiner|wird|werden|oder|wenn|neu|neue|noch|heute|morgen|gestern|offen|Mannschaft|Termin|Termine|Verein|Mitglied|Kasse|Strafe|Spieler|Trainer|Zusage|Absage|speichern|löschen|abbrechen|hinzufügen)\b/i;

async function crawl(who, routes, label) {
  const s = await b.session(who);
  await api('/me/preferences', s.login.token, {
    method: 'PUT',
    body: JSON.stringify({ language: 'en' }),
  });
  const findings = new Map();
  for (const route of routes) {
    await s.goto(route);
    await s.page.waitForTimeout(2200);
    const lines = (await s.page.evaluate(() => document.body.innerText))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 1 && GERMAN.test(l));
    for (const l of lines) {
      if (!findings.has(l)) findings.set(l, route);
    }
  }
  console.log(`\n— ${label}: ${findings.size} Zeilen sehen noch deutsch aus`);
  for (const [l, r] of findings) console.log(`  ${r}  |  ${l.slice(0, 140)}`);
  await api('/me/preferences', s.login.token, {
    method: 'PUT',
    body: JSON.stringify({ language: null }),
  });
  return s;
}

// ── Umschalten über das Profil ────────────────────────────────────────────────
const t = await b.session('trainer');
await t.goto('/account');
await text(t.page, 'Sprache', { exact: true }).waitFor({ timeout: 20_000 });
await text(t.page, 'English', { exact: true }).click();
await text(t.page, 'Language', { exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Umschalten auf English: Überschrift „Language“ erscheint');
ok(t.page.url().includes('/account'), 'Seite bleibt beim Umschalten erhalten');
ok(
  await text(t.page, 'Appearance', { exact: true }).isVisible(),
  'Weitere Überschriften übersetzt',
);
await text(t.page, 'Automatic', { exact: true }).click();
await text(t.page, 'Sprache', { exact: true }).waitFor({ timeout: 10_000 });
ok(true, 'Zurück auf Automatisch (Gerätesprache Deutsch)');

const login = t.login;
const me = await api('/me', login.token);
const team = me.teams?.[0]?.id;
const routes = (process.env.LANG_ROUTES ?? '').split(',').filter(Boolean);
const base = routes.length
  ? routes
  : [
      '/',
      '/team',
      '/termine',
      '/verein',
      '/mehr',
      '/account',
      '/help',
      '/notifications',
      '/club-calendar',
      '/events',
      '/absences',
      '/notification-settings',
      '/contacts',
      '/documents',
      '/calendar',
      '/exercises',
      ...(team
        ? [
            `/teams/${team}/cash`,
            `/teams/${team}/cash-admin`,
            `/teams/${team}/cash-new`,
            `/teams/${team}/cash-fees`,
            `/teams/${team}/cash-settings`,
            `/teams/${team}/cash-stats`,
            `/teams/${team}/event-new`,
            `/teams/${team}/roster`,
            `/teams/${team}/tasks`,
            `/teams/${team}/features`,
          ]
        : []),
    ];
// Detailseiten: IDs über die API ermitteln
const events = await api('/events', login.token);
const ev = events.find((e) => e.type === 'match' || e.kind === 'match') ?? events[0];
const news = await api('/news', login.token);
const polls = await api('/polls', login.token).catch(() => []);
const teamIds = me.teams.map((x) => x.id);
const deep = routes.length
  ? []
  : [
      ...(ev
        ? [
            `/events/${ev.id}`,
            `/event-edit/${ev.id}`,
            `/match/${ev.id}/lineup`,
            `/match/${ev.id}/report`,
          ]
        : []),
      ...(news[0] ? [`/news/${news[0].id}`] : []),
      ...(polls[0] ? [`/polls/${polls[0].id}`] : []),
      `/profile/${me.person.id}`,
      ...teamIds
        .slice(0, 1)
        .flatMap((id) =>
          [
            'cash-closings',
            'cash-drinks',
            'cash-entries',
            'cash-levy',
            'cash-payments',
            'cash-treasurers',
            'fines',
            'jerseys',
            'modules',
            'stats',
            'stats/goals',
          ].map((r) => `/teams/${id}/${r}`),
        ),
      '/absences/new',
      '/polls/new',
      '/documents-upload',
      '/exchange',
      '/facilities',
      '/equipment',
      '/equipment/items',
      '/equipment/damages',
      '/equipment/rooms',
      '/forgot',
    ];
await crawl('trainer', [...base, ...deep], 'Trainer');
await crawl(
  'admin',
  routes.length
    ? routes
    : [
        '/',
        '/admin',
        '/admin/roles',
        '/admin/members',
        '/admin/modules',
        '/admin/club-events',
        '/admin/audit',
        '/admin/club',
        '/admin/import',
        '/admin/invites',
        '/admin/member-new',
        '/admin/teams',
        '/admin/team-new',
        '/admin/transfers',
        '/admin/transfer-new',
        '/admin/news',
        '/admin/news/new',
        '/admin/club-event-new',
        '/club-teams',
        '/news',
        '/polls',
        '/forum',
        '/board',
        '/wiki',
        '/helpers',
        '/referees',
        '/equipment',
      ],
  'Admin',
);
await crawl(
  'spieler',
  routes.length ? routes : ['/', '/team', '/termine', '/verein', '/mehr', '/profile'],
  'Spieler',
);

await b.close();
console.log(
  b.errors.length ? `\nKonsolenfehler:\n${b.errors.join('\n')}` : '\n✓ keine Konsolenfehler',
);
if (failed) process.exit(1);
