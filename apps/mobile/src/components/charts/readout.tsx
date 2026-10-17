import { View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { T } from '../ui';

export type ReadoutItem = { label: string; value: string; color?: string };

/**
 * Anzeigezeile über dem Diagramm: Zeitpunkt, dahinter die Werte (Wert vorn, Reihenname dahinter, Farbe als Punkt –
 * Text nie in der Datenfarbe). Gibt es nichts anzuzeigen, bleibt die Zeile als Platz stehen (kein Springen).
 */
export function Readout({ title, items }: { title?: string; items: ReadoutItem[] }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        minHeight: 40,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 14,
        rowGap: 2,
      }}
    >
      {title ? (
        <T variant="label" style={{ fontWeight: '800' }} verbatim>
          {title}
        </T>
      ) : null}
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {i.color ? (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.color }} />
          ) : null}
          <T variant="label" verbatim>
            {i.value}
          </T>
          <T variant="caption" color={colors.onSurfaceMuted}>
            {i.label}
          </T>
        </View>
      ))}
    </View>
  );
}
