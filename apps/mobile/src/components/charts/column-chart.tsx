import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { formatEuroShort } from '@/lib/format';
import { useIsDesktop } from '@/lib/layout';
import { useTheme } from '@/lib/theme';
import { Readout } from './readout';
import { extent, useGrow, usePointer } from './scale';

export type ColumnSeries = { key: string; label: string; color: string; values: number[] };

const PAD = { left: 44, right: 10, top: 10, bottom: 22 };
const MAX_BAR = 24;
const R = 4;

/** Säule mit 4 px gerundeter Oberkante und gerader Unterkante. */
function column(x: number, base: number, top: number, w: number): string {
  const h = Math.max(0, base - top);
  if (h <= 0) return '';
  const r = Math.min(R, h, w / 2);
  return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${base} Z`;
}

/**
 * Säulendiagramm (Paket ST), gruppiert: je Periode eine Säule je Reihe, höchstens 24 px dick. Antippen oder Fahren
 * hebt die Gruppe ab, die anderen werden gedimmt; die Werte stehen in der Anzeigezeile.
 */
export function ColumnChart({
  labels,
  series,
  height: heightProp,
  format = formatEuroShort,
  readoutFormat,
}: {
  labels: string[];
  series: ColumnSeries[];
  height?: number;
  format?: (v: number) => string;
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
  const { max } = extent(series.flatMap((s) => s.values));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = n ? innerW / n : 0;
  const barW = Math.max(3, Math.min(MAX_BAR, (slot - 6) / series.length - 2));
  const groupW = barW * series.length + 2 * (series.length - 1);
  const base = PAD.top + innerH;
  const y = (v: number) => base - (v / (max || 1)) * innerH * grow;
  const pointer = usePointer(width, n, setActive);
  const shown = active ?? n - 1;
  const fmtReadout = readoutFormat ?? format;
  const ticks = [0, max / 2, max];
  return (
    <View style={{ gap: 4 }}>
      <Readout
        title={labels[shown]}
        items={series.map((s) => ({
          label: s.label,
          value: fmtReadout(s.values[shown] ?? 0),
          color: s.color,
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
                y1={base - (t / (max || 1)) * innerH}
                y2={base - (t / (max || 1)) * innerH}
                stroke={colors.anstoss.divider}
                strokeWidth={1}
              />
            ))}
            {ticks.map((t) => (
              <SvgText
                key={`t${t}`}
                x={PAD.left - 6}
                y={base - (t / (max || 1)) * innerH + 4}
                fontSize={labelSize}
                textAnchor="end"
                fill={colors.onSurfaceMuted}
              >
                {format(t)}
              </SvgText>
            ))}
            {labels.map((l, i) => (
              <SvgText
                key={l}
                x={PAD.left + slot * i + slot / 2}
                y={height - 6}
                fontSize={labelSize}
                textAnchor="middle"
                fill={colors.onSurfaceMuted}
              >
                {l}
              </SvgText>
            ))}
            {labels.map((l, i) =>
              series.map((s, k) => (
                <Path
                  key={`${l}${s.key}`}
                  d={column(
                    PAD.left + slot * i + (slot - groupW) / 2 + k * (barW + 2),
                    base,
                    y(s.values[i] ?? 0),
                    barW,
                  )}
                  fill={s.color}
                  fillOpacity={active === null || active === i ? 1 : 0.35}
                />
              )),
            )}
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
