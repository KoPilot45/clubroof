import { Ionicons } from '@expo/vector-icons';
import type { HomeResponse } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Animated, Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion, useScrollY } from '@/lib/motion';
import { formatLongDate } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { mediaUri } from '@/lib/upload';
import { Crest, shadowStyle, T, type IconName } from './ui';
import { Text } from './app-text';
import { t } from '@/lib/i18n';

/** Schriftfarben auf dem grünen Plakat der Startseite: in beiden Modi weiß (Untergrund bestimmt die Farbe). */
const ON_POSTER = '#FFFFFF';
const ON_POSTER_SOFT = 'rgba(255,255,255,0.82)';

/** Runder Knopf der Kopfzeile (46 pt): hell mit Schatten, dunkel mit Rahmen. */
export function HeaderButton({
  icon,
  label,
  onPress,
  count,
  glass,
}: {
  glass?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
  /** roter Zähler oben rechts (z. B. ungelesene Benachrichtigungen) */
  count?: number;
}) {
  const { colors, sizes, isDark, elevation } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={onPress}
      style={{
        width: sizes.headerButton,
        height: sizes.headerButton,
        borderRadius: sizes.headerButton / 2,
        backgroundColor: glass ? 'rgba(0,0,0,0.28)' : colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
        ...(glass
          ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }
          : isDark
            ? { borderWidth: 1, borderColor: colors.border }
            : shadowStyle(elevation.control)),
      }}
    >
      <Ionicons name={icon} size={22} color={glass ? '#FFFFFF' : colors.onSurface} />
      {count && count > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 5,
            borderRadius: 10,
            backgroundColor: colors.status.urgent.solid,
            borderWidth: 2,
            borderColor: glass ? 'rgba(0,0,0,0.35)' : colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: colors.status.urgent.onSolid,
              lineHeight: 12,
            }}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Kopfzeile aller Tabs: Vereinslogo (Kreis), darüber/darunter Untertitel und Titel bzw. Begrüßung
 * (lange Namen brechen auf höchstens zwei Zeilen um), optional Suche, Glocke mit Zähler.
 * Die Lupe öffnet die globale Suche (`/search`), sofern `onSearch` nichts anderes vorgibt.
 */
export function AppHeader({
  title,
  subtitle,
  onSearch,
  overlay,
}: {
  /** liegt auf dem Plakat (Home): durchsichtig, Titel 26 ohne Schrumpfen */
  overlay?: boolean;
  title?: string;
  /** kleine Zeile über dem Titel; ohne Angabe das heutige Datum */
  subtitle?: string;
  onSearch?: () => void;
}) {
  const { me, api } = useSignedIn();
  const insets = useSafeAreaInsets();
  const { colors, spacing, sizes } = useTheme();
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomeResponse>('/home') });
  const unread = home.data?.unreadNotifications ?? 0;
  const greeting = title ?? `Hallo, ${me.person.firstName}`;
  // Titel schrumpft beim Scrollen über 60 px von 32 auf 22
  const scrollY = useScrollY();
  const reduce = useReduceMotion();
  const shrink =
    scrollY && !reduce && !overlay
      ? scrollY.interpolate({
          inputRange: [0, 60],
          outputRange: [1, 22 / 32],
          extrapolate: 'clamp',
        })
      : 1;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: spacing.lg + 4,
        paddingTop: overlay ? insets.top + 22 : spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: overlay ? 'transparent' : colors.background,
      }}
    >
      {/* Wappen ohne Kreis, etwas größer als zuvor (Paket AP) */}
      <View
        style={{
          width: sizes.logo + 4,
          height: sizes.logo + 4,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {me.club.logoUrl ? (
          <Image
            source={{ uri: mediaUri(me.club.logoUrl)! }}
            accessibilityLabel={t('Vereinslogo')}
            style={{ width: sizes.logo + 4, height: sizes.logo + 4 }}
            resizeMode="contain"
          />
        ) : (
          <Crest initials={me.club.shortCode} size={sizes.logo} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="caption" numberOfLines={1} color={overlay ? ON_POSTER_SOFT : undefined}>
          {subtitle ?? formatLongDate(new Date().toISOString())}
        </T>
        <Animated.View
          style={{
            transformOrigin: 'left center',
            transform: [{ scale: shrink }],
          }}
        >
          <T
            variant="headline"
            numberOfLines={2}
            accessibilityRole="header"
            color={overlay ? ON_POSTER : undefined}
            style={overlay ? { fontSize: 26, lineHeight: 28 } : { fontSize: 32, lineHeight: 36 }}
          >
            {greeting}
          </T>
        </Animated.View>
      </View>
      <HeaderButton
        glass={overlay}
        icon="search-outline"
        label="Suche"
        onPress={onSearch ?? (() => router.push('/search'))}
      />
      <HeaderButton
        glass={overlay}
        icon="notifications-outline"
        label={unread ? `Benachrichtigungen, ${unread} ungelesen` : 'Benachrichtigungen'}
        count={unread}
        onPress={() => router.push('/notifications')}
      />
    </View>
  );
}
