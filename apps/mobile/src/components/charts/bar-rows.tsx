import { View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Chip, T } from '../ui';
import { useGrow } from './scale';

export type BarRow = {
  key: string;
  label: string;
  /** Wert des Balkens */
  value: number;
  /** Text rechts („1.800 € von 2.000 €“) */
  valueLabel: string;
  /** Balkenfarbe (Standard: Einnahmen-Blau) */
  color?: string;
  /** Marke (z. B. Plan = 100 %) an dieser Stelle */
  mark?: number;
  /** Chip mit Text und Zeichen („79 %“, „▲ +18 %“) */
  chip?: { label: string; tone: 'success' | 'action' | 'urgent' | 'neutral' };
};

/**
 * Waagrechte Balken (Paket ST), z. B. Plan gegen Ist: je Zeile Name, Balken (24 px dick höchstens, Marke bei 100 %),
 * Wert rechts und optional ein Chip. `max` setzt die Länge von 100 % (Standard: größter Wert bzw. Marke).
 */
export function BarRows({ rows, max }: { rows: BarRow[]; max?: number }) {
  const { colors } = useTheme();
  const grow = useGrow([rows.map((r) => r.value).join()]);
  const top = max ?? Math.max(1, ...rows.map((r) => Math.max(r.value, r.mark ?? 0)));
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r) => (
        <View
          key={r.key}
          accessible
          accessibilityLabel={`${r.label}: ${r.valueLabel}${r.chip ? `, ${r.chip.label}` : ''}`}
          style={{ gap: 5 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T variant="label" style={{ flex: 1 }} numberOfLines={1} verbatim>
              {r.label}
            </T>
            {r.chip ? <Chip tone={r.chip.tone} label={r.chip.label} /> : null}
          </View>
          <View
            style={{
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.anstoss.overlay,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, (r.value / top) * 100 * grow))}%`,
                borderRadius: 6,
                backgroundColor: r.color ?? colors.anstoss.chart.income,
              }}
            />
            {r.mark !== undefined ? (
              <View
                style={{
                  position: 'absolute',
                  left: `${Math.min(100, (r.mark / top) * 100)}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: colors.onSurface,
                }}
              />
            ) : null}
          </View>
          <T variant="caption" verbatim>
            {r.valueLabel}
          </T>
        </View>
      ))}
    </View>
  );
}
