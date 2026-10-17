import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Card, T } from '../ui';

export type ChartTable = { head: string[]; rows: string[][] };

/**
 * Karte einer Auswertung (Paket ST): Titel, eine Aussage in Worten, Legende (ab zwei Reihen), das Diagramm und rechts
 * oben „Als Tabelle“ / „Als Diagramm“ – dieselben Zahlen ohne Grafik (auch die Alternative für Bildschirmleser).
 */
export function ChartCard({
  title,
  sentence,
  legend,
  table,
  children,
}: {
  title: string;
  sentence?: string | null;
  legend?: { label: string; color: string; dashed?: boolean }[];
  table: ChartTable;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const [asTable, setAsTable] = useState(false);
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T variant="section" style={{ flex: 1 }} accessibilityRole="header">
          {title}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={asTable ? t('Als Diagramm') : t('Als Tabelle')}
          hitSlop={10}
          onPress={() => setAsTable((v) => !v)}
        >
          <T variant="caption" color={colors.primaryText} style={{ fontWeight: '800' }}>
            {asTable ? 'Als Diagramm' : 'Als Tabelle'}
          </T>
        </Pressable>
      </View>
      {sentence ? <T verbatim>{sentence}</T> : null}
      {!asTable && legend && legend.length >= 2 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
          {legend.map((l) => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: l.dashed ? 14 : 10,
                  height: l.dashed ? 0 : 10,
                  borderRadius: 5,
                  backgroundColor: l.dashed ? 'transparent' : l.color,
                  borderTopWidth: l.dashed ? 2 : 0,
                  borderStyle: l.dashed ? 'dashed' : undefined,
                  borderColor: l.color,
                }}
              />
              <T variant="caption">{l.label}</T>
            </View>
          ))}
        </View>
      ) : null}
      {asTable ? (
        <View accessibilityRole="summary" style={{ gap: 0 }}>
          <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
            {table.head.map((h, i) => (
              <T
                key={h + i}
                variant="caption"
                style={{
                  flex: i === 0 ? 1.2 : 1,
                  textAlign: i === 0 ? 'left' : 'right',
                  fontWeight: '800',
                }}
                verbatim
              >
                {h}
              </T>
            ))}
          </View>
          {table.rows.map((row, r) => (
            <View
              key={r}
              style={{
                flexDirection: 'row',
                paddingVertical: 6,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              {row.map((cell, i) => (
                <T
                  key={i}
                  variant="caption"
                  color={colors.onSurface}
                  style={{ flex: i === 0 ? 1.2 : 1, textAlign: i === 0 ? 'left' : 'right' }}
                  verbatim
                >
                  {cell}
                </T>
              ))}
            </View>
          ))}
        </View>
      ) : (
        children
      )}
    </Card>
  );
}
