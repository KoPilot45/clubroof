import { Stack, router, usePathname } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useState } from 'react';
import { View } from 'react-native';
import { NoAccessRedirect } from '@/components/area-guard';
import { AreaHeader, AreaTabBar, AreaTabsContext } from '@/components/area-shell';
import { adminCategories, canOpenAdminPath } from '@/lib/areas';
import { t, useLocale } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Welche Kategorie zu einer Seite der Verwaltung gehört (für den markierten Reiter). */
const CATEGORY_OF: Record<string, string> = {
  members: 'mitglieder',
  member: 'mitglieder',
  'member-new': 'mitglieder',
  'member-permissions': 'mitglieder',
  import: 'mitglieder',
  roles: 'mitglieder',
  role: 'mitglieder',
  'role-edit': 'mitglieder',
  'member-effective': 'mitglieder',
  transfers: 'mitglieder',
  'transfer-new': 'mitglieder',
  invites: 'mitglieder',
  teams: 'sport',
  team: 'sport',
  unit: 'sport',
  'club-events': 'sport',
  'club-event-new': 'sport',
  news: 'inhalte',
  sponsors: 'inhalte',
  club: 'verein',
  departments: 'verein',
  funds: 'verein',
  modules: 'verein',
  audit: 'verein',
  archive: 'verein',
};

/**
 * Verwaltung als eigener Bereich (Paket AV): violettes Kopfband mit „Beenden“, untere Leiste mit beschrifteten
 * Reitern (Übersicht, Mitglieder, Sport, Inhalte, Verein – je nach Rechten) und Seiten mit farbigen Untergruppen.
 */
export default function AdminLayout() {
  const { colors } = useTheme();
  const { me } = useSignedIn();
  const [navHeight, setNavHeight] = useState(0);
  // Der Assistent „Mannschaft anlegen“ füllt den Bildschirm: ohne Kopfband und Leiste
  const path = usePathname();
  const wizard = path === '/admin/team-new';
  useLocale();
  const categories = adminCategories(me);
  const segment = path.split('/')[2] ?? '';
  const activeKey =
    path === '/admin'
      ? 'overview'
      : segment === 'area'
        ? (path.split('/')[3] ?? '')
        : (CATEGORY_OF[segment] ?? '');
  // Ohne Verwaltungsrecht: zurück zu Mehr statt einer leeren Seite mit Fehlermeldung
  if (!canOpenAdminPath(me, path)) return <NoAccessRedirect area="admin" />;
  const items = [
    {
      key: 'overview',
      label: t('Übersicht'),
      icon: (activeKey === 'overview' ? 'grid' : 'grid-outline') as never,
      active: activeKey === 'overview',
      onPress: () => router.navigate('/admin'),
    },
    ...categories.map((c) => ({
      key: c.key,
      label: t(c.label),
      icon: (activeKey === c.key ? c.icon : `${c.icon}-outline`) as never,
      active: activeKey === c.key,
      onPress: () => router.navigate(`/admin/area/${c.key}` as never),
    })),
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AreaTabsContext.Provider value={items}>
        <BottomTabBarHeightContext.Provider value={wizard ? 0 : navHeight}>
          <Stack
            screenOptions={{
              headerShown: true,
              header: (p) => (
                <AreaHeader
                  tone="violet"
                  areaTitle="Admin-Verwaltung"
                  rootCrumb={{ label: 'Verwaltung', href: '/admin' }}
                  roots={['index', 'area/[key]']}
                  route={p.route}
                  options={p.options}
                  prefix="admin/"
                />
              ),
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Verwaltung' }} />
            <Stack.Screen name="area/[key]" options={{ title: 'Verwaltung' }} />
            <Stack.Screen name="members" options={{ title: 'Mitglieder' }} />
            <Stack.Screen name="member/[id]" options={{ title: 'Mitglied' }} />
            <Stack.Screen name="member-new" options={{ title: 'Mitglied anlegen' }} />
            <Stack.Screen name="member-permissions" options={{ title: 'Individuelle Rechte' }} />
            <Stack.Screen name="club-events" options={{ title: 'Veranstaltungen' }} />
            <Stack.Screen name="club-event-new" options={{ title: 'Veranstaltung planen' }} />
            <Stack.Screen name="import" options={{ title: 'Mitglieder importieren' }} />
            <Stack.Screen name="roles" options={{ title: 'Rollen & Aufgaben' }} />
            <Stack.Screen name="role/[key]" options={{ title: 'Rolle' }} />
            <Stack.Screen name="role-edit" options={{ title: 'Rolle bearbeiten' }} />
            <Stack.Screen name="member-effective" options={{ title: 'Was darf diese Person?' }} />
            <Stack.Screen name="audit" options={{ title: 'Änderungsprotokoll' }} />
            <Stack.Screen name="archive" options={{ title: 'Archiv' }} />
            <Stack.Screen name="news/index" options={{ title: 'News-Redaktion' }} />
            <Stack.Screen name="news/new" options={{ title: 'News schreiben' }} />
            <Stack.Screen name="news/[id]" options={{ title: 'News' }} />
            <Stack.Screen name="club" options={{ title: 'Verein & Design' }} />
            <Stack.Screen name="modules" options={{ title: 'Module' }} />
            <Stack.Screen name="teams" options={{ title: 'Mannschaften & Saison' }} />
            <Stack.Screen
              name="team-new"
              options={{ title: 'Mannschaft anlegen', headerShown: false }}
            />
            <Stack.Screen name="unit/[id]" options={{ title: 'Module in der Abteilung' }} />
            <Stack.Screen name="team/[id]" options={{ title: 'Mannschaft' }} />
            <Stack.Screen name="transfers" options={{ title: 'Spielerbewegungen' }} />
            <Stack.Screen name="transfer-new" options={{ title: 'Bewegung erfassen' }} />
            <Stack.Screen name="invites" options={{ title: 'Einladungen' }} />
            <Stack.Screen name="sponsors" options={{ title: 'Sponsoren' }} />
            <Stack.Screen name="departments" options={{ title: 'Abteilungen' }} />
            <Stack.Screen name="funds" options={{ title: 'Kassen' }} />
          </Stack>
        </BottomTabBarHeightContext.Provider>
      </AreaTabsContext.Provider>
      {wizard ? null : <AreaTabBar tone="violet" items={items} onHeight={setNavHeight} />}
    </View>
  );
}
