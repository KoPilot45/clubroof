import { Ionicons } from '@expo/vector-icons';
import type { HomeResponse } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import { clubInitials, formatLongDate } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { mediaUri } from '@/lib/upload';
import { Crest, shadowStyle, T, type IconName } from './ui';
import { Text } from './app-text';
import { t } from '@/lib/i18n';

/** Runder Knopf der Kopfzeile (46 pt): hell mit Schatten, dunkel mit Rahmen. */
export function HeaderButton({
  icon,
  label,
  onPress,
  count,
}: {
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
        backgroundColor: colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
        ...(isDark
          ? { borderWidth: 1, borderColor: colors.border }
          : shadowStyle(elevation.control)),
      }}
    >
      <Ionicons name={icon} size={22} color={colors.onSurface} />
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
            borderColor: colors.background,
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
 * Der Suchknopf erscheint nur, wenn `onSearch` übergeben wird – die globale Suche folgt später.
 */
export function AppHeader({
  title,
  subtitle,
  onSearch,
}: {
  title?: string;
  /** kleine Zeile über dem Titel; ohne Angabe das heutige Datum */
  subtitle?: string;
  onSearch?: () => void;
}) {
  const { me, api } = useSignedIn();
  const { colors, spacing, sizes, isDark, elevation } = useTheme();
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomeResponse>('/home') });
  const unread = home.data?.unreadNotifications ?? 0;
  const greeting = title ?? `Hallo, ${me.person.firstName}`;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: spacing.lg + 4,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          width: sizes.logo,
          height: sizes.logo,
          borderRadius: sizes.logo / 2,
          overflow: 'hidden',
          backgroundColor: colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
          ...(isDark
            ? { borderWidth: 1, borderColor: colors.border }
            : shadowStyle(elevation.control)),
        }}
      >
        {me.club.logoUrl ? (
          <Image
            source={{ uri: mediaUri(me.club.logoUrl)! }}
            accessibilityLabel={t('Vereinslogo')}
            style={{ width: 32, height: 32 }}
            resizeMode="contain"
          />
        ) : (
          <Crest initials={clubInitials(me.club.shortName)} size={30} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="caption" numberOfLines={1}>
          {subtitle ?? formatLongDate(new Date().toISOString())}
        </T>
        <T
          variant="headline"
          numberOfLines={2}
          accessibilityRole="header"
          style={{ lineHeight: 26 }}
        >
          {greeting}
        </T>
      </View>
      {onSearch ? <HeaderButton icon="search-outline" label="Suche" onPress={onSearch} /> : null}
      {me.canAdminister ? (
        <HeaderButton
          icon="shield-checkmark-outline"
          label="Verwaltung öffnen"
          onPress={() => router.push('/admin')}
        />
      ) : null}
      <HeaderButton
        icon="notifications-outline"
        label={unread ? `Benachrichtigungen, ${unread} ungelesen` : 'Benachrichtigungen'}
        count={unread}
        onPress={() => router.push('/notifications')}
      />
    </View>
  );
}
