import type { SponsorPage } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SponsorLogo } from '@/components/sponsor-ads';
import { Card, Empty, ErrorNotice, Loading, Screen, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/**
 * „Unsere Sponsoren“ (SP2): alle laufenden Sponsoren in zwei Spalten mit Logo, Name und Slogan, auch die ohne
 * Werbung. Antippen öffnet die Detailseite. Ohne Auswertung.
 */
export default function SponsorsScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
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
          ) : (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                rowGap: 14,
              }}
            >
              {p.sponsors.map((x) => (
                <Pressable
                  key={x.id}
                  accessibilityRole="button"
                  accessibilityLabel={x.name}
                  onPress={() => router.push(`/sponsor/${x.id}`)}
                  style={{
                    width: '47.9%',
                    minHeight: 150,
                    padding: 16,
                    gap: 12,
                    borderRadius: 24,
                    backgroundColor: colors.anstoss.card,
                    borderWidth: 1,
                    borderColor: colors.anstoss.cardBorder,
                  }}
                >
                  <SponsorLogo sponsor={x} size={56} inner={36} />
                  <View style={{ gap: 2 }}>
                    <T variant="headline" numberOfLines={2} verbatim style={{ fontSize: 20 }}>
                      {x.name}
                    </T>
                    {x.slogan ? (
                      <T variant="caption" numberOfLines={2} verbatim>
                        {x.slogan}
                      </T>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}
