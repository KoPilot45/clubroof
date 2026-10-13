import type { SponsorPage } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Button, Empty, ErrorNotice, HeroCard, Loading, Screen, Section, T } from '@/components/ui';
import { openSponsor, SponsorLogo } from '@/components/sponsor-ads';
import { View } from 'react-native';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Detailseite eines Sponsors (SP2): Logo, Name, Slogan, Text und „Zur Webseite“ (extern, nur https). */
export default function SponsorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const page = useQuery({ queryKey: ['sponsors'], queryFn: () => api<SponsorPage>('/sponsors') });
  if (page.isPending) return <Loading />;
  if (page.error) return <ErrorNotice error={page.error} onRetry={() => page.refetch()} />;
  const sponsor = page.data?.sponsors.find((x) => x.id === id);
  if (!sponsor)
    return (
      <Screen edges={[]}>
        <Empty icon="heart-outline" text="Diesen Sponsor gibt es nicht mehr." />
      </Screen>
    );
  const on = colors.hero.onHero;
  return (
    <Screen edges={[]}>
      <HeroCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <SponsorLogo sponsor={sponsor} size={84} inner={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T variant="headline" color={on} verbatim style={{ fontSize: 34, lineHeight: 36 }}>
              {sponsor.name}
            </T>
            {sponsor.slogan ? (
              <T color={on} verbatim style={{ marginTop: 4 }}>
                {sponsor.slogan}
              </T>
            ) : null}
          </View>
        </View>
      </HeroCard>
      {sponsor.description ? (
        <Section title="Über den Sponsor">
          <T verbatim style={{ lineHeight: 24 }}>
            {sponsor.description}
          </T>
        </Section>
      ) : null}
      {sponsor.linkUrl ? (
        <Button label="Zur Webseite" icon="link" onPress={() => openSponsor(sponsor)} />
      ) : null}
    </Screen>
  );
}
