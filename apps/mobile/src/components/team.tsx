import type {
  EventSummary,
  MatchResult,
  SquadComposition,
  SquadStatus,
  TeamHighlights,
} from '@clubroof/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatDateTile, formatDay, formatTime } from '@/lib/format';
import { MATCH_KIND_LABELS } from '@/lib/labels';
import { useTheme } from '@/lib/theme';
import { Card, Chip, DateTile, HeroCard, HeroPill, ListRow, Stat, T } from './ui';
import { AttendanceOverview } from './squad-sheet';
import { Swipe, useCardWidth } from './home';
import { Counted } from '@/lib/motion';

export function SquadStatusCard({ squad }: { squad: SquadStatus }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Stat value={squad.players} label="Spieler" color={colors.onSurface} />
      <Stat value={squad.available} label="verfügbar" color={colors.status.success.onContainer} />
      <Stat
        value={squad.declined + squad.absent}
        label="abgesagt"
        color={colors.status.urgent.onContainer}
      />
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

/** Farben der Mannschaftsteile im Kaderbalken (immer gleich, mit Beschriftung darunter) */
const COMPOSITION: { key: keyof SquadComposition; label: (n: number) => string; color: string }[] =
  [
    { key: 'goalkeeper', label: (n) => `Tor ${n}`, color: '#FFD54F' },
    { key: 'defense', label: (n) => `Abwehr ${n}`, color: '#FFFFFF' },
    { key: 'midfield', label: (n) => `Mittelfeld ${n}`, color: '#9FE3B2' },
    { key: 'attack', label: (n) => `Sturm ${n}`, color: '#7FC4FF' },
  ];

/**
 * Blickfang der Mannschaft: Kader (Spieler, davon verfügbar) mit Zusammensetzung nach Mannschaftsteilen
 * – ohne Kaderstatus die Bilanz –, dazu Chips für Bilanz, Tabellenplatz und Trainingsquote.
 */
export function TeamBand({
  highlights,
  squad,
  composition,
  leaguePosition,
}: {
  highlights: TeamHighlights;
  squad: SquadStatus | null;
  composition?: SquadComposition;
  leaguePosition?: number | null;
}) {
  const { colors } = useTheme();
  const on = colors.hero.onHero;
  const record =
    highlights.played > 0 ? `${highlights.won}-${highlights.drawn}-${highlights.lost}` : null;
  if (!squad && !record && highlights.trainingRate === null && !leaguePosition) return null;
  const chips = [
    squad && record ? `Bilanz ${record}` : null,
    leaguePosition ? `Platz ${leaguePosition}` : null,
    highlights.trainingRate !== null ? `Training ${highlights.trainingRate} %` : null,
  ].filter((c): c is string => !!c);
  const parts = composition ? COMPOSITION.filter((c) => composition[c.key] > 0) : [];
  const total = parts.reduce((n, c) => n + composition![c.key], 0);
  return (
    <HeroCard>
      <T variant="overline" color={on}>
        {squad ? 'Kader' : 'Bilanz S-U-N'}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <T variant="figure" color={on} style={{ fontSize: 92, lineHeight: 92 }}>
          {squad ? <Counted value={squad.players} /> : record}
        </T>
        {squad ? (
          <T color={on} style={{ fontSize: 14, flexShrink: 1 }}>
            {`Spieler · ${squad.available} verfügbar`}
          </T>
        ) : null}
      </View>
      {squad && total > 0 ? (
        <View style={{ gap: 6 }}>
          <View
            style={{
              flexDirection: 'row',
              height: 10,
              borderRadius: 5,
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          >
            {parts.map((c) => (
              <View key={c.key} style={{ flex: composition![c.key], backgroundColor: c.color }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {parts.map((c) => (
              <T key={c.key} color={on} style={{ fontSize: 11.5 }}>
                {c.label(composition![c.key])}
              </T>
            ))}
          </View>
        </View>
      ) : null}
      {chips.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {chips.slice(0, 3).map((c) => (
            <HeroPill key={c} label={c} />
          ))}
        </View>
      ) : null}
    </HeroCard>
  );
}

/**
 * Trainerteam: die nächsten Spiele zum Wischen, je Karte der Zu-/Absage-Balken mit
 * zugesagt / unsicher / abgesagt / offen / abwesend – die Kaderplanung auf einen Blick.
 */
export function UpcomingMatches({
  matches,
}: {
  matches: { event: EventSummary; squad: SquadStatus }[];
}) {
  const width = useCardWidth(306);
  const [index, setIndex] = useState(0);
  const { colors } = useTheme();
  const current = Math.min(index, matches.length - 1);
  return (
    <View style={{ gap: 8 }}>
      <Swipe width={width} onIndex={setIndex}>
        {matches.map(({ event }) => {
          const kind = event.match ? MATCH_KIND_LABELS[event.match.kind] : null;
          const where = event.match ? (event.match.isHome ? 'Heimspiel' : 'Auswärts') : null;
          return (
            <Card key={event.id} style={{ width, gap: 12 }}>
              <ListRow
                first
                onPress={() => router.push(`/events/${event.id}`)}
                leading={<DateTile size="lg" {...formatDateTile(event.startsAt)} />}
                title={event.title}
                subtitle={[formatTime(event.startsAt), event.location, where, kind]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <AttendanceOverview event={event} counts={event.counts} />
            </Card>
          );
        })}
      </Swipe>
      {matches.length > 1 ? (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {matches.map((m, i) => (
              <View
                key={m.event.id}
                style={{
                  width: i === current ? 20 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: i === current ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
          <T variant="caption">{`${current + 1} von ${matches.length}`}</T>
        </View>
      ) : null}
    </View>
  );
}
