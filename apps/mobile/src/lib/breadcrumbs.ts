/**
 * Pfad („Breadcrumb“) für Unterseiten (Paket NV): Bereich (Tab) › Zwischenstufen › aktuelle Seite.
 * Der Bereich und die Zwischenstufen kommen aus dieser Tabelle, die letzte Stufe ist der Titel der Seite.
 * Wer eine neue Seite anlegt, trägt sie hier ein; ohne Eintrag gilt Home › Titel.
 */
import type { Href } from 'expo-router';

export type TabKey = 'index' | 'team' | 'termine' | 'verein' | 'mehr';
export type Crumb = { label: string; href?: Href };
type Params = Record<string, string | string[] | undefined>;

export const TAB_LABELS: Record<TabKey, string> = {
  index: 'Home',
  team: 'Team',
  termine: 'Termine',
  verein: 'Verein',
  mehr: 'Mehr',
};
export const TAB_HREFS: Record<TabKey, Href> = {
  index: '/',
  team: '/team',
  termine: '/termine',
  verein: '/verein',
  mehr: '/mehr',
};

type Rule = { section: TabKey; parents?: (p: Params) => Crumb[] };
const id = (p: Params) => String(Array.isArray(p.id) ? p.id[0] : p.id);

const section = (s: TabKey, parents?: Rule['parents']): Rule => ({ section: s, parents });
const under = (s: TabKey, label: string, href: Href): Rule => section(s, () => [{ label, href }]);

const teamCash = (p: Params): Crumb[] => [{ label: 'Kasse', href: `/teams/${id(p)}/cash` }];
const teamCashAdmin = (p: Params): Crumb[] => [
  ...teamCash(p),
  { label: 'Kassenverwaltung', href: `/teams/${id(p)}/cash-admin` },
];
const admin = (...more: Crumb[]) =>
  section('verein', () => [{ label: 'Verwaltung', href: '/admin' }, ...more]);

