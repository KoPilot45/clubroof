/**
 * Sponsoren-Banner (Paket SPO): immer gekennzeichnet, ohne Auswertung (nichts wird gezählt) und
 * nur an erlaubten Plätzen – Startseite, Spieltag, Terminlisten. Nie in Anmeldung, Kasse oder Chat.
 */
import type { SponsorBanner as Banner, SponsorItem, SponsorPlacement } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { Image, Linking, Pressable, View } from 'react-native';
import { Text } from '@/components/app-text';
import { Card, Chip, Crest, T } from '@/components/ui';
import { clubInitials } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { mediaUri } from '@/lib/upload';
import { t } from '@/lib/i18n';

/** Öffnet den Link des Sponsors im Browser (nur https). */
export function openSponsor(s: Pick<SponsorItem, 'linkUrl'>) {
  if (s.linkUrl?.startsWith('https://')) void Linking.openURL(s.linkUrl);
}

export function SponsorBannerCard({ placement }: { placement: SponsorPlacement }) {
  const { api, me } = useSignedIn();
  const { colors } = useTheme();
  const enabled = me.clubModules.includes('sponsors');
  const banner = useQuery({
    queryKey: ['sponsor-banner', placement],
    queryFn: () => api<Banner>(`/sponsors/banner?placement=${placement}`),
    enabled,
    staleTime: 10 * 60_000,
  });
  const sponsor = banner.data?.sponsor;
  if (!enabled || !sponsor) return null;
  const image = mediaUri(sponsor.bannerUrl);
  const logo = mediaUri(sponsor.logoUrl);
  return (
    <Card style={{ gap: 8, padding: 12 }}>
      <Pressable
        accessibilityRole={sponsor.linkUrl ? 'link' : 'text'}
        accessibilityLabel={`${banner.data!.label}: ${sponsor.name}`}
        disabled={!sponsor.linkUrl}
        onPress={() => openSponsor(sponsor)}
        style={{ gap: 8 }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Chip tone="neutral" label={banner.data!.label} />
          {sponsor.linkUrl ? (
            <T variant="caption" color={colors.onSurfaceMuted}>
              {t('Mehr erfahren')}
            </T>
          ) : null}
        </View>
        {image ? (
          <Image
            source={{ uri: image }}
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            style={{
              width: '100%',
              aspectRatio: 4,
              borderRadius: 12,
              backgroundColor: colors.surfaceVariant,
            }}
          />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {logo ? (
              <Image
                source={{ uri: logo }}
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                style={{ width: 56, height: 56, borderRadius: 12 }}
              />
            ) : (
              <Crest initials={clubInitials(sponsor.name)} size={48} />
            )}
            <Text style={{ flex: 1, color: colors.onSurface, fontSize: 16, fontWeight: '700' }}>
              {sponsor.name}
            </Text>
          </View>
        )}
      </Pressable>
    </Card>
  );
}
