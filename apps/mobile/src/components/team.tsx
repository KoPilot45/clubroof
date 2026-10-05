import type { MatchResult, SquadStatus, TeamHighlights } from '@clubroof/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { formatDay } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { Card, Chip, Stat, T } from './ui';

export function SquadStatusCard({ squad }: { squad: SquadStatus }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Stat value={squad.players} label="Spieler" color={colors.onSurface} />
      <Stat value={squad.available} label="verfügbar" color={colors.status.success.onContainer} />
      <Stat value={squad.declined} label="abgesagt" color={colors.status.urgent.onContainer} />
      <Stat value={squad.absent} label="abwesend" color={colors.status.info.onContainer} />
      <Stat value={squad.pending} label="offen" color={colors.onSurfaceMuted} />
    </View>
  );
}

const OUTCOME = {
  win: { tone: 'success', label: 'S' },
  draw: { tone: 'archived', label: 'U' },
  loss: { tone: 'urgent', label: 'N' },
} as const;

export function ResultRow({
  result,
  clubShortName,
  badge,
  first,
}: {
  result: MatchResult;
  clubShortName: string;
  badge: string;
  first?: boolean;
}) {
  const { colors } = useTheme();
  const us = `${clubShortName} ${badge}`;
  const [home, away] = result.isHome ? [us, result.opponentName] : [result.opponentName, us];
  const [gh, ga] = result.isHome
    ? [result.goalsFor, result.goalsAgainst]
    : [result.goalsAgainst, result.goalsFor];
  return (
    <Pressable
      onPress={() => router.push(`/events/${result.eventId}`)}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <Chip tone={OUTCOME[result.outcome].tone} label={OUTCOME[result.outcome].label} />
      <View style={{ flex: 1 }}>
        <T variant="label" numberOfLines={1}>
          {home} – {away}
        </T>
        <T variant="caption">
          {formatDay(result.startsAt)} · {result.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
        </T>
      </View>
      <T variant="heading" color={colors.primaryText}>
        {gh}:{ga}
      </T>
    </Pressable>
  );
}

export function HighlightsCard({ h }: { h: TeamHighlights }) {
  return (
    <Card style={{ gap: 12 }}>
      <T variant="overline">Team-Highlights</T>
      <View style={{ flexDirection: 'row' }}>
        <Stat value={`${h.won}-${h.drawn}-${h.lost}`} label="Bilanz S-U-N" />
        <Stat value={`${h.goalsFor}:${h.goalsAgainst}`} label="Tore" />
        <Stat
          value={h.trainingRate === null ? '–' : `${h.trainingRate} %`}
          label="Trainingsquote (4 Wo.)"
        />
      </View>
    </Card>
  );
}
