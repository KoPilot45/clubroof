import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crest, T } from '@/components/ui';
import { clubInitials } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { mediaUri } from '@/lib/upload';

/** Rahmen für Seiten ohne Anmeldung (Einladung, Passwort vergessen). */
export function PublicShell({
  title,
  subtitle,
  club,
  children,
}: {
  title: string;
  subtitle?: string;
  club?: { shortName: string; logoUrl: string | null } | null;
  children: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: 'center' }}
        >
          <View style={{ width: '100%', maxWidth: 460, alignSelf: 'center', gap: spacing.lg }}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              {club?.logoUrl ? (
                <Image
                  source={{ uri: mediaUri(club.logoUrl)! }}
                  style={{ width: 64, height: 70 }}
                  resizeMode="contain"
                />
              ) : (
                <Crest initials={club ? clubInitials(club.shortName) : 'CR'} size={56} />
              )}
              <T variant="title" style={{ textAlign: 'center' }}>
                {title}
              </T>
              {subtitle ? (
                <T variant="caption" style={{ textAlign: 'center' }}>
                  {subtitle}
                </T>
              ) : null}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
