import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientHeader } from '@/components/brand-header';
import { Crest, T } from '@/components/ui';
import { useIsDesktop } from '@/lib/layout';
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
  club?: { shortName: string; shortCode?: string; logoUrl: string | null } | null;
  children: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const desktop = useIsDesktop();
  const logo = club?.logoUrl ? (
    <Image
      source={{ uri: mediaUri(club.logoUrl)! }}
      style={{ width: 64, height: 70 }}
      resizeMode="contain"
    />
  ) : (
    <Crest initials={club ? (club.shortCode ?? clubInitials(club.shortName)) : 'CR'} size={56} />
  );
  // Desktop (Paket DT2): links Verlauf mit Wappen und Titel, rechts das Formular
  if (desktop)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <GradientHeader
            containerStyle={{ flex: 1 }}
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.xl,
            }}
          >
            {logo}
            <T
              variant="headline"
              color={colors.hero.onHero}
              accessibilityRole="header"
              style={{ fontSize: 40, lineHeight: 44, textAlign: 'center' }}
            >
              {title}
            </T>
            {subtitle ? (
              <T color={colors.hero.onHero} style={{ textAlign: 'center', maxWidth: 420 }}>
                {subtitle}
              </T>
            ) : null}
          </GradientHeader>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 96, flexGrow: 1, justifyContent: 'center' }}
          >
            <View style={{ width: '100%', maxWidth: 460, alignSelf: 'center', gap: spacing.lg }}>
              {children}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
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
              {logo}
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
