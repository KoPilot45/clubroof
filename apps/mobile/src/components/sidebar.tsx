/**
 * Feste Seitenleiste der Desktop-Ansicht (Paket DT, ab 1100 px): Wappen, Vereinsname, Nutzer und Rolle, die fünf
 * Hauptbereiche (aktiver Punkt in der Akzentfläche), Suche (Kürzel `/`), Mitteilungen mit Zähler, „Verwaltung“
 * (violett) und „Vereinskasse“ (blau) nur mit Recht, unten die Profilkarte. Immer ausgeklappt, nicht einklappbar.
 */
import { Ionicons } from '@/components/icon';
import type { HomeResponse } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { sectionOf, TAB_HREFS, TAB_LABELS, type TabKey } from '@/lib/breadcrumbs';
import { canOpenAdmin, canOpenClubCash } from '@/lib/areas';
import { t } from '@/lib/i18n';
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_COMPACT, useIsCompactDesktop } from '@/lib/layout';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { webState } from '@/lib/web-state';
import { mediaUri } from '@/lib/upload';
import { Text } from './app-text';
import { AREA_ACCENT, type AreaTone } from './area-shell';
import { Honeycomb } from './honeycomb';
import { TAB_ICONS } from './tab-bar';
import { Crest, T, type IconName } from './ui';

const TABS: TabKey[] = ['index', 'termine', 'team', 'verein', 'mehr'];

type Entry = {
  key: string;
  label: string;
  icon: IconName;
  iconActive?: IconName;
  active: boolean;
  onPress: () => void;
  count?: number;
  shortcut?: string;
  tone?: AreaTone;
};

function NavEntry({ item }: { item: Entry }) {
  const { colors, isDark } = useTheme();
  const compact = useIsCompactDesktop();
  const accent = item.tone ? AREA_ACCENT[item.tone][isDark ? 'dark' : 'light'] : null;
  const fill = accent ? accent[0] : colors.primary;
  const on = accent ? accent[1] : colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.count ? `${item.label}, ${item.count}` : item.label}
      aria-current={item.active ? 'page' : undefined}
      onPress={item.onPress}
      style={(state) => {
        const { hovered, focused } = webState(state);
        return {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 11,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: item.active ? fill : hovered ? colors.anstoss.overlay : 'transparent',
          borderWidth: 2,
          borderColor: focused ? colors.primaryText : 'transparent',
        };
      }}
    >
      <Ionicons
        name={item.active && item.iconActive ? item.iconActive : item.icon}
        size={20}
        color={item.active ? on : (accent?.[0] ?? colors.anstoss.textTertiary)}
      />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: compact ? 13 : 14,
          fontWeight: item.active ? '700' : '600',
          color: item.active ? on : colors.onSurface,
        }}
      >
        {item.label}
      </Text>
      {item.count ? (
        <View
          style={{
            minWidth: 20,
            height: 20,
            paddingHorizontal: 6,
            borderRadius: 10,
            backgroundColor: colors.status.urgent.solid,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.status.urgent.onSolid }}>
            {item.count > 99 ? '99+' : item.count}
          </Text>
        </View>
      ) : null}
      {item.shortcut ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: item.active ? on : colors.border,
            borderRadius: 5,
            paddingHorizontal: 6,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: item.active ? on : colors.anstoss.textTertiary,
            }}
          >
            {item.shortcut}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Separator() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.anstoss.divider,
        marginVertical: 8,
        marginHorizontal: 6,
      }}
    />
  );
}

