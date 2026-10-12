/**
 * Untere Navigation auf Unterseiten (Paket NV): dieselbe schwebende Leiste wie in den Tabs, der Bereich
 * der Seite bleibt markiert; ein Tipp führt zurück in den Tab.
 */
import { router } from 'expo-router';
import { FloatingNav, TAB_ICONS, type NavItem } from '@/components/tab-bar';
import { sectionOf, TAB_HREFS, TAB_LABELS, type TabKey } from '@/lib/breadcrumbs';
import { t } from '@/lib/i18n';

const TABS: TabKey[] = ['index', 'team', 'termine', 'verein', 'mehr'];

/** Bereiche mit eigener Navigation oder ohne Leiste (Anmeldung, Einrichtung, Einladung, Verwaltung). */
export const NO_SUB_NAV = new Set([
  '(tabs)',
  'admin',
  'club-cash',
  'login',
  'forgot',
  'setup',
  'demo',
  'join',
  'join-code',
  'reset',
]);

export function SubNav({
  routeName,
  onHeight,
}: {
  routeName: string;
  onHeight: (height: number) => void;
}) {
  const active = sectionOf(routeName);
  const items: NavItem[] = TABS.map((key) => {
    const [icon, iconActive] = TAB_ICONS[key]!;
    return {
      key,
      label: t(TAB_LABELS[key]),
      icon,
      iconActive,
      active: key === active,
      onPress: () => router.dismissTo(TAB_HREFS[key]),
    };
  });
  return <FloatingNav items={items} onHeight={onHeight} />;
}
