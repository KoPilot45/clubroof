import type { SquadStatRow, StatsPeriodKind, TeamStats } from '@clubroof/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Card, ChoiceChips, DateStepper, T } from '@/components/ui';
import { toGermanDate } from '@/lib/dates';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Statistik einer Mannschaft für einen Zeitraum (Standard: gesamte Saison). */
export function useTeamStats(teamId: string) {
  const { api } = useSignedIn();
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
    queryKey: ['stats', teamId, period, period === 'custom' ? `${from}_${to}` : ''],
    queryFn: () => api<TeamStats>(`/teams/${teamId}/stats${query}`),
    // Beim Umschalten bleiben die bisherigen Werte sichtbar, bis die neuen da sind
    placeholderData: keepPreviousData,
  });
  return { stats, filter: { period, setPeriod, from, setFrom, to, setTo } };
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

export function PeriodFilter({
  filter,
  data,
}: {
  filter: ReturnType<typeof useTeamStats>['filter'];
  data: TeamStats | undefined;
}) {
  const { period, setPeriod, from, setFrom, to, setTo } = filter;
  return (
    <Card style={{ gap: 10 }}>
      <ChoiceChips options={PERIODS} selected={[period]} onToggle={setPeriod} />
      {period === 'custom' ? (
        <View style={{ gap: 8 }}>
          <DateStepper
            label="Von"
            value={from}
            min={data?.period.seasonStart}
            onChange={(v) => {
              setFrom(v);
              if (v > to) setTo(v);
            }}
          />
          <DateStepper label="Bis" value={to} min={from} onChange={setTo} />
        </View>
      ) : null}
      {data ? (
        <T variant="caption">
          {`Ausgewertet: ${toGermanDate(data.period.from)} – ${toGermanDate(data.period.to)}`}
        </T>
      ) : null}
    </Card>
  );
}

export function RateBar({ value }: { value: number | null }) {
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

export type RankingKind = 'scorers' | 'points' | 'cards';

export const RANKINGS: Record<
  RankingKind,
  {
    title: string;
    empty: string;
    value: (r: SquadStatRow) => number;
    detail: (r: SquadStatRow) => string;
  }
> = {
  scorers: {
    title: 'Torschützen',
    empty: 'Keine Tore im Zeitraum.',
    value: (r) => r.goals,
    detail: (r) => `${r.goals} ${r.goals === 1 ? 'Tor' : 'Tore'}`,
  },
  points: {
    title: 'Scorer',
    empty: 'Keine Scorerpunkte im Zeitraum.',
    value: (r) => r.goals + r.assists,
    detail: (r) => `${r.goals} T + ${r.assists} V = ${r.goals + r.assists}`,
  },
  cards: {
    title: 'Karten',
    empty: 'Keine Karten im Zeitraum.',
    // Rot zählt am meisten, dann Gelb-Rot, dann Gelb
    value: (r) => r.red * 100 + r.yellowRed * 10 + r.yellow,
    detail: (r) =>
      [
        r.yellow ? `${r.yellow}× Gelb` : null,
        r.yellowRed ? `${r.yellowRed}× Gelb-Rot` : null,
        r.red ? `${r.red}× Rot` : null,
      ]
        .filter(Boolean)
        .join(' · '),
  },
};

/** Rangliste mit geteilten Plätzen (1., 1., 3. …). */
export function RankingList({ kind, rows }: { kind: RankingKind; rows: SquadStatRow[] }) {
  const { colors } = useTheme();
  const def = RANKINGS[kind];
  const ranked = rows
    .filter((r) => def.value(r) > 0)
    .sort((a, b) => def.value(b) - def.value(a) || a.name.localeCompare(b.name));
  return (
    <Card style={{ gap: 10 }}>
      {ranked.length === 0 ? <T variant="caption">{def.empty}</T> : null}
      {ranked.map((r) => {
        const place = ranked.findIndex((x) => def.value(x) === def.value(r)) + 1;
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
            <T variant="caption">{def.detail(r)}</T>
          </View>
        );
      })}
    </Card>
  );
}
