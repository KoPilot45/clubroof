import type { SquadStatRow } from '@clubroof/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { T } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

type Col = {
  key: keyof SquadStatRow | 'cards';
  label: string;
  a11y: string;
  width: number;
  value: (r: SquadStatRow) => number | null;
};

const COLUMNS: Col[] = [
  { key: 'appearances', label: 'Sp', a11y: 'Einsätze', width: 38, value: (r) => r.appearances },
  { key: 'starts', label: 'S11', a11y: 'Startelf', width: 40, value: (r) => r.starts },
  { key: 'goals', label: 'Tore', a11y: 'Tore', width: 44, value: (r) => r.goals },
  { key: 'assists', label: 'Vorl.', a11y: 'Vorlagen', width: 46, value: (r) => r.assists },
  { key: 'yellow', label: 'Gelb', a11y: 'Gelbe Karten', width: 42, value: (r) => r.yellow },
  {
    key: 'cards',
    label: 'Rot',
    a11y: 'Gelb-Rote und Rote Karten',
    width: 38,
    value: (r) => r.yellowRed + r.red,
  },
  {
    key: 'trainingRate',
    label: 'Trng.',
    a11y: 'Trainingsquote',
    width: 52,
    value: (r) => r.trainingRate,
  },
];

/** Kader-Statistik als Tabelle: Name fest, Werte seitlich scrollbar, Sortierung per Spaltenkopf. */
export function SquadTable({ rows, showRates }: { rows: SquadStatRow[]; showRates: boolean }) {
  const { colors } = useTheme();
  const [sort, setSort] = useState<Col['key']>('goals');
  const columns = COLUMNS.filter(
    (c) => c.key !== 'trainingRate' || showRates || rows.some((r) => r.trainingRate !== null),
  );
  const col = columns.find((c) => c.key === sort) ?? columns[2]!;
  const sorted = [...rows].sort(
    (a, b) =>
      (col.value(b) ?? -1) - (col.value(a) ?? -1) ||
      b.goals - a.goals ||
      a.name.localeCompare(b.name),
  );
  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    height: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* feste Namensspalte */}
      <View style={{ width: 150 }}>
        <View style={{ height: 32, justifyContent: 'center' }}>
          <T variant="caption">Spieler</T>
        </View>
        {sorted.map((r) => (
          <Pressable
            key={r.personId}
            accessibilityRole="link"
            onPress={() => router.push(`/profile/${r.personId}`)}
            style={{ ...rowStyle, gap: 6 }}
          >
            <T variant="caption" style={{ width: 22, textAlign: 'right' }}>
              {r.jerseyNumber ?? ''}
            </T>
            <T variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {r.name}
            </T>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: 'row', height: 32, alignItems: 'center' }}>
            {columns.map((c) => {
              const active = c.key === col.key;
              return (
                <Pressable
                  key={c.key}
                  accessibilityRole="button"
                  accessibilityLabel={t(`Nach ${c.a11y} sortieren`)}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSort(c.key)}
                  style={{ width: c.width, alignItems: 'center' }}
                >
                  <T
                    variant="caption"
                    color={active ? colors.primaryText : colors.onSurfaceMuted}
                    style={{ fontWeight: active ? '800' : '600' }}
                  >
                    {c.label}
                    {active ? ' ▾' : ''}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {sorted.map((r) => (
            <View key={r.personId} style={rowStyle}>
              {columns.map((c) => {
                const v = c.value(r);
                return (
                  <View key={c.key} style={{ width: c.width, alignItems: 'center' }}>
                    <T
                      variant="label"
                      color={c.key === col.key ? colors.primaryText : colors.onSurface}
                    >
                      {v === null ? '–' : c.key === 'trainingRate' ? `${v} %` : v}
                    </T>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
