/**
 * Stundenplan der Platzbelegung (Paket PB): Zeitachse links, je Spalte ein Platz (Tag) oder ein Tag (Woche).
 * Termine sind Blöcke in der Farbe ihrer Mannschaft, Sperrungen schraffiert, Überschneidungen markiert.
 * Reine Ansicht: Blöcke werden nur angetippt, nicht verschoben.
 */
import { Ionicons } from '@expo/vector-icons';
import type { FacilityBooking } from '@clubroof/core';
import { useId } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { T } from '@/components/ui';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { clubDayMinutes, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export type GridColumn = {
  key: string;
  title: string;
  subtitle?: string;
  /** Kalendertag (JJJJ-MM-TT), dessen Anteil der Belegungen die Spalte zeigt */
  day: string;
  bookings: FacilityBooking[];
};

type Segment = {
  booking: FacilityBooking;
  start: number;
  end: number;
  lane: number;
  lanes: number;
};

const HOUR = 52;
const AXIS = 38;

/** Anteil einer Belegung an einem Tag in Minuten seit Mitternacht (null: liegt nicht auf dem Tag). */
function clip(b: FacilityBooking, day: string): { start: number; end: number } | null {
  const s = clubDayMinutes(b.startsAt);
  const e = clubDayMinutes(b.endsAt);
  if (s.day > day || e.day < day) return null;
  const start = s.day < day ? 0 : s.minutes;
  const end = e.day > day ? 1440 : e.minutes;
  return end > start ? { start, end } : null;
}

/** Überlappende Belegungen einer Spalte nebeneinander legen. */
function layout(column: GridColumn): Segment[] {
  const items = column.bookings
    .map((booking) => ({ booking, ...clip(booking, column.day)! }))
    .filter((x) => x.start !== undefined)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Segment[] = [];
  let cluster: Segment[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => c.end > it.start).map((c) => c.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return out;
}

/** Zeitfenster in Stunden: frühester Beginn bis spätester Schluss der Termine (Sperrungen nur, wenn es keine gibt). */
export function timeWindow(columns: GridColumn[]): { from: number; to: number } {
  const collect = (kind: 'event' | 'block') =>
    columns.flatMap((c) =>
      c.bookings
        .filter((b) => b.kind === kind)
        .map((b) => clip(b, c.day))
        .filter((x): x is { start: number; end: number } => x !== null),
    );
  // Termine bestimmen das Fenster; kurze Sperrungen (unter 12 Std.) zählen mit, ganztägige werden gekürzt
  const used = [...collect('event'), ...collect('block').filter((u) => u.end - u.start < 12 * 60)];
  if (!used.length) return { from: 8, to: 20 };
  let from = Math.floor(Math.min(...used.map((u) => u.start)) / 60);
  let to = Math.ceil(Math.max(...used.map((u) => u.end)) / 60);
  if (to - from < 3) to = Math.min(24, from + 3);
  if (to - from < 3) from = Math.max(0, to - 3);
  return { from, to };
}

/** Eigene Farbe je Mannschaft: gleichmäßig über den Farbkreis verteilt, in der Reihenfolge der Kürzel. */
export function teamColors(
  badges: string[],
  isDark: boolean,
): Map<string, { bg: string; fg: string }> {
  const order = [...new Set(badges)].sort();
  return new Map(
    order.map((badge, i) => {
      const hue = Math.round((i * 137.5) % 360);
      return [
        badge,
        isDark
          ? { bg: `hsl(${hue}, 45%, 26%)`, fg: `hsl(${hue}, 70%, 88%)` }
          : { bg: `hsl(${hue}, 72%, 86%)`, fg: `hsl(${hue}, 65%, 20%)` },
      ];
    }),
  );
}

/** Legende: Farbfläche mit Kürzel je Mannschaft (Farbe nie allein). */
export function TeamLegend({ colors }: { colors: Map<string, { bg: string; fg: string }> }) {
  const { colors: theme } = useTheme();
  if (colors.size === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {[...colors.entries()].map(([badge, c]) => (
        <View
          key={badge}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: c.bg,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <T variant="caption" color={c.fg} verbatim style={{ fontWeight: '800' }}>
            {badge}
          </T>
        </View>
      ))}
    </View>
  );
}

function Hatch({ color }: { color: string }) {
  const id = useId();
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <Pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse">
          <Line x1={-2} y1={10} x2={10} y2={-2} stroke={color} strokeWidth={2} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

type LabelMode = 'default' | 'compact' | 'wide';

function Block({
  seg,
  from,
  onPress,
  teams,
  mode,
}: {
  seg: Segment;
  from: number;
  onPress: (b: FacilityBooking) => void;
  teams: Map<string, { bg: string; fg: string }>;
  mode: LabelMode;
}) {
  const { colors, radii } = useTheme();
  const b = seg.booking;
  const isBlock = b.kind === 'block';
  const tint = {
    container: (b.teamBadge && teams.get(b.teamBadge)?.bg) || colors.surfaceVariant,
    onContainer: (b.teamBadge && teams.get(b.teamBadge)?.fg) || colors.onSurface,
  };
  const top = ((seg.start - from * 60) / 60) * HOUR;
  const height = Math.max(22, ((seg.end - seg.start) / 60) * HOUR - 2);
  const bg = isBlock ? colors.status.urgent.container : tint.container;
  const fg = isBlock ? colors.status.urgent.onContainer : tint.onContainer;
  const time = `${formatTime(b.startsAt)}–${formatTime(b.endsAt)}`;
  // Wochenende: Zeit und Text ohne Gegner („B1 · Spiel“); Mo–Fr: nur Kürzel und Uhrzeit
  const kind = b.eventType ? t(EVENT_TYPE_LABELS[b.eventType]) : b.title;
  const label = isBlock
    ? `${t('Gesperrt')}: ${b.title}`
    : mode === 'compact'
      ? (b.teamBadge ?? b.title)
      : mode === 'wide'
        ? `${b.teamBadge ? `${b.teamBadge} · ` : ''}${kind}`
        : `${b.teamBadge ? `${b.teamBadge} · ` : ''}${b.title}`;
  const shownTime = mode === 'compact' ? formatTime(b.startsAt) : time;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${time}${b.conflict ? `, ${t('Überschneidung')}` : ''}${
        b.cancelled ? `, ${t('Abgesagt')}` : ''
      }`}
      onPress={() => onPress(b)}
      style={{
        position: 'absolute',
        top,
        height,
        left: `${(seg.lane / seg.lanes) * 100}%`,
        width: `${100 / seg.lanes}%`,
        paddingHorizontal: 1,
      }}
    >
      <View
        style={{
          flex: 1,
          overflow: 'hidden',
          borderRadius: radii.sm,
          backgroundColor: bg,
          padding: 4,
          borderWidth: b.conflict ? 2 : 1,
          borderColor: b.conflict ? colors.status.action.onContainer : colors.border,
          opacity: b.cancelled ? 0.55 : 1,
        }}
      >
        {isBlock ? <Hatch color={colors.status.urgent.onContainer + '55'} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {b.conflict ? <Ionicons name="warning" size={12} color={fg} /> : null}
          <T
            variant="caption"
            color={fg}
            numberOfLines={height > 40 ? 2 : 1}
            style={{ flex: 1, textDecorationLine: b.cancelled ? 'line-through' : 'none' }}
            verbatim
          >
            {label}
          </T>
        </View>
        {height > 40 || mode !== 'default' ? (
          <T variant="caption" color={fg} numberOfLines={1} verbatim>
            {shownTime}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Ein Raster (Zeitachse + Spalten). `tinted`: leicht abgesetzt, z. B. für das Wochenende. */
export function FacilityGrid({
  columns,
  onPressBooking,
  teams,
  tinted = false,
  minColumnWidth,
  mode = 'default',
  bleed = false,
}: {
  columns: GridColumn[];
  onPressBooking: (b: FacilityBooking, column: GridColumn) => void;
  /** Farbe je Mannschaftskürzel */
  teams: Map<string, { bg: string; fg: string }>;
  tinted?: boolean;
  minColumnWidth?: number;
  mode?: LabelMode;
  /** randlos über die volle Breite (ohne Rahmen und runde Ecken) */
  bleed?: boolean;
}) {
  const { colors, radii } = useTheme();
  // Bis vier Spalten (Tag) teilen sich die Breite, damit keine abgeschnitten wird; sonst wird gescrollt
  const columnMin = minColumnWidth ?? (columns.length <= 4 ? 0 : 84);
  const { from, to } = timeWindow(columns);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const height = (to - from) * HOUR;
  return (
    <View
      style={{
        ...(bleed
          ? { marginHorizontal: -24, borderTopWidth: 1, borderBottomWidth: 1 }
          : { borderRadius: radii.md, borderWidth: 1 }),
        borderColor: colors.border,
        backgroundColor: tinted ? colors.surfaceVariant : colors.surface,
        overflow: 'hidden',
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ flexDirection: 'row', minWidth: '100%' }}>
          <View style={{ width: AXIS }}>
            <View style={{ height: 48 }} />
            <View style={{ height }}>
              {hours.map((h) => (
                <T
                  key={h}
                  variant="caption"
                  color={colors.onSurfaceMuted}
                  verbatim
                  style={{ position: 'absolute', top: (h - from) * HOUR - 7, right: 4 }}
                >
                  {String(h).padStart(2, '0')}
                </T>
              ))}
            </View>
          </View>
          {columns.map((c) => (
            <View
              key={c.key}
              style={{
                flex: 1,
                minWidth: columnMin,
                borderLeftWidth: 1,
                borderLeftColor: colors.border,
              }}
            >
              <View style={{ height: 48, justifyContent: 'center', paddingHorizontal: 4 }}>
                <T
                  variant="label"
                  numberOfLines={2}
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    lineHeight: 13,
                    // Web: Silbentrennung statt Bruch mitten im Wort
                    ...({ hyphens: 'auto', overflowWrap: 'anywhere' } as object),
                  }}
                >
                  {c.title}
                </T>
                {c.subtitle ? (
                  <T
                    variant="caption"
                    color={colors.onSurfaceMuted}
                    numberOfLines={1}
                    style={{ textAlign: 'center' }}
                  >
                    {c.subtitle}
                  </T>
                ) : null}
              </View>
              <View style={{ height }}>
                {hours.map((h) => (
                  <View
                    key={h}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: (h - from) * HOUR,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  />
                ))}
                {layout(c)
                  .map((seg) => ({
                    ...seg,
                    start: Math.max(seg.start, from * 60),
                    end: Math.min(seg.end, to * 60),
                  }))
                  .filter((seg) => seg.end > seg.start)
                  .map((seg) => (
                    <Block
                      key={seg.booking.id}
                      seg={seg}
                      from={from}
                      teams={teams}
                      mode={mode}
                      onPress={(b) => onPressBooking(b, c)}
                    />
                  ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
