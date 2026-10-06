import { Ionicons } from '@expo/vector-icons';
import type { HomeResponse } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { clubInitials } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { mediaUri } from '@/lib/upload';
import { Avatar, Crest, T } from './ui';

/** Kopfzeile aller Tabs: Wappen, Begrüßung, Glocke, Avatar (Mappe S. 3). */
export function AppHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { me, api } = useSignedIn();
  const { colors, spacing } = useTheme();
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomeResponse>('/home') });
  const unread = home.data?.unreadNotifications ?? 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth * 2,
        borderBottomColor: colors.border,
      }}
    >
      {me.club.logoUrl ? (
        <Image
          source={{ uri: mediaUri(me.club.logoUrl)! }}
          accessibilityLabel="Vereinslogo"
          style={{ width: 38, height: 42 }}
          resizeMode="contain"
        />
      ) : (
        <Crest initials={clubInitials(me.club.shortName)} size={38} />
      )}
      <View style={{ flex: 1 }}>
        <T variant="headline" numberOfLines={1}>
          {title ?? `Hallo, ${me.person.firstName}`}
        </T>
        <T variant="label" color={colors.primaryText} numberOfLines={1}>
          {subtitle ?? me.club.shortName}
        </T>
      </View>
      {me.canAdminister ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Verwaltung öffnen"
          onPress={() => router.push('/admin')}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Ionicons name="shield-checkmark-outline" size={23} color={colors.onSurface} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unread ? `Benachrichtigungen, ${unread} ungelesen` : 'Benachrichtigungen'
        }
        onPress={() => router.push('/notifications')}
        hitSlop={8}
        style={{ padding: 4 }}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.onSurface} />
        {unread > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 17,
              height: 17,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: colors.status.urgent.solid,
              borderWidth: 2,
              borderColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T
              variant="caption"
              color={colors.status.urgent.onSolid}
              style={{ fontSize: 9, fontWeight: '800' }}
            >
              {unread}
            </T>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mein Profil"
        onPress={() => router.push(`/profile/${me.person.id}`)}
      >
        <Avatar name={`${me.person.firstName} ${me.person.lastName}`} uri={me.person.avatarUrl} />
      </Pressable>
    </View>
  );
}
