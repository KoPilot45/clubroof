import type { EventDetail } from '@clubroof/core';
import { View } from 'react-native';
import { T } from '@/components/ui';
import { formatLongDate, formatTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/** Anzeigetafel eines Spiels: beide Mannschaften, Ergebnis bzw. Anstoßzeit, Ort – als Fläche in der Vereinsfarbe. */
export function Scoreboard({
  event,
  clubShortName,
}: {
  event: EventDetail;
  clubShortName: string;
}) {
  const { colors, radii } = useTheme();
  const match = event.match;
  if (!match) return null;
  const ours = `${clubShortName}${event.team ? ` ${event.team.badge}` : ''}`;
  const [home, away] = match.isHome ? [ours, match.opponentName] : [match.opponentName, ours];
  const played = match.goalsFor != null && match.goalsAgainst != null;
  const score = played
    ? match.isHome
      ? `${match.goalsFor} : ${match.goalsAgainst}`
      : `${match.goalsAgainst} : ${match.goalsFor}`
    : formatTime(event.startsAt);
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${home} gegen ${away}, ${played ? score : formatTime(event.startsAt)}`}
      style={{
        gap: 10,
        padding: 18,
        borderRadius: radii.lg,
        backgroundColor: colors.primary,
      }}
    >
      <T variant="overline" color={colors.onPrimary} style={{ textAlign: 'center' }}>
        {[match.competition, event.type === 'tournament' ? 'Turnier' : 'Spiel']
          .filter(Boolean)
          .join(' · ')}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <T
          variant="heading"
          color={colors.onPrimary}
          style={{ flex: 1, textAlign: 'center' }}
          numberOfLines={2}
        >
          {home}
        </T>
        <T variant="figure" color={colors.onPrimary} style={{ fontSize: 40 }}>
          {score}
        </T>
        <T
          variant="heading"
          color={colors.onPrimary}
          style={{ flex: 1, textAlign: 'center' }}
          numberOfLines={2}
        >
          {away}
        </T>
      </View>
      <T variant="caption" color={colors.onPrimary} style={{ textAlign: 'center' }}>
        {[formatLongDate(event.startsAt), event.location].filter(Boolean).join(' · ')}
      </T>
    </View>
  );
}
