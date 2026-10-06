import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SquadTable } from '@/components/squad-table';
import {
  PeriodFilter,
  RankingList,
  RANKINGS,
  RateBar,
  useTeamStats,
  type RankingKind,
} from '@/components/stats';
import { HighlightsCard, ResultRow } from '@/components/team';
import { Card, Empty, ErrorNotice, Loading, Screen, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

const TITLES: Record<string, string> = {
  squad: 'Kader-Statistik',
  training: 'Trainingsbeteiligung',
  scorers: 'Torschützen',
  points: 'Scorer',
  cards: 'Karten',
  results: 'Ergebnisse',
};

/** Eine Auswertung der Mannschaftsstatistik mit Zeitraumfilter. */
export default function StatsDetail() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const { me } = useSignedIn();
  const team = me.teams.find((t) => t.id === id);
  const { stats, filter } = useTeamStats(id);
  const d = stats.data;
  const onlyMine = d
    ? d.players.every((p) => me.managedPersons.some((m) => m.id === p.personId))
    : false;

  return (
    <Screen edges={[]} refreshing={stats.isRefetching} onRefresh={() => stats.refetch()}>
      <Stack.Screen options={{ title: TITLES[kind] ?? 'Statistik' }} />
      <PeriodFilter filter={filter} data={d} />
      {stats.isPending ? <Loading /> : null}
      {stats.error ? (
        <ErrorNotice message={stats.error.message} onRetry={() => stats.refetch()} />
      ) : null}
      {d ? (
        <View style={{ gap: 16, opacity: stats.isPlaceholderData ? 0.5 : 1 }}>
          {kind === 'squad' ? (
            <Card>
              {d.squad.length === 0 ? (
                <Empty icon="people-outline" text="Noch keine Spieler im Kader." />
              ) : (
                <SquadTable rows={d.squad} showRates={d.showsTrainingRates} />
              )}
              <T variant="caption" style={{ marginTop: 8 }}>
                Sp = Einsätze, S11 = Startelf. Seitlich wischen für Karten und Training, Spalte
                antippen zum Sortieren.
                {d.showsTrainingRates ? '' : ' Trainingsquoten anderer sieht nur das Trainerteam.'}
              </T>
            </Card>
          ) : null}

          {kind === 'training' ? (
            <Card style={{ gap: 12 }}>
              {d.highlights.trainingRate !== null ? (
                <T variant="label">{`Mannschaft: ${d.highlights.trainingRate} % Zusagen`}</T>
              ) : null}
              {d.players.length === 0 ? (
                <Empty icon="bar-chart-outline" text="Keine Trainings im Zeitraum." />
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
          ) : null}

          {kind in RANKINGS ? <RankingList kind={kind as RankingKind} rows={d.squad} /> : null}

          {kind === 'results' ? (
            <>
              <HighlightsCard
                h={d.highlights}
                title="Bilanz im Zeitraum"
                rateLabel="Trainingsquote"
              />
              <Card>
                {d.results.length === 0 ? (
                  <Empty icon="football-outline" text="Keine Ergebnisse im Zeitraum." />
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
            </>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
