import type { MeResponse } from '@clubroof/core';
import type { TintKey } from '@clubroof/design-tokens';
import type { IconName } from '@/components/ui';

export type QuickLink = {
  /** Schlüssel, wie er in `me.user.quickLinks` gespeichert wird */
  key: string;
  label: string;
  icon: IconName;
  route: string;
  tint: TintKey;
  /** Ob der Eintrag für diese Person überhaupt angeboten wird (Rechte prüft weiterhin der Server) */
  available: (me: MeResponse) => boolean;
};

const has = (me: MeResponse, module: string) => me.clubModules.includes(module);
const always = () => true;

/** Alle Ziele, die sich als Schnellzugriff wählen lassen. */
export const QUICK_LINKS: QuickLink[] = [
  {
    key: 'admin',
    label: 'Verwaltung',
    icon: 'shield-checkmark-outline',
    route: '/admin',
    tint: 'violet',
    available: (me) => me.canAdminister || Object.values(me.admin).some(Boolean),
  },
  {
    key: 'invites',
    label: 'Einladen',
    icon: 'person-add-outline',
    route: '/admin/invites',
    tint: 'green',
    available: (me) => me.canInvite,
  },
  {
    key: 'absences',
    label: 'Abwesenheiten',
    icon: 'airplane-outline',
    route: '/absences',
    tint: 'orange',
    available: always,
  },
  {
    key: 'news',
    label: 'Vereinsnews',
    icon: 'newspaper-outline',
    route: '/news',
    tint: 'blue',
    available: always,
  },
  {
    key: 'events',
    label: 'Veranstaltungen',
    icon: 'calendar-outline',
    route: '/club-events',
    tint: 'pink',
    available: always,
  },
  {
    key: 'calendar',
    label: 'Vereinskalender',
    icon: 'calendar-number-outline',
    route: '/club-calendar',
    tint: 'blue',
    available: always,
  },
  {
    key: 'polls',
    label: 'Umfragen',
    icon: 'stats-chart-outline',
    route: '/polls',
    tint: 'violet',
    available: (me) => has(me, 'polls'),
  },
  {
    key: 'forum',
    label: 'Forum',
    icon: 'chatbubbles-outline',
    route: '/forum',
    tint: 'green',
    available: (me) => has(me, 'forum'),
  },
  {
    key: 'documents',
    label: 'Dokumente',
    icon: 'document-text-outline',
    route: '/documents',
    tint: 'orange',
    available: (me) => has(me, 'documents'),
  },
  {
    key: 'wiki',
    label: 'Vereinswissen',
    icon: 'book-outline',
    route: '/wiki',
    tint: 'pink',
    available: (me) => has(me, 'wiki'),
  },
  {
    key: 'helpers',
    label: 'Helfer gesucht',
    icon: 'hand-left-outline',
    route: '/helpers',
    tint: 'green',
    available: (me) => has(me, 'helpers'),
  },
  {
    key: 'board',
    label: 'Schwarzes Brett',
    icon: 'pricetags-outline',
    route: '/board',
    tint: 'orange',
    available: (me) => has(me, 'lost_and_found') || has(me, 'marketplace'),
  },
  {
    key: 'teams',
    label: 'Mannschaften',
    icon: 'people-outline',
    route: '/club-teams',
    tint: 'blue',
    available: always,
  },
  {
    key: 'contacts',
    label: 'Ansprechpartner',
    icon: 'call-outline',
    route: '/contacts',
    tint: 'violet',
    available: always,
  },
  {
    key: 'help',
    label: 'Hilfe',
    icon: 'help-circle-outline',
    route: '/help',
    tint: 'pink',
    available: always,
  },
];

/** Voreinstellung je Rolle, solange die Person nichts gewählt hat. */
export function defaultQuickLinks(me: MeResponse): string[] {
  const keys = ['admin', 'invites', 'absences', 'news', 'events', 'contacts'];
  return keys.filter((k) => QUICK_LINKS.find((l) => l.key === k)!.available(me)).slice(0, 5);
}

/** Aktuelle Auswahl: gespeicherte Reihenfolge (nur noch verfügbare Einträge) oder die Voreinstellung. */
export function quickLinksFor(me: MeResponse): QuickLink[] {
  const keys = me.user.quickLinks ?? defaultQuickLinks(me);
  return keys
    .map((k) => QUICK_LINKS.find((l) => l.key === k))
    .filter((l): l is QuickLink => !!l && l.available(me));
}
