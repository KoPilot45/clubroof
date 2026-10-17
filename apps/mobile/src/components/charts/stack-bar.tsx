import { View } from 'react-native';
import { formatEuro, formatPercent } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { T } from '../ui';
import { useGrow } from './scale';

export type StackSegment = { key: string; label: string; color: string; cents: number };

/**
 * Gestapelter Balken (Paket ST): Segmente mit 2 px Lücke, darunter je Segment Farbpunkt, Name, Betrag und Prozent
 * (die Farbe steht nur als Punkt – Beschriftungen in den Textfarben des Themes).
 */
export function StackBar({ segments }: { segments: StackSegment[] }) {
  const { colors } = useTheme();
  const grow = useGrow([segments.map((s) => s.cents).join()]);
  const total = segments.reduce((sum, s) => sum + s.cents, 0);
  const live = segments.filter((s) => s.cents > 0);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', height: 16, gap: 2, opacity: 0.25 + 0.75 * grow }}>
        {live.length === 0 ? (
          <View style={{ flex: 1, borderRadius: 8, backgroundColor: colors.anstoss.overlay }} />
        ) : (
          live.map((s, i) => (
            <View
              key={s.key}
              style={{
                flex: s.cents,
                backgroundColor: s.color,
                borderTopLeftRadius: i === 0 ? 8 : 2,
                borderBottomLeftRadius: i === 0 ? 8 : 2,
                borderTopRightRadius: i === live.length - 1 ? 8 : 2,
                borderBottomRightRadius: i === live.length - 1 ? 8 : 2,
              }}
            />
          ))
        )}
      </View>
      {segments.map((s) => (
        <View
          key={s.key}
          accessible
          accessibilityLabel={`${s.label}: ${formatEuro(s.cents)}${total ? `, ${formatPercent((s.cents / total) * 100)}` : ''}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
          <T style={{ flex: 1 }} variant="label" verbatim>
            {s.label}
          </T>
          <T variant="label" verbatim>
            {formatEuro(s.cents)}
          </T>
          <T variant="caption" style={{ width: 44, textAlign: 'right' }} verbatim>
            {total ? formatPercent((s.cents / total) * 100) : '–'}
          </T>
        </View>
      ))}
    </View>
  );
}
