import type { TeamStats } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { HighlightsCard, ResultRow } from '@/components/team';
import { Card, Empty, ErrorNotice, Loading, Screen, Section, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

function RateBar({ value }: { value: number | null }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.surfaceVariant,
        overflow: 'hidden',
      }}
    >
      <View
        style={{ width: `${value ?? 0}%`, height: '100%', backgroundColor: colors.primaryText }}
      />
    </View>
  );
}

export default function StatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const team = me.teams.find((t) => t.id === id);
  const stats = useQuery({
    queryKey: ['stats', id],
    queryFn: () => api<TeamStats>(`/teams/${id}/stats`),
  });
  const d = stats.data;
  const onlyMine = d
    ? d.players.every((p) => me.managedPersons.some((m) => m.id === p.personId))
    : false;

  return (
    <Screen edges={[]} refreshing={stats.isRefetching} onRefresh={() => stats.refetch()}>
      {stats.isPending ? <Loading /> : null}
      {stats.error ? (
        <ErrorNotice message={stats.error.message} onRetry={() => stats.refetch()} />
      ) : null}
      {d ? (
        <>
          <HighlightsCard h={d.highlights} />
          <Section title={onlyMine ? 'Meine Beteiligung' : 'Trainingsbeteiligung'}>
            <Card style={{ gap: 12 }}>
              {d.players.length === 0 ? (
                <Empty icon="bar-chart-outline" text="Noch keine Daten." />
              ) : null}
              {d.players.map((p) => (
                <View key={p.personId} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T variant="label">{p.name}</T>
                    <T variant="label">{p.trainingRate === null ? '–' : `${p.trainingRate} %`}</T>
                  </View>
                  <RateBar value={p.trainingRate} />
                  <T variant="caption">
                    {p.trainingsAttended} von {p.trainings} Trainings · {p.matchesAttended} Spiele
                  </T>
                </View>
              ))}
              {onlyMine ? (
                <T variant="caption">Die Werte anderer Spieler sieht nur das Trainerteam.</T>
              ) : null}
            </Card>
          </Section>
          <Section title="Ergebnisse der Saison">
            <Card>
              {d.results.length === 0 ? (
                <Empty icon="football-outline" text="Noch keine Ergebnisse." />
              ) : null}
              {d.results.map((r, i) => (
                <ResultRow
                  key={r.eventId}
                  result={r}
                  clubShortName={me.club.shortName}
                  badge={team?.badge ?? ''}
                  first={i === 0}
                />
              ))}
            </Card>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
