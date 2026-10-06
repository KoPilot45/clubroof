/**
 * Einfache Diagramme für die Kassenstatistik – ohne Diagramm-Bibliothek, nur Views.
 * Ein Wert-Achse je Diagramm, dünne Balken mit abgerundeten Enden, Werte per Antippen.
 * Farben: Vereinsfarbe für Einnahmen bzw. Kassenstand, neutrales Grau für Ausgaben;
 * Beschriftungen immer in Textfarbe (nicht in der Balkenfarbe).
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatEuro } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { T } from './ui';
import { dateFormat, t } from '@/lib/i18n';

const MONTH = dateFormat({ month: 'short', timeZone: 'UTC' });
const monthLabel = (m: string) => MONTH.format(new Date(`${m}-01T00:00:00Z`)).replace('.', '');

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.color }} />
          <T variant="caption">{i.label}</T>
        </View>
      ))}
    </View>
  );
}

/** Kassenstand am Monatsende als Säulen; Antippen zeigt den Betrag. */
export function BalanceBars({ months }: { months: { month: string; balanceCents: number }[] }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(months.length - 1);
  const max = Math.max(1, ...months.map((m) => Math.abs(m.balanceCents)));
  const current = months[selected];
  return (
    <View style={{ gap: 10 }}>
      {current ? (
        <T variant="label">
          {monthLabel(current.month)}: {formatEuro(current.balanceCents)}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 }}>
        {months.map((m, i) => (
          <Pressable
            key={m.month}
            accessibilityRole="button"
            accessibilityLabel={t(`${monthLabel(m.month)}: ${formatEuro(m.balanceCents)}`)}
            onPress={() => setSelected(i)}
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
          >
            <View
              style={{
                height: `${Math.max(2, (Math.abs(m.balanceCents) / max) * 100)}%`,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                backgroundColor: m.balanceCents < 0 ? colors.onSurfaceMuted : colors.primary,
                opacity: i === selected ? 1 : 0.55,
              }}
            />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {months.map((m) => (
          <T key={m.month} variant="caption" style={{ flex: 1, textAlign: 'center' }}>
            {monthLabel(m.month)}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Einnahmen nach oben, Ausgaben nach unten von einer gemeinsamen Nulllinie. */
export function IncomeExpenseBars({
  months,
}: {
  months: { month: string; incomeCents: number; expenseCents: number }[];
}) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(months.length - 1);
  const max = Math.max(1, ...months.flatMap((m) => [m.incomeCents, m.expenseCents]));
  const current = months[selected];
  const HALF = 64;
  return (
    <View style={{ gap: 10 }}>
      <Legend
        items={[
          { label: 'Einnahmen', color: colors.primary },
          { label: 'Ausgaben', color: colors.onSurfaceMuted },
        ]}
      />
      {current ? (
        <T variant="label">
          {monthLabel(current.month)}: +{formatEuro(current.incomeCents)} / −
          {formatEuro(current.expenseCents)}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {months.map((m, i) => (
          <Pressable
            key={m.month}
            accessibilityRole="button"
            accessibilityLabel={t(
              `${monthLabel(m.month)}: Einnahmen ${formatEuro(m.incomeCents)}, Ausgaben ${formatEuro(m.expenseCents)}`,
            )}
            onPress={() => setSelected(i)}
            style={{ flex: 1, opacity: i === selected ? 1 : 0.55 }}
          >
            <View style={{ height: HALF, justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: (m.incomeCents / max) * HALF,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ height: HALF }}>
              <View
                style={{
                  height: (m.expenseCents / max) * HALF,
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                  backgroundColor: colors.onSurfaceMuted,
                }}
              />
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {months.map((m) => (
          <T key={m.month} variant="caption" style={{ flex: 1, textAlign: 'center' }}>
            {monthLabel(m.month)}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Waagerechte Balken mit Beschriftung links und Wert rechts (Kategorien, Strafenarten). */
export function HorizontalBars({
  rows,
}: {
  rows: { key: string; label: string; value: number; valueLabel: string }[];
}) {
  const { colors } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.key} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <T variant="label" style={{ flex: 1 }} numberOfLines={1}>
              {r.label}
            </T>
            <T variant="label">{r.valueLabel}</T>
          </View>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.surfaceVariant,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: colors.primary,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