export function Sidebar() {
  const { colors, isDark } = useTheme();
  const compact = useIsCompactDesktop();
  const { me, api } = useSignedIn();
  const segments = useSegments();
  const pathname = usePathname();
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomeResponse>('/home') });
  const unread = home.data?.unreadNotifications ?? 0;

  // Kürzel `/` öffnet die Suche (nicht beim Tippen in einem Feld)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        router.push('/search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const inAdmin = pathname.startsWith('/admin');
  const inCash = pathname.startsWith('/club-cash');
  const inSearch = pathname === '/search';
  const inNotifications = pathname === '/notifications';
  const section: TabKey | null =
    inAdmin || inCash || inSearch || inNotifications
      ? null
      : segments[0] === '(tabs)'
        ? (((segments as string[])[1] ?? 'index') as TabKey)
        : sectionOf(segments.join('/'));

  const tabs: Entry[] = TABS.map((key) => {
    const [icon, iconActive] = TAB_ICONS[key]!;
    return {
      key,
      label: t(TAB_LABELS[key]),
      icon,
      iconActive,
      active: section === key,
      onPress: () => router.navigate(TAB_HREFS[key]),
    };
  });
  const tools: Entry[] = [
    {
      key: 'notifications',
      label: t('Mitteilungen'),
      icon: 'notifications-outline',
      iconActive: 'notifications',
      active: inNotifications,
      count: unread,
      onPress: () => router.push('/notifications'),
    },
  ];
  const areas: Entry[] = [
    ...(canOpenAdmin(me)
      ? [
          {
            key: 'admin',
            label: t('Verwaltung'),
            icon: 'shield-checkmark-outline' as const,
            iconActive: 'shield-checkmark' as const,
            active: inAdmin,
            tone: 'violet' as const,
            onPress: () => router.push('/admin'),
          },
        ]
      : []),
    ...(canOpenClubCash(me)
      ? [
          {
            key: 'cash',
            label: t('Vereinskasse'),
            icon: 'cash-outline' as const,
            iconActive: 'cash' as const,
            active: inCash,
            tone: 'blue' as const,
            onPress: () => router.push('/club-cash'),
          },
        ]
      : []),
  ];
  const initials = `${me.person.firstName[0] ?? ''}${me.person.lastName[0] ?? ''}`.toUpperCase();
  const roles = [...new Set(me.roles.map((r) => r.name))].slice(0, 2).join(', ');

  return (
    <View
      role="navigation"
      accessibilityLabel={t('Hauptnavigation')}
      style={{
        width: compact ? SIDEBAR_WIDTH_COMPACT : SIDEBAR_WIDTH,
        paddingVertical: 18,
        paddingHorizontal: compact ? 10 : 14,
        gap: 6,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.border,
      }}
    >
      {isDark ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 150 }}
        >
          <Honeycomb />
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 6,
          paddingBottom: 14,
        }}
      >
        {me.club.logoUrl ? (
          <Image
            source={{ uri: mediaUri(me.club.logoUrl)! }}
            accessibilityLabel={t('Vereinslogo')}
            style={{ width: 44, height: 44 }}
            resizeMode="contain"
          />
        ) : (
          <Crest initials={me.club.shortCode} size={44} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Name bricht auf zwei Zeilen um, die Schrift passt sich der Länge an (nie „…“) */}
          <T
            variant="headline"
            numberOfLines={3}
            style={
              me.club.name.length <= 24
                ? { fontSize: 18, lineHeight: 19 }
                : me.club.name.length <= 36
                  ? { fontSize: 15, lineHeight: 16 }
                  : { fontSize: 13, lineHeight: 14 }
            }
            verbatim
          >
            {me.club.name}
          </T>
        </View>
      </View>
      <View style={{ gap: 3 }}>
        {tabs.map((i) => (
          <NavEntry key={i.key} item={i} />
        ))}
      </View>
      <Separator />
      <View style={{ gap: 3 }}>
        {tools.map((i) => (
          <NavEntry key={i.key} item={i} />
        ))}
      </View>
      {areas.length ? (
        <>
          <Separator />
          <View style={{ gap: 3 }}>
            {areas.map((i) => (
              <NavEntry key={i.key} item={i} />
            ))}
          </View>
        </>
      ) : null}
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('Profil')}
        onPress={() => router.push('/account')}
        style={(state) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 10,
          borderRadius: 14,
          backgroundColor: webState(state).hovered ? colors.anstoss.overlay : colors.anstoss.card,
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.onPrimary }} verbatim>
            {initials}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, fontWeight: '700', color: colors.onSurface }}
            verbatim
          >
            {`${me.person.firstName} ${me.person.lastName}`}
          </Text>
          {roles ? (
            <Text numberOfLines={1} style={{ fontSize: 12, color: colors.onSurfaceMuted }} verbatim>
              {roles}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
