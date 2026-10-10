import type { AttendanceCounts, MatchResult, SquadStatus, TeamHighlights } from '@clubroof/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { formatDay } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { Card, Chip, HeroCard, Stat, T } from './ui';
import { Text } from './app-text';

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
  win: { tone: 'success', label: 'Sieg' },
  draw: { tone: 'archived', label: 'Remis' },
  loss: { tone: 'urgent', label: 'Niederlage' },
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
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="label" numberOfLines={2} style={{ fontWeight: '700' }}>
          {home} – {away}
        </T>
        <T variant="caption">
          {formatDay(result.startsAt)} · {result.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
        </T>
      </View>
      <T variant="figure" color={colors.primaryText} style={{ fontSize: 24 }}>
        {gh}:{ga}
      </T>
      <View style={{ minWidth: 84, alignItems: 'flex-end' }}>
        <Chip tone={OUTCOME[result.outcome].tone} label={OUTCOME[result.outcome].label} />
      </View>
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

/**
 * Blickfang der Mannschaft: Kader (Spieler, davon verfügbar) – ohne Kaderstatus die Bilanz –, dazu Chips
 * für Bilanz und Trainingsquote. Tabellenplatz und Torschützenkönig folgen, sobald es die Daten gibt.
 */
export function TeamBand({
  highlights,
  squad,
  leaguePosition,
  topScorer,
}: {
  highlights: TeamHighlights;
  squad: SquadStatus | null;
  leaguePosition?: number | null;
  topScorer?: { name: string; goals: number } | null;
}) {
  const { colors } = useTheme();
  const on = colors.hero.onHero;
  const record =
    highlights.played > 0 ? `${highlights.won}-${highlights.drawn}-${highlights.lost}` : null;
  if (!squad && !record && highlights.trainingRate === null && !leaguePosition) return null;
  const chips = [
    leaguePosition ? `Tabelle: Platz ${leaguePosition}` : null,
    topScorer ? `Top-Torschütze: ${topScorer.name} · ${topScorer.goals}` : null,
    squad && record ? `Bilanz ${record}` : null,
    highlights.trainingRate !== null ? `Training ${highlights.trainingRate} %` : null,
  ].filter((c): c is string => !!c);
  return (
    <HeroCard>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <T variant="overline" color={on}>
            {squad ? 'Kader' : 'Bilanz S-U-N'}
          </T>
          <T variant="figure" color={on} style={{ fontSize: 44, lineHeight: 50 }}>
            {squad ? squad.players : record}
          </T>
          {squad ? (
            <T variant="label" color={on} style={{ fontWeight: '400' }}>
              {`Spieler · ${squad.available} verfügbar`}
            </T>
          ) : null}
        </View>
        <View style={{ gap: 6, alignItems: 'flex-end', flexShrink: 1 }}>
          {chips.slice(0, 3).map((c, i) => (
            <View
              key={c}
              style={{
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: i === 0 ? on : 'rgba(255,255,255,0.22)',
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  textAlign: 'right',
                  fontSize: 12,
                  fontWeight: '700',
                  color: i === 0 ? colors.hero.from : on,
                }}
              >
                {c}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </HeroCard>
  );
}

/** Balken der Rückmeldungen zu einem Termin mit Legende (zugesagt, unsicher, abgesagt, offen). */
export function AttendanceBar({ counts, absent }: { counts: AttendanceCounts; absent?: number }) {
  const { colors } = useTheme();
  const parts = [
    { key: 'yes', n: counts.yes, color: colors.status.success.solid, label: 'zugesagt' },
    { key: 'maybe', n: counts.maybe, color: colors.status.action.solid, label: 'unsicher' },
    { key: 'no', n: counts.no, color: colors.status.urgent.solid, label: 'abgesagt' },
    { key: 'pending', n: counts.pending, color: colors.border, label: 'offen' },
  ];
  const total = parts.reduce((sum, p) => sum + p.n, 0);
  return (
    <View style={{ gap: 8 }}>
      <View
        aria-hidden
        style={{
          flexDirection: 'row',
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
          backgroundColor: colors.border,
        }}
      >
        {total > 0
          ? parts
              .filter((p) => p.n > 0)
              .map((p) => <View key={p.key} style={{ flex: p.n, backgroundColor: p.color }} />)
          : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2 }}>
        {parts.map((p) => (
          <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
            <T variant="caption">{`${p.n} ${p.label}`}</T>
          </View>
        ))}
        {absent ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.status.info.solid,
              }}
            />
            <T variant="caption">{`${absent} abwesend`}</T>
          </View>
        ) : null}
      </View>
    </View>
  );
}
