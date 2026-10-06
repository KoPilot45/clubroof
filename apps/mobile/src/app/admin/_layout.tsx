import { Ionicons } from '@expo/vector-icons';
import { router, Stack, usePathname, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HEADING_FONT, type IconName } from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/**
 * Verwaltungsmodus als „App in der App“ (Mappe S. 8, Konzept §6): abgesetzte Kopfzeile mit
 * „Beenden“ und eine eigene untere Navigation für die wichtigsten Verwaltungsbereiche.
 */
export default function AdminLayout() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.primaryContainer },
          headerTintColor: colors.onPrimaryContainer,
          headerTitleStyle: {
            color: colors.onPrimaryContainer,
            fontFamily: HEADING_FONT,
            fontWeight: '400',
            fontSize: 20,
          },
          headerShadowVisible: false,
          headerBackTitle: 'Zurück',
          contentStyle: { backgroundColor: colors.background },
          headerRight: () => <ExitButton />,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Verwaltung' }} />
        <Stack.Screen name="members" options={{ title: 'Mitglieder' }} />
        <Stack.Screen name="member/[id]" options={{ title: 'Mitglied' }} />
        <Stack.Screen name="member-new" options={{ title: 'Mitglied anlegen' }} />
        <Stack.Screen name="club-events" options={{ title: 'Veranstaltungen' }} />
        <Stack.Screen name="club-event-new" options={{ title: 'Veranstaltung planen' }} />
        <Stack.Screen name="import" options={{ title: 'Mitglieder importieren' }} />
        <Stack.Screen name="roles" options={{ title: 'Rollen & Aufgaben' }} />
        <Stack.Screen name="audit" options={{ title: 'Änderungsprotokoll' }} />
        <Stack.Screen name="news/index" options={{ title: 'News-Redaktion' }} />
        <Stack.Screen name="news/new" options={{ title: 'News schreiben' }} />
        <Stack.Screen name="news/[id]" options={{ title: 'News' }} />
        <Stack.Screen name="club" options={{ title: 'Verein & Design' }} />
        <Stack.Screen name="modules" options={{ title: 'Module' }} />
        <Stack.Screen name="teams" options={{ title: 'Mannschaften & Saison' }} />
        <Stack.Screen name="team-new" options={{ title: 'Mannschaft anlegen' }} />
        <Stack.Screen name="unit/[id]" options={{ title: 'Module im Bereich' }} />
        <Stack.Screen name="team/[id]" options={{ title: 'Mannschaft' }} />
        <Stack.Screen name="transfers" options={{ title: 'Spielerbewegungen' }} />
        <Stack.Screen name="transfer-new" options={{ title: 'Bewegung erfassen' }} />
        <Stack.Screen name="invites" options={{ title: 'Einladungen' }} />
      </Stack>
      <AdminNavBar />
    </View>
  );
}

function ExitButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Verwaltungsmodus beenden"
      onPress={() => router.dismissTo('/mehr')}
      hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}
    >
      <Ionicons name="close-circle-outline" size={20} color={colors.onPrimaryContainer} />
      <Text style={{ color: colors.onPrimaryContainer, fontWeight: '700' }}>Beenden</Text>
    </Pressable>
  );
}

type NavItem = { href: Href; match: string; label: string; icon: IconName };

function AdminNavBar() {
  const { me } = useSignedIn();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  if (!me.canAdminister) return null;
  const a = me.admin;
  const items: NavItem[] = [
    { href: '/admin', match: '/admin', label: 'Übersicht', icon: 'grid' },
    ...(a.readMembers
      ? [
          {
            href: '/admin/members' as Href,
            match: '/admin/member',
            label: 'Mitglieder',
            icon: 'people' as IconName,
          },
        ]
      : []),
    ...(a.manageTeams || a.planSeason
      ? [
          {
            href: '/admin/teams' as Href,
            match: '/admin/team',
            label: 'Teams',
            icon: 'shirt' as IconName,
          },
        ]
      : []),
    ...(a.planEvents
      ? [
          {
            href: '/admin/club-events' as Href,
            match: '/admin/club-event',
            label: 'Feste',
            icon: 'balloon' as IconName,
          },
        ]
      : []),
    ...(me.news.write || me.news.publish
      ? [
          {
            href: '/admin/news' as Href,
            match: '/admin/news',
            label: 'News',
            icon: 'newspaper' as IconName,
          },
        ]
      : []),
  ];
  const active = (item: NavItem) =>
    item.match === '/admin' ? path === '/admin' : path.startsWith(item.match);
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        paddingBottom: Math.max(insets.bottom, 6),
        paddingTop: 6,
      }}
    >
      {items.map((item) => {
        const on = active(item);
        return (
          <Pressable
            key={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => router.navigate(item.href)}
            style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 }}
          >
            <Ionicons
              name={on ? item.icon : (`${item.icon}-outline` as IconName)}
              size={22}
              color={on ? colors.primaryText : colors.onSurfaceMuted}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: on ? '800' : '600',
                color: on ? colors.primaryText : colors.onSurfaceMuted,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
