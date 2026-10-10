/**
 * Paket U: Tippflächen. Öffnet viele Seiten und meldet antippbare Elemente (Schaltflächen, Tabs, Kontrollkästchen,
 * Auswahl, Links), die sichtbar kleiner als 44 pt sind. Erweiterte Tippbereiche (hitSlop) sind im Browser nicht
 * messbar – Elemente mit bewusst vergrößertem Bereich sind ausgenommen (siehe AUSNAHMEN und Chip-Regel).
 * Aufruf: pnpm browser-check scripts/e2e/touchflaechen.mjs
 */
import { api, launch } from '../lib/e2e.mjs';

const MIN = 44;
// Bewusst kleine Elemente mit größerem Tippbereich (hitSlop) oder Teil einer größeren Zeile
const AUSNAHMEN = [/›$/];

const b = await launch();
const offenders = new Map();

async function sweep(who, pages) {
  const { page, login, goto } = await b.session(who);
  const b1 = login.me.teams.find((t) => t.badge === 'B1') ?? login.me.teams[0];
  const overview = b1 ? await api(`/teams/${b1.id}`, login.token) : null;
  const event = overview?.nextEvent ?? overview?.trainingWeek?.[0];
  for (const [name, path] of pages({ login, b1, event })) {
    if (!path) continue;
    await goto(path);
    await page.waitForTimeout(1500);
    const found = await page.evaluate((min) => {
      const sel =
        '[role=button],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=link],a[href]';
      return [...document.querySelectorAll(sel)]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < min || r.height < min))
        .filter(({ el }) => {
          const s = getComputedStyle(el);
          return (
            s.visibility !== 'hidden' && s.display !== 'none' && el.getClientRects().length > 0
          );
        })
        .map(({ el, r }) => ({
          name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
          role: el.getAttribute('role'),
          w: Math.round(r.width),
          h: Math.round(r.height),
        }));
    }, MIN);
    for (const f of found) {
      if (!f.name || AUSNAHMEN.some((re) => re.test(f.name))) continue;
      // Auswahl-Chips: 34 pt hoch, Tippbereich 6 pt darüber und darunter (hitSlop) = 46 pt
      if (f.role === 'radio' && f.h >= 34 && f.w >= 40) continue;
      const key = `${f.name} (${f.w}×${f.h})`;
      offenders.set(key, [...(offenders.get(key) ?? []), `${who}:${name}`]);
    }
  }
}

await sweep('trainer', ({ b1, event, login }) => [
  ['Home', '/'],
  ['Team', `/team?teamId=${b1?.id}`],
  ['Termine', '/termine'],
  ['Verein', '/verein'],
  ['Mehr', '/mehr'],
  ['Termin', event ? `/events/${event.id}` : null],
  ['Kader', b1 ? `/teams/${b1.id}/roster` : null],
  ['Kasse', b1 ? `/teams/${b1.id}/cash` : null],
  ['Aufgaben', b1 ? `/teams/${b1.id}/tasks` : null],
  ['Profil', `/profile/${login.me.person.id}`],
  ['Benachrichtigungen', '/notifications'],
  ['Abwesenheiten', '/absences'],
  ['News', '/news'],
  ['Umfragen', '/polls'],
  ['Dokumente', '/documents'],
  ['Kalender', '/club-calendar'],
  ['Hilfe', '/help'],
  ['Konto', '/account'],
]);
await sweep('eltern', () => [
  ['Home', '/'],
  ['Termine', '/termine'],
  ['Mehr', '/mehr'],
]);
await sweep('admin', () => [
  ['Verwaltung', '/admin'],
  ['Mitglieder', '/admin/members'],
]);

if (offenders.size === 0) console.log(`✓ alle antippbaren Elemente sind mindestens ${MIN} pt groß`);
else {
  console.log(`✗ ${offenders.size} Elemente unter ${MIN} pt:`);
  for (const [k, where] of offenders)
    console.log(`  - ${k}  [${[...new Set(where)].slice(0, 4).join(', ')}]`);
}
await b.close();
process.exit(offenders.size ? 1 : 0);
