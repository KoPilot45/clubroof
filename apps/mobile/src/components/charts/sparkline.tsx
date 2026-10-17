import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { extent, useGrow } from './scale';

/**
 * Kleiner Verlauf (Paket ST, im Hero): Linie 2 px, Endpunkt mit Ring. Farben kommen vom Aufrufer
 * (im Hero Weiß auf der Heroflächenfarbe als Ring).
 */
export function Sparkline({
  values,
  color,
  ring,
  height = 34,
}: {
  values: number[];
  color: string;
  ring: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const grow = useGrow([values.join()]);
  const { min, max } = extent(values);
  const lo = Math.min(...values, min);
  const span = max - lo || 1;
  const pad = 6;
  const x = (i: number) =>
    pad + (values.length <= 1 ? 0 : (i / (values.length - 1)) * (width - 2 * pad));
  const y = (v: number) => pad + (height - 2 * pad) - ((v - lo) / span) * (height - 2 * pad);
  const shown = values.slice(0, Math.max(2, Math.ceil(values.length * grow)));
  const last = shown.length - 1;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }} aria-hidden>
      {width > 0 && values.length > 0 ? (
        <Svg width={width} height={height}>
          <Path
            d={shown
              .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
              .join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx={x(last)}
            cy={y(shown[last]!)}
            r={5}
            fill={color}
            stroke={ring}
            strokeWidth={2}
          />
        </Svg>
      ) : null}
    </View>
  );
}
