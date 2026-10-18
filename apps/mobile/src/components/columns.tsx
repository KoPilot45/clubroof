/**
 * Spalten der Desktop-Ansicht (Paket DT): Auf dem Desktop stehen die Kinder nebeneinander und brechen um, wenn sie
 * weniger als `min` Pixel Platz hätten; sonst (Handy, Tablet) untereinander wie bisher. `weights` verteilt die
 * Breite (Standard: gleich); Kinder ohne Inhalt (`null`) entfallen.
 */
import { Children, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsDesktop } from '@/lib/layout';

export function Columns({
  children,
  min = 360,
  gap = 18,
  weights,
  style,
}: {
  children: ReactNode;
  min?: number;
  gap?: number;
  weights?: number[];
  style?: StyleProp<ViewStyle>;
}) {
  const desktop = useIsDesktop();
  const items = Children.toArray(children);
  if (items.length === 0) return null;
  if (!desktop) return <View style={[{ gap }, style]}>{items}</View>;
  return (
    <View
      style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap }, style]}
    >
      {items.map((child, i) => (
        <View
          key={i}
          style={{ flexGrow: weights?.[i] ?? 1, flexShrink: 1, flexBasis: min, minWidth: 0 }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
