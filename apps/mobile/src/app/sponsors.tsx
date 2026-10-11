import {
  SPONSOR_TIERS,
  SPONSOR_TIER_LABEL,
  SPONSOR_TIER_PLURAL,
  type SponsorPage,
} from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { Image, View } from 'react-native';
import { openSponsor } from '@/components/sponsor-banner';
import {
  Card,
  Chip,
  Crest,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { clubInitials } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { mediaUri } from '@/lib/upload';
import { t } from '@/lib/i18n';

/** „Unsere Sponsoren“: laufende Sponsoren nach Stufe – ohne Auswertung, nicht für Minderjährige. */
export default function SponsorsScreen() {
  const { api } = useSignedIn();
  const page = useQuery({ queryKey: ['sponsors'], queryFn: () => api<SponsorPage>('/sponsors') });
  const p = page.data;
  return (
    <Screen edges={[]} refreshing={page.isRefetching} onRefresh={() => page.refetch()}>
      {page.isPending ? <Loading /> : null}
      {page.error ? <ErrorNotice error={page.error} onRetry={() => page.refetch()} /> : null}
      {p ? (
        <>
          <T variant="caption">
            Diese Unternehmen unterstützen unseren Verein. Danke! Wir werten nicht aus, wer sich
            welche Seite ansieht.
          </T>
          {p.sponsors.length === 0 ? (
            <Card>
              <Empty icon="heart-outline" text="Hier gibt es gerade nichts anzuzeigen." />
            </Card>
          ) : null}
          {SPONSOR_TIERS.map((tier) => {
            const list = p.sponsors.filter((x) => x.tier === tier);
            if (list.length === 0) return null;
            return (
              <Section key={tier} title={SPONSOR_TIER_PLURAL[tier]}>
                <Card>
                  {list.map((x, i) => {
                    const logo = mediaUri(x.logoUrl);
                    return (
                      <ListRow
                        key={x.id}
                        first={i === 0}
                        leading={
                          logo ? (
                            <Image
                              source={{ uri: logo }}
                              accessibilityIgnoresInvertColors
                              resizeMode="contain"
                              style={{ width: 48, height: 48, borderRadius: 10 }}
                            />
                          ) : (
                            <View style={{ width: 48, alignItems: 'center' }}>
                              <Crest initials={clubInitials(x.name)} size={40} />
                            </View>
                          )
                        }
                        title={x.name}
                        subtitle={t(SPONSOR_TIER_LABEL[x.tier])}
                        trailing={
                          x.linkUrl ? (
                            <Chip tone="neutral" icon="open-outline" label="Webseite" />
                          ) : null
                        }
                        onPress={x.linkUrl ? () => openSponsor(x) : undefined}
                      />
                    );
                  })}
                </Card>
              </Section>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}
