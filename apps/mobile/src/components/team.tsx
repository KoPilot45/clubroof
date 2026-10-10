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
  linked = true,
}: {
  result: MatchResult;
  clubShortName: string;
  badge: string;
  first?: boolean;
  /** Fremde Mannschaften: Spiel nicht antippbar (Termin ist dort nicht sichtbar) */
  linked?: boolean;
}) {
  const { colors } = useTheme();
  const us = `${clubShortName} ${badge}`;
  const [home, away] = result.isHome ? [us, result.opponentName] : [result.opponentName, us];
  const [gh, ga] = result.isHome
    ? [result.goalsFor, result.goalsAgainst]
    : [result.goalsAgainst, result.goalsFor];
  return (
    <Pressable
      onPress={linked ? () => router.push(`/events/${result.eventId}`) : undefined}
      disabled={!linked}
      accessibilityRole={linked ? 'button' : undefined}
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
      <T variant="figure" color={colors.primaryText} style={{ fontSize: 22 }}>
        {gh}:{ga}
      </T>
    </Pressable>
  );
}

export function HighlightsCard({
  h,
  title = 'Team-Highlights',
  rateLabel = 'Trainingsquote (4 Wo.)',
}: {
  h: TeamHighlights;
  title?: string;
  /** null blendet die Trainingsquote aus (z. B. Mannschaftsseite für Außenstehende) */
  rateLabel?: string | null;
}) {
  return (
    <Card style={{ gap: 12 }}>
      <T variant="overline">{title}</T>
      <View style={{ flexDirection: 'row' }}>
        <Stat value={`${h.won}-${h.drawn}-${h.lost}`} label="Bilanz S-U-N" />
        <Stat value={`${h.goalsFor}:${h.goalsAgainst}`} label="Tore" />
        {rateLabel ? (
          <Stat value={h.trainingRate === null ? '–' : `${h.trainingRate} %`} label={rateLabel} />
        ) : null}
      </View>
    </Card>
  );
}

/** Kopfband der Mannschaft auf der Vereinsfarbe: Zusagen zum nächsten Termin, Bilanz, Trainingsquote. */
export function TeamBand({
  highlights,
  squad,
  yes,
}: {
  highlights: TeamHighlights;
  squad: SquadStatus | null;
  /** Zusagen zum nächsten Termin (null, wenn es keinen gibt) */
  yes: number | null;
}) {
  const { colors, radii } = useTheme();
  const items: { value: string; label: string }[] = [];
  if (yes !== null && squad) items.push({ value: `${yes}/${squad.players}`, label: 'zugesagt' });
  if (highlights.played > 0)
    items.push({
      value: `${highlights.won}-${highlights.drawn}-${highlights.lost}`,
      label: 'Bilanz S-U-N',
    });
  if (highlights.trainingRate !== null)
    items.push({ value: `${highlights.trainingRate} %`, label: 'Training (4 Wo.)' });
  if (items.length === 0) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 16,
        borderRadius: radii.lg,
        backgroundColor: colors.primary,
      }}
    >
      {items.map((i) => (
        <Stat
          key={i.label}
          value={i.value}
          label={i.label}
          color={colors.onPrimary}
          labelColor={colors.onPrimary}
        />
      ))}
    </View>
  );
}
