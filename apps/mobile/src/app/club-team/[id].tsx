import type { ClubTeamPage } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { HighlightsCard, ResultRow } from '@/components/team';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { formatLongDate, formatTime } from '@/lib/format';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';

/** Mannschaftsseite für alle im Verein: Trainerteam, Kader, nächstes Spiel, Ergebnisse. */
export default function ClubTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const page = useQuery({
    queryKey: ['club-team', id],
    queryFn: () => api<ClubTeamPage>(`/club/teams/${id}`),
  });
  const p = page.data;
  return (
    <Screen edges={[]} refreshing={page.isRefetching} onRefresh={() => page.refetch()}>
      <Stack.Screen options={{ title: p?.team.name ?? 'Mannschaft' }} />
      {page.isPending ? <Loading /> : null}
      {page.error ? <ErrorNotice error={page.error} onRetry={() => page.refetch()} /> : null}
      {p ? (
        <>
          <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TeamBadge badge={p.team.badge} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading">{p.team.name}</T>
              <T variant="caption">
                {[p.team.orgUnitName, p.team.ageGroup, p.team.league].filter(Boolean).join(' · ')}
              </T>
            </View>
            {p.isMine ? <Chip label="Meine" /> : null}
          </Card>
          {p.isMine ? (
            <Button
              label="Zum Team-Bereich"
              variant="tonal"
              icon="people"
              onPress={() => router.push(`/team?teamId=${p.team.id}`)}
            />
          ) : null}

          {p.nextMatch ? (
            <Section title="Nächstes Spiel">
              <Card style={{ gap: 4 }}>
                <T variant="label" style={{ fontWeight: '700' }}>
                  {p.nextMatch.title}
                </T>
                <T variant="caption">
                  {formatLongDate(p.nextMatch.startsAt)}, {formatTime(p.nextMatch.startsAt)} Uhr
                  {p.nextMatch.isHome === null
                    ? ''
                    : p.nextMatch.isHome
                      ? ' · Heimspiel'
                      : ' · Auswärtsspiel'}
                  {p.nextMatch.location ? ` · ${p.nextMatch.location}` : ''}
                </T>
              </Card>
            </Section>
          ) : null}

          {p.highlights.played > 0 ? (
            <HighlightsCard h={p.highlights} title="Saison-Bilanz" rateLabel={null} />
          ) : null}

          <Section title="Trainerteam">
            <Card>
              {p.coaches.length === 0 ? (
                <Empty icon="person-outline" text="Noch kein Trainerteam eingetragen." />
              ) : null}
              {p.coaches.map((c, i) => (
                <ListRow
                  key={c.personId + c.function}
                  first={i === 0}
                  leading={<Avatar name={c.name} uri={c.avatarUrl} />}
                  title={c.name}
                  subtitle={TEAM_FUNCTION_LABELS[c.function]}
                />
              ))}
            </Card>
          </Section>

          <Section title={`Kader (${p.playerCount} Spieler)`}>
            <Card>
              {p.players === null ? (
                <T variant="caption">
                  Die Namen der Jugendspieler sieht nur die Mannschaft selbst.
                </T>
              ) : p.players.length === 0 ? (
                <Empty icon="people-outline" text="Noch keine Spieler im Kader." />
              ) : (
                p.players.map((pl, i) => (
                  <ListRow
                    key={pl.personId}
                    first={i === 0}
                    leading={
                      <T
                        variant="label"
                        style={{ width: 28, textAlign: 'center', fontWeight: '800' }}
                      >
                        {pl.jerseyNumber ?? '–'}
                      </T>
                    }
                    title={pl.name}
                    subtitle={pl.position ?? undefined}
                  />
                ))
              )}
            </Card>
          </Section>

          {p.lastResults.length ? (
            <Section title="Letzte Ergebnisse">
              <Card>
                {p.lastResults.map((r, i) => (
                  <ResultRow
                    key={r.eventId}
                    result={r}
                    clubShortName={me.club.shortName}
                    badge={p.team.badge}
                    first={i === 0}
                    linked={p.isMine}
                  />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
