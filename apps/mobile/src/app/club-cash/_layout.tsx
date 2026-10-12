import { Stack, router, usePathname } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useState } from 'react';
import { View } from 'react-native';
import { AreaHeader, AreaTabBar } from '@/components/area-shell';
import { cashCategories } from '@/lib/areas';
import { t, useLocale } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Zu welchem Reiter eine Seite der Vereinskasse gehört. */
const TAB_OF: Record<string, string> = {
  entries: 'buchung',
  new: 'buchung',
  manage: 'buchung',
  funds: 'buchung',
  fees: 'beitraege',
  'fee-import': 'beitraege',
  'fee-setup': 'beitraege',
};

/**
 * Vereinskasse als eigener Bereich (Paket AV, im selben Prinzip wie die Verwaltung, Kopfband in Blau):
 * Übersicht und Reiter Buchung, Beiträge, Planung, Prüfung mit farbigen Untergruppen.
 */
export default function ClubCashLayout() {
  const { colors } = useTheme();
  const { me } = useSignedIn();
  const [navHeight, setNavHeight] = useState(0);
  const path = usePathname();
  useLocale();
  const segment = path.split('/')[2] ?? '';
  const activeKey =
    segment === ''
      ? 'overview'
      : segment === 'area'
        ? (path.split('/')[3] ?? '')
        : (TAB_OF[segment] ?? '');
  const items = [
    {
      key: 'overview',
      label: t('Übersicht'),
      icon: (activeKey === 'overview' ? 'grid' : 'grid-outline') as never,
      active: activeKey === 'overview',
      onPress: () => router.navigate('/club-cash'),
    },
    ...cashCategories(me).map((c) => ({
      key: c.key,
      label: t(c.label),
      icon: (activeKey === c.key ? c.icon : `${c.icon}-outline`) as never,
      active: activeKey === c.key,
      onPress: () => router.navigate(`/club-cash/area/${c.key}` as never),
    })),
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BottomTabBarHeightContext.Provider value={navHeight}>
        <Stack
          screenOptions={{
            headerShown: true,
            header: (p) => (
              <AreaHeader
                tone="blue"
                areaTitle="Vereinskasse"
                rootCrumb={{ label: 'Vereinskasse', href: '/club-cash' }}
                roots={['index', 'area/[key]']}
                route={p.route}
                options={p.options}
                prefix="club-cash/"
              />
            ),
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Vereinskasse' }} />
          <Stack.Screen name="area/[key]" options={{ title: 'Vereinskasse' }} />
          <Stack.Screen name="entries" options={{ title: 'Kassenbuch' }} />
          <Stack.Screen name="new" options={{ title: 'Buchung erfassen' }} />
          <Stack.Screen name="fees" options={{ title: 'Mitgliedsbeiträge' }} />
          <Stack.Screen name="fee-import" options={{ title: 'Kontoauszug importieren' }} />
          <Stack.Screen name="fee-setup" options={{ title: 'Beitragsarten und Mitglieder' }} />
          <Stack.Screen name="manage" options={{ title: 'Vereinskasse einrichten' }} />
          <Stack.Screen name="funds" options={{ title: 'Kassen' }} />
        </Stack>
      </BottomTabBarHeightContext.Provider>
      <AreaTabBar tone="blue" items={items} onHeight={setNavHeight} />
    </View>
  );
}
