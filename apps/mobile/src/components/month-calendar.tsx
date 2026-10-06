import type { EventSummary } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { T } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { dateFormat, t } from '@/lib/i18n';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const monthLabel = dateFormat({ month: 'long', year: 'numeric' });

/** Lokaler Kalendertag „JJJJ-MM-TT“ */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Monatsansicht mit Punkten für Termine; Vereinstermine in Vereinsfarbe. */
export function MonthCalendar({
  month,
  events,
  selected,
  onSelect,
  onMonth,
  colorOf,
}: {
  /** Erster Tag des Monats (lokal) */
  month: Date;
  events: EventSummary[];
  selected: string | null;
  onSelect: (day: string) => void;
  onMonth: (delta: number) => void;
  /** Farbe je Termin (z. B. nach Terminart); ohne Angabe: Vereinstermine in Vereinsfarbe */
  colorOf?: (event: EventSummary) => string;
}) {
  const { colors, radii } = useTheme();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from(
      { length: days },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
    ),
  ];
  while (cells.length % 7) cells.push(null);
  const byDay = new Map<string, EventSummary[]>();
  for (const e of events) {
    const k = dayKey(new Date(e.startsAt));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const today = dayKey(new Date());

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Vorheriger Monat')}
          onPress={() => onMonth(-1)}
          hitSlop={10}
          style={{ padding: 6 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primaryText} />
        </Pressable>
        <T variant="heading">{monthLabel.format(month)}</T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Nächster Monat')}
          onPress={() => onMonth(1)}
          hitSlop={10}
          style={{ padding: 6 }}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primaryText} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d) => (
          <T key={d} variant="caption" style={{ flex: 1, textAlign: 'center' }}>
            {d}
          </T>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={{ flex: 1, height: 46 }} />;
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            const active = k === selected;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${d.getDate()}. ${list.length ? `${list.length} Termine` : 'keine Termine'}`}
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(k)}
                style={{
                  flex: 1,
                  height: 46,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  borderRadius: radii.md,
                  backgroundColor: active ? colors.primary : 'transparent',
                }}
              >
                <T
                  variant="label"
                  color={
                    active ? colors.onPrimary : k === today ? colors.primaryText : colors.onSurface
                  }
                  style={{ fontWeight: k === today || active ? '800' : '500' }}
                >
                  {d.getDate()}
                </T>
                <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                  {[
                    ...new Set(
                      list.map((e) =>
                        colorOf
                          ? colorOf(e)
                          : e.team === null
                            ? colors.primaryText
                            : colors.onSurfaceMuted,
                      ),
                    ),
                  ]
                    .slice(0, 3)
                    .map((c) => (
                      <View
                        key={c}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: c,
                          borderWidth: active ? 1 : 0,
                          borderColor: colors.onPrimary,
                        }}
                      />
                    ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