const RULES: Record<string, Rule> = {
  // Home
  notifications: section('index'),
  search: section('index'),
  // Termine
  'events/index': section('termine'),
  'events/[id]': section('termine'),
  'event-edit/[id]': section('termine'),
  'match/[id]/lineup': section('termine'),
  'match/[id]/report': section('termine'),
  calendar: section('termine'),
  // Team
  'teams/[id]/roster': section('team'),
  'teams/[id]/stats/index': section('team'),
  'teams/[id]/stats/[kind]': section('team', (p) => [
    { label: 'Statistik', href: `/teams/${id(p)}/stats` },
  ]),
  'teams/[id]/cash': section('team'),
  'teams/[id]/cash-new': section('team', teamCash),
  'teams/[id]/cash-pay': section('team', teamCash),
  'teams/[id]/cash-drinks': section('team', teamCash),
  'teams/[id]/cash-levy': section('team', teamCash),
  'teams/[id]/cash-fees': section('team', teamCash),
  'teams/[id]/cash-entries': section('team', teamCash),
  'teams/[id]/cash-stats': section('team', teamCash),
  'teams/[id]/fines': section('team', teamCash),
  'teams/[id]/cash-admin': section('team', teamCash),
  'teams/[id]/cash-payments': section('team', teamCashAdmin),
  'teams/[id]/cash-treasurers': section('team', teamCashAdmin),
  'teams/[id]/cash-settings': section('team', teamCashAdmin),
  'teams/[id]/cash-closings': section('team', teamCashAdmin),
  'teams/[id]/event-new': section('team'),
  'teams/[id]/tasks': section('team'),
  'teams/[id]/manage': section('team'),
  'teams/[id]/modules': section('team'),
  'teams/[id]/jerseys': section('team'),
  'training-plan/[id]': section('team'),
  exercises: section('team'),
  // Verein
  'news/index': section('verein'),
  'news/[id]': under('verein', 'Vereinsnews', '/news'),
  'polls/index': section('verein'),
  'polls/[id]': under('verein', 'Umfragen', '/polls'),
  'polls/new': under('verein', 'Umfragen', '/polls'),
  documents: section('verein'),
  'documents-upload': under('verein', 'Dokumente', '/documents'),
  helpers: section('verein'),
  'club-teams': section('verein'),
  'club-team/[id]': under('verein', 'Mannschaften', '/club-teams'),
  'club-events': section('verein'),
  'club-calendar': section('verein'),
  'club-schedule': section('verein'),
  sponsors: section('verein'),
  contacts: section('verein'),
  'forum/index': section('verein'),
  'forum/[id]': under('verein', 'Forum', '/forum'),
  'wiki/index': section('verein'),
  'wiki/[id]': under('verein', 'Vereinswissen', '/wiki'),
  board: section('verein'),
  'exchange/index': section('verein'),
  'exchange/[id]': under('verein', 'Gastspieler', '/exchange'),
  'exchange/new-demand': under('verein', 'Gastspieler', '/exchange'),
  'exchange/new-offer': under('verein', 'Gastspieler', '/exchange'),
  'equipment/index': section('verein'),
  'equipment/rooms': under('verein', 'Anlage & Material', '/equipment'),
  'equipment/items': under('verein', 'Anlage & Material', '/equipment'),
  'equipment/damages': under('verein', 'Anlage & Material', '/equipment'),
  'facilities/index': section('verein'),
  'facilities/block-new': under('verein', 'Platzbelegung', '/facilities'),
  'schedule-import': section('verein'),
  'club-cash/index': section('verein'),
  'club-cash/entries': under('verein', 'Vereinskasse', '/club-cash'),
  'club-cash/new': under('verein', 'Vereinskasse', '/club-cash'),
  'club-cash/fees': under('verein', 'Vereinskasse', '/club-cash'),
  'club-cash/fee-import': under('verein', 'Vereinskasse', '/club-cash'),
  'club-cash/fee-setup': under('verein', 'Vereinskasse', '/club-cash'),
  'club-cash/manage': under('verein', 'Vereinskasse', '/club-cash'),
  // Mehr
  account: section('mehr'),
  help: section('mehr'),
  'about/privacy': section('mehr'),
  'about/[page]': section('mehr'),
  'notification-settings': section('mehr'),
  'absences/index': section('mehr'),
  'absences/new': under('mehr', 'Abwesenheiten', '/absences'),
  referees: section('mehr'),
  'profile/[id]': section('mehr'),
  // Verwaltung: Verein › Verwaltung › …
  'admin/index': section('verein'),
  'admin/members': admin(),
  'admin/member/[id]': admin({ label: 'Mitglieder', href: '/admin/members' }),
  'admin/member-new': admin({ label: 'Mitglieder', href: '/admin/members' }),
  'admin/member-permissions': admin({ label: 'Mitglieder', href: '/admin/members' }),
  'admin/import': admin({ label: 'Mitglieder', href: '/admin/members' }),
  'admin/club-events': admin(),
  'admin/club-event-new': admin({ label: 'Veranstaltungen', href: '/admin/club-events' }),
  'admin/roles': admin(),
  'admin/role/[key]': admin({ label: 'Rollen & Aufgaben', href: '/admin/roles' }),
  'admin/audit': admin(),
  'admin/news/index': admin(),
  'admin/news/new': admin({ label: 'News-Redaktion', href: '/admin/news' }),
  'admin/news/[id]': admin({ label: 'News-Redaktion', href: '/admin/news' }),
  'admin/club': admin(),
  'admin/modules': admin(),
  'admin/teams': admin(),
  'admin/unit/[id]': admin({ label: 'Mannschaften & Saison', href: '/admin/teams' }),
  'admin/team/[id]': admin({ label: 'Mannschaften & Saison', href: '/admin/teams' }),
  'admin/transfers': admin(),
  'admin/transfer-new': admin({ label: 'Spielerbewegungen', href: '/admin/transfers' }),
  'admin/invites': admin(),
  'admin/sponsors': admin(),
};

/** Bereich und Pfad einer Seite. `title` ist die letzte Stufe (aktuelle Seite). */
export function breadcrumbsFor(
  routeName: string,
  params: Params,
  title: string,
): { section: TabKey; crumbs: Crumb[] } {
  const rule = RULES[routeName] ?? { section: 'index' as TabKey };
  const first: Crumb = { label: TAB_LABELS[rule.section], href: TAB_HREFS[rule.section] };
  // Die Verwaltungsübersicht ist selbst „Verwaltung“; die Stufe „Verein“ führt zurück zum Tab
  return {
    section: rule.section,
    crumbs: [first, ...(rule.parents?.(params) ?? []), { label: title }],
  };
}

/** Ab vier Stufen: erste und letzte beiden, dazwischen eine Sammelstufe „…“ (Liste der ausgelassenen). */
export function collapseCrumbs(crumbs: Crumb[]): { shown: Crumb[]; hidden: Crumb[] } {
  if (crumbs.length < 4) return { shown: crumbs, hidden: [] };
  return {
    shown: [crumbs[0]!, ...crumbs.slice(-2)],
    hidden: crumbs.slice(1, -2),
  };
}

/** Bereich (Tab) einer Seite anhand ihres Routennamens, z. B. „teams/[id]/fines“ → team. */
export const sectionOf = (routeName: string): TabKey =>
  // Segmente lassen „index“ weg: „events“ meint „events/index“
  (RULES[routeName] ?? RULES[`${routeName}/index`])?.section ?? 'index';
