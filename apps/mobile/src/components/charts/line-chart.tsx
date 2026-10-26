import { LTR } from '@/lib/direction';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { formatEuroShort } from '@/lib/format';
import { useIsDesktop } from '@/lib/layout';
import { useTheme } from '@/lib/theme';
import { Readout } from './readout';
import { extent, useGrow, usePointer } from './scale';

export type LineSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
  /** Vorjahr: gestrichelt in Grau, ohne Fläche */
  dashed?: boolean;
  area?: boolean;
};

const PAD = { left: 44, right: 10, top: 10, bottom: 22 };

/**
 * Liniendiagramm (Paket ST): Linie 2 px rund, Fläche 10 %, Gitter 1 px, Endpunkt mindestens 8 px mit 2 px
 * Flächenring; Fahren oder Antippen setzt ein Fadenkreuz auf den nächsten Punkt und füllt die Anzeigezeile.
 */
export function LineChart({
  labels,
  series,
  height: heightProp,
  format = formatEuroShort,
  readoutFormat,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  /** Achsenbeschriftung (kurz) */
  format?: (v: number) => string;
  /** Wert in der Anzeigezeile (genau); Standard wie die Achse */
  readoutFormat?: (v: number) => string;
}) {
  const { colors } = useTheme();
  // Desktop (Paket DT3): höhere Diagramme (mind. 240 px) mit lesbarer Beschriftung (12 px)
  const desktop = useIsDesktop();
  const height = heightProp ?? (desktop ? 240 : 170);
  const labelSize = desktop ? 12 : 10;
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const grow = useGrow([series.map((s) => s.values.join()).join('|')]);
  const n = labels.length;
  const { min, max } = extent(series.flatMap((s) => s.values));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min || 1)) * innerH;
  const pointer = usePointer(width, n, setActive);
  const shown = active ?? n - 1;
  const fmtReadout = readoutFormat ?? format;
  const ticks = [min, (min + max) / 2, max];
  const path = (values: number[]) =>
    values
      .slice(0, Math.max(2, Math.ceil(values.length * grow)))
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ');
  return (
    <View {...LTR} style={{ gap: 4, direction: 'ltr' }}>
      <Readout
        title={labels[shown]}
        items={series.map((s) => ({
          label: s.label,
          value: fmtReadout(s.values[shown] ?? 0),
          color: s.dashed ? colors.anstoss.textTertiary : s.color,
        }))}
      />
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line
                key={t}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={colors.anstoss.divider}
                strokeWidth={1}
              />
            ))}
            {ticks.map((t) => (
              <SvgText
                key={`t${t}`}
                x={PAD.left - 6}
                y={y(t) + 4}
                fontSize={labelSize}
                textAnchor="end"
                fill={colors.onSurfaceMuted}
              >
                {format(t)}
              </SvgText>
            ))}
            {labels.map((l, i) =>
              n <= 6 || i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
                <SvgText
                  key={l}
                  x={x(i)}
                  y={height - 6}
                  fontSize={labelSize}
                  textAnchor="middle"
                  fill={colors.onSurfaceMuted}
                >
                  {l}
                </SvgText>
              ) : null,
            )}
            {series
              .filter((s) => s.area && !s.dashed)
              .map((s) => (
                <Path
                  key={`a${s.key}`}
                  d={`${path(s.values)} L${x(Math.max(1, Math.ceil(n * grow)) - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`}
                  fill={s.color}
                  fillOpacity={0.1}
                />
              ))}
            {series.map((s) => (
              <Path
                key={s.key}
                d={path(s.values)}
                fill="none"
                stroke={s.dashed ? colors.anstoss.textTertiary : s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? '5 4' : undefined}
              />
            ))}
            {active !== null ? (
              <Line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke={colors.onSurfaceMuted}
                strokeWidth={1}
              />
            ) : null}
            {series
              .filter((s) => !s.dashed)
              .map((s) => (
                <Circle
                  key={`p${s.key}`}
                  cx={x(shown)}
                  cy={y(s.values[shown] ?? 0)}
                  r={4.5}
                  fill={s.color}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              ))}
          </Svg>
        ) : null}
        <View
          accessibilityRole="image"
          accessibilityLabel={series
            .map(
              (s) =>
                `${s.label}: ${labels.map((l, i) => `${l} ${fmtReadout(s.values[i] ?? 0)}`).join(', ')}`,
            )
            .join('. ')}
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
          {...pointer}
        />
      </View>
    </View>
  );
}
