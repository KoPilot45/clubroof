import type { SquadStatRow, StatsPeriodKind, TeamStats } from '@clubroof/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SquadTable } from '@/components/squad-table';
import { HighlightsCard, ResultRow } from '@/components/team';
import {
  Card,
  ChoiceChips,
  DateStepper,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { toGermanDate } from '@/lib/dates';
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

const PERIODS: {
  value: StatsPeriodKind;
  label: string;
  icon: 'trophy-outline' | 'calendar-outline' | 'options-outline';
}[] = [
  { value: 'season', label: 'Gesamte Saison', icon: 'trophy-outline' },
  { value: 'month', label: 'Letzter Monat', icon: 'calendar-outline' },
  { value: 'custom', label: 'Zeitraum', icon: 'options-outline' },
];

const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function StatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const team = me.teams.find((t) => t.id === id);
  const [period, setPeriod] = useState<StatsPeriodKind>('season');
  const [from, setFrom] = useState(() => localIso(new Date(Date.now() - 30 * 24 * 3_600_000)));
  const [to, setTo] = useState(() => localIso());
  const query =
    period === 'custom'
      ? `?period=custom&from=${from}&to=${to}`
      : period === 'month'
        ? '?period=month'
        : '';
  const stats = useQuery({
    queryKey: ['stats', id, period, period === 'custom' ? `${from}_${to}` : ''],
    queryFn: () => api<TeamStats>(`/teams/${id}/stats${query}`),
    // Beim Umschalten bleiben die bisherigen Werte sichtbar, bis die neuen da sind
    placeholderData: keepPreviousData,
  });
  const d = stats.data;
  const onlyMine = d
    ? d.players.every((p) => me.managedPersons.some((m) => m.id === p.personId))
    : false;

  return (
    <Screen edges={[]} refreshing={stats.isRefetching} onRefresh={() => stats.refetch()}>
      <Card style={{ gap: 10 }}>
        <ChoiceChips options={PERIODS} selected={[period]} onToggle={setPeriod} />
        {period === 'custom' ? (
          <View style={{ gap: 8 }}>
            <DateStepper
              label="Von"
              value={from}
              min={d?.period.seasonStart}
              onChange={(v) => {
                setFrom(v);
                if (v > to) setTo(v);
              }}
            />
            <DateStepper label="Bis" value={to} min={from} onChange={setTo} />
          </View>
        ) : null}
        {d ? (
          <T variant="caption">
            {`Ausgewertet: ${toGermanDate(d.period.from)} – ${toGermanDate(d.period.to)}`}
          </T>
        ) : null}
      </Card>

      {stats.isPending ? <Loading /> : null}
      {stats.error ? (
        <ErrorNotice message={stats.error.message} onRetry={() => stats.refetch()} />
      ) : null}
      {d ? (
        <View style={{ gap: 16, opacity: stats.isPlaceholderData ? 0.5 : 1 }}>
          <HighlightsCard h={d.highlights} title="Bilanz im Zeitraum" rateLabel="Trainingsquote" />

          <Ranking
            title="Torschützen"
            rows={d.squad}
            value={(r) => r.goals}
            detail={(r) => `${r.goals} ${r.goals === 1 ? 'Tor' : 'Tore'}`}
            empty="Noch keine Tore im Zeitraum."
          />
          <Ranking
            title="Scorer"
            rows={d.squad}
            value={(r) => r.goals + r.assists}
            detail={(r) => `${r.goals} T + ${r.assists} V = ${r.goals + r.assists}`}
            empty="Noch keine Scorerpunkte im Zeitraum."
          />
          <Ranking
            title="Karten"
            rows={d.squad}
            // Rot zählt am meisten, dann Gelb-Rot, dann Gelb
            value={(r) => r.red * 100 + r.yellowRed * 10 + r.yellow}
            detail={(r) =>
              [
                r.yellow ? `${r.yellow}× Gelb` : null,
                r.yellowRed ? `${r.yellowRed}× Gelb-Rot` : null,
                r.red ? `${r.red}× Rot` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            }
            empty="Keine Karten im Zeitraum."
          />

          <Section title="Kader-Statistik">
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
          </Section>
          <Section title={onlyMine ? 'Meine Beteiligung' : 'Trainingsbeteiligung'}>
            <Card style={{ gap: 12 }}>
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
          </Section>
          <Section title="Ergebnisse">
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
          </Section>
        </View>
      ) : null}
    </Screen>
  );
}

/** Rangliste mit geteilten Plätzen (1., 1., 3. …); die ersten fünf, auf Wunsch alle. */
function Ranking({
  title,
  rows,
  value,
  detail,
  empty,
}: {
  title: string;
  rows: SquadStatRow[];
  value: (r: SquadStatRow) => number;
  detail: (r: SquadStatRow) => string;
  empty: string;
}) {
  const { colors } = useTheme();
  const [all, setAll] = useState(false);
  const ranked = rows
    .filter((r) => value(r) > 0)
    .sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name));
  const shown = all ? ranked : ranked.slice(0, 5);
  return (
    <Section
      title={title}
      action={ranked.length > 5 ? (all ? 'Weniger' : `Alle ${ranked.length}`) : undefined}
      onAction={ranked.length > 5 ? () => setAll(!all) : undefined}
    >
      <Card style={{ gap: 8 }}>
        {ranked.length === 0 ? <T variant="caption">{empty}</T> : null}
        {shown.map((r) => {
          const place = ranked.findIndex((x) => value(x) === value(r)) + 1;
          return (
            <View key={r.personId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T
                variant="label"
                color={place <= 3 ? colors.primaryText : colors.onSurfaceMuted}
                style={{ width: 28, fontWeight: '800' }}
              >
                {`${place}.`}
              </T>
              <T variant="label" style={{ flex: 1 }} numberOfLines={1}>
                {r.jerseyNumber ? `${r.name} (${r.jerseyNumber})` : r.name}
              </T>
              <T variant="caption">{detail(r)}</T>
            </View>
          );
        })}
      </Card>
    </Section>
  );
}
