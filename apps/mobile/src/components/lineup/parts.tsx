/**
 * Bausteine des Aufstellungsplaners (Paket AUF): Spielerscheibe, Spielfeld, Bank- und Kaderleiste,
 * Formationschips, Beteiligungsbalken. Farben nur aus dem Theme; Beteiligung immer zusätzlich als Prozentwert.
 */
import {
  PLAYER_POSITION_ABBR,
  attendanceLevel,
  formationLabels,
  type AttendanceLevel,
  type Formation,
  type LineupAttendance,
} from '@clubroof/core';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Text } from '@/components/app-text';
import { EdgeHint, T, withAlpha } from '@/components/ui';
import { Draggable, DropZone, useStrip, type DragData } from './dnd';
import { t } from '@/lib/i18n';
import { useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/lib/theme';

// ── Spieler im Planer ─────────────────────────────────────────────────────────

export type PlannerPlayer = {
  id: string;
  /** voller Name */
  name: string;
  /** Nachname für die Schilder */
  last: string;
  number: number | null;
  /** Kürzel der Hauptposition („IV“) */
  abbr: string | null;
  /** ausgeschriebene Position */
  position: string | null;
  status: 'yes' | 'maybe' | 'pending' | 'no';
  /** Grund der Absage (nur Trainerteam) */
  reason: string | null;
  attendance: LineupAttendance | null;
};

export function playerFromCandidate(c: {
  personId: string;
  name: string;
  status: PlannerPlayer['status'];
  position: string | null;
  jerseyNumber: number | null;
  reason: string | null;
  attendance: LineupAttendance;
}): PlannerPlayer {
  const parts = c.name.split(' ');
  return {
    id: c.personId,
    name: c.name,
    last: parts.slice(1).join(' ') || c.name,
    number: c.jerseyNumber,
    abbr: c.position ? (PLAYER_POSITION_ABBR[c.position] ?? null) : null,
    position: c.position,
    status: c.status,
    reason: c.reason,
    attendance: c.attendance,
  };
}

export function useLevelColor() {
  const { colors } = useTheme();
  return (level: AttendanceLevel) =>
    level === 'good'
      ? colors.status.success.solid
      : level === 'medium'
        ? colors.status.action.solid
        : level === 'low'
          ? colors.status.urgent.solid
          : colors.anstoss.textTertiary;
}

/** Beteiligung als Text für Bildschirmleser und Chips: „75 %“ bzw. „–“ ohne Training. */
export const percentText = (p: PlannerPlayer) =>
  p.attendance?.percent != null ? `${p.attendance.percent} %` : '–';

export const playerLabel = (p: PlannerPlayer, where?: string) =>
  [
    p.name,
    p.number != null ? t(`Nummer ${p.number}`) : null,
    p.position,
    p.attendance ? `${t('Beteiligung')} ${percentText(p)}` : null,
    where,
  ]
    .filter(Boolean)
    .join(', ');

// ── Scheibe ───────────────────────────────────────────────────────────────────

export function Disc({
  size,
  number,
  label,
  ring,
  mine,
}: {
  size: number;
  number?: number | null;
  /** Positionskürzel einer leeren Position */
  label?: string;
  ring?: 'select' | 'over';
  /** eigene Scheibe in der Spieleransicht in Akzentfarbe */
  mine?: boolean;
}) {
  const { colors } = useTheme();
  const empty = label !== undefined;
  const ringColor =
    ring === 'select' ? colors.status.action.solid : ring === 'over' ? colors.primary : null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: empty ? 'rgba(0,0,0,0.22)' : mine ? colors.primary : '#FFFFFF',
        borderWidth: empty ? 2 : 0,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.4)',
        ...(ringColor
          ? {
              shadowColor: ringColor,
              shadowOpacity: 0.7,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
            }
          : null),
        ...(ringColor
          ? { borderWidth: 4, borderColor: ringColor, borderStyle: 'solid' as const }
          : null),
      }}
    >
      <T
        variant="figure"
        verbatim
        color={empty ? 'rgba(255,255,255,0.6)' : mine ? colors.onPrimary : '#0B120E'}
        style={{
          fontSize: Math.round(size * (empty ? 0.34 : 0.47)),
          lineHeight: Math.round(size * 0.5),
        }}
      >
        {empty ? label : number != null ? String(number) : '–'}
      </T>
    </View>
  );
}

function NamePlate({ name, small }: { name: string; small?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(6,14,9,0.78)',
        borderRadius: 6,
        paddingHorizontal: small ? 4 : 7,
        paddingVertical: small ? 1 : 3,
        maxWidth: 78,
      }}
    >
      <Text
        numberOfLines={1}
        verbatim
        style={{
          color: '#FFFFFF',
          fontSize: small ? 8.5 : 10.5,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {name}
      </Text>
    </View>
  );
}

function Dot({
  player,
  top = -2,
  right = -4,
}: {
  player: PlannerPlayer;
  top?: number;
  right?: number;
}) {
  const levelColor = useLevelColor();
  if (!player.attendance) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top,
        right,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#0E1A12',
        backgroundColor: levelColor(attendanceLevel(player.attendance.percent)),
      }}
    />
  );
}

// ── Spielfeld ─────────────────────────────────────────────────────────────────

export function Pitch({
  formation,
  slots,
  players,
  selectedSlot,
  hoverId,
  onSlot,
  readOnly,
  mineId,
  showDots,
}: {
  formation: Formation;
  slots: (string | null)[];
  players: Map<string, PlannerPlayer>;
  /** gewählter Platz (Antippen-Alternative) */
  selectedSlot?: number | null;
  /** Fläche, über der gerade eine Ziehfigur schwebt */
  hoverId?: string | null;
  onSlot?: (index: number) => void;
  readOnly?: boolean;
  /** eigene Person (Spieleransicht) */
  mineId?: string | null;
  showDots?: boolean;
}) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const height = Math.min(520, Math.max(300, windowHeight - 500));
  const rows = formation.rows;
  const labels = formationLabels(formation);
  const starts: number[] = [];
  rows.reduce((acc, r) => {
    starts.push(acc);
    return acc + r.length;
  }, 0);
  const disc = rows.length >= 6 ? 28 : rows.length === 5 ? 34 : 40;
  const small = rows.length >= 5;
  const { pitch } = colors.anstoss;
  const stroke = pitch.line;
  const { w, h } = box;
  return (
    <View
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{
        height,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.anstoss.cardBorder,
        backgroundColor: pitch.grass,
      }}
    >
      {Array.from({ length: 8 }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${i * 12.5}%`,
            height: '12.5%',
            backgroundColor: i % 2 === 0 ? pitch.grass : pitch.grassAlt,
          }}
        />
      ))}
      {w > 0 ? (
        <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
          <Rect
            x={8}
            y={8}
            width={w - 16}
            height={h - 16}
            stroke={stroke}
            strokeWidth={2}
            fill="none"
          />
          <Line x1={8} y1={h / 2} x2={w - 8} y2={h / 2} stroke={stroke} strokeWidth={2} />
          <Circle
            cx={w / 2}
            cy={h / 2}
            r={Math.min(w, h) * 0.14}
            stroke={stroke}
            strokeWidth={2}
            fill="none"
          />
          <Rect
            x={w * 0.25}
            y={8}
            width={w * 0.5}
            height={h * 0.16}
            stroke={stroke}
            strokeWidth={2}
            fill="none"
          />
          <Rect
            x={w * 0.37}
            y={8}
            width={w * 0.26}
            height={h * 0.07}
            stroke={stroke}
            strokeWidth={2}
            fill="none"
          />
          <Rect
            x={w * 0.25}
            y={h - 8 - h * 0.16}
            width={w * 0.5}
            height={h * 0.16}
            stroke={stroke}
            strokeWidth={2}
            fill="none"
          />
          <Rect
            x={w * 0.37}
            y={h - 8 - h * 0.07}
            width={w * 0.26}
            height={h * 0.07}
            stroke={stroke}
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      ) : null}
      <View style={{ flex: 1, paddingVertical: 12 }}>
        {rows
          .map((row, ri) => ({ row, ri }))
          .reverse()
          .map(({ row, ri }) => (
            <View
              key={ri}
              style={{
                flex: 1,
                flexDirection: 'row',
                justifyContent: 'space-around',
                alignItems: 'center',
              }}
            >
              {row.map((label, ci) => {
                const index = starts[ri]! + ci;
                const id = slots[index] ?? null;
                const player = id ? (players.get(id) ?? null) : null;
                return (
                  <Slot
                    key={index}
                    index={index}
                    label={labels[index] ?? label}
                    player={player}
                    disc={disc}
                    small={small}
                    selected={selectedSlot === index}
                    over={hoverId === `s:${index}`}
                    onPress={onSlot}
                    readOnly={readOnly}
                    mine={!!mineId && player?.id === mineId}
                    showDot={showDots}
                  />
                );
              })}
            </View>
          ))}
      </View>
    </View>
  );
}

function Slot({
  index,
  label,
  player,
  disc,
  small,
  selected,
  over,
  onPress,
  readOnly,
  mine,
  showDot,
}: {
  index: number;
  label: string;
  player: PlannerPlayer | null;
  disc: number;
  small: boolean;
  selected: boolean;
  over: boolean;
  onPress?: (i: number) => void;
  readOnly?: boolean;
  mine?: boolean;
  showDot?: boolean;
}) {
  const reduce = useReduceMotion();
  const ring = selected ? 'select' : over ? 'over' : undefined;
  const body = (
    <View style={{ alignItems: 'center', gap: 4, minWidth: disc + 8 }}>
      <View style={{ transform: [{ scale: over && !reduce ? 1.12 : 1 }] }}>
        {player ? (
          <Disc size={disc} number={player.number} ring={ring} mine={mine} />
        ) : (
          <Disc size={disc} label={label} ring={ring} />
        )}
        {player && showDot ? <Dot player={player} /> : null}
      </View>
      <View style={{ opacity: player ? 1 : 0 }}>
        <NamePlate name={player?.last ?? '–'} small={small} />
      </View>
    </View>
  );
  const accessibilityLabel = player ? playerLabel(player, label) : t(`Freie Position ${label}`);
  const press = (
    <Pressable
      accessibilityRole={readOnly ? 'text' : 'button'}
      accessibilityLabel={accessibilityLabel}
      disabled={readOnly}
      onPress={() => onPress?.(index)}
      hitSlop={4}
    >
      {body}
    </Pressable>
  );
  if (readOnly) return press;
  return (
    <DropZone id={`s:${index}`}>
      {player ? (
        <Draggable
          data={{
            src: `s:${index}`,
            personId: player.id,
            number: String(player.number ?? '–'),
            name: player.last,
          }}
        >
          {press}
        </Draggable>
      ) : (
        press
      )}
    </DropZone>
  );
}

// ── Bank ──────────────────────────────────────────────────────────────────────

/** Seitlich scrollende Leiste, die sich fürs automatische Weiterblättern beim Ziehen anmeldet. */
export function Strip({
  id,
  children,
  over,
  gap = 8,
}: {
  id: string;
  children: React.ReactNode;
  over?: boolean;
  gap?: number;
}) {
  const { colors } = useTheme();
  const strip = useStrip(id);
  const [more, setMore] = useState(true);
  const box = useRef({ view: 0, content: 0, x: 0 });
  const update = () =>
    setMore(box.current.content > 0 && box.current.x + box.current.view < box.current.content - 12);
  return (
    <View
      ref={strip.view}
      collapsable={false}
      style={{
        borderRadius: 16,
        borderWidth: 2,
        // der Ring beim Ziehen liegt außen und schiebt das Layout nicht
        margin: -2,
        borderColor: over ? colors.primary : 'transparent',
      }}
    >
      <ScrollView
        ref={(r) => {
          strip.scroller.current = r;
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        contentContainerStyle={{ gap, paddingRight: 28 }}
        onLayout={(e) => {
          box.current.view = e.nativeEvent.layout.width;
          update();
        }}
        onContentSizeChange={(w) => {
          box.current.content = w;
          update();
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          box.current.x = e.nativeEvent.contentOffset.x;
          strip.offset.current = e.nativeEvent.contentOffset.x;
          update();
        }}
      >
        {children}
      </ScrollView>
      <EdgeHint visible={more} />
    </View>
  );
}

export function BenchTile({
  index,
  player,
  selected,
  over,
  onPress,
}: {
  index: number;
  player: PlannerPlayer | null;
  selected: boolean;
  over: boolean;
  onPress: (i: number) => void;
}) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const ring = selected ? colors.status.action.solid : over ? colors.primary : null;
  const tile = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={player ? playerLabel(player, t('Bank')) : t('Freier Bankplatz')}
      onPress={() => onPress(index)}
      style={{
        width: 60,
        height: 62,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        backgroundColor: colors.anstoss.card,
        borderWidth: ring ? 2 : 1,
        borderStyle: player ? 'solid' : 'dashed',
        borderColor: ring ?? colors.anstoss.fieldBorder,
        transform: [{ scale: over && !reduce ? 1.05 : 1 }],
      }}
    >
      {player ? (
        <>
          <Disc size={32} number={player.number} />
          <Text
            numberOfLines={1}
            verbatim
            style={{ fontSize: 10, color: colors.onSurfaceMuted, maxWidth: 56 }}
          >
            {player.last}
          </Text>
          <Dot player={player} top={3} right={8} />
        </>
      ) : (
        <T
          variant="section"
          style={{ fontSize: 11, letterSpacing: 1 }}
          color={colors.anstoss.textTertiary}
        >
          FREI
        </T>
      )}
    </Pressable>
  );
  return (
    <DropZone id={`b:${index}`}>
      {player ? (
        <Draggable
          inStrip
          data={{
            src: `b:${index}`,
            personId: player.id,
            number: String(player.number ?? '–'),
            name: player.last,
          }}
        >
          {tile}
        </Draggable>
      ) : (
        tile
      )}
    </DropZone>
  );
}

// ── Kaderleiste ───────────────────────────────────────────────────────────────

export function AttendanceBars({
  attendance,
  height = 16,
}: {
  attendance: LineupAttendance;
  height?: number;
}) {
  const { colors } = useTheme();
  const levelColor = useLevelColor();
  const color = levelColor(attendanceLevel(attendance.percent));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height }} aria-hidden>
      {attendance.weeks.map((w, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: Math.max(3, w.total ? Math.round((w.attended / w.total) * height) : 3),
            borderRadius: 2,
            backgroundColor: w.total ? color : withAlpha(colors.anstoss.textTertiary, 0.6),
          }}
        />
      ))}
    </View>
  );
}

export function SquadCard({
  player,
  disabled,
  selected,
  onPress,
}: {
  player: PlannerPlayer;
  disabled?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const card = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      accessibilityLabel={
        disabled
          ? `${playerLabel(player)}, ${t('nicht verfügbar')}${player.reason ? `: ${player.reason}` : ''}`
          : playerLabel(player)
      }
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 88,
        borderRadius: 16,
        paddingTop: 6,
        paddingBottom: 6,
        paddingHorizontal: 6,
        alignItems: 'center',
        gap: 3,
        backgroundColor: selected
          ? withAlpha(colors.status.action.solid, 0.14)
          : colors.anstoss.card,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.status.action.solid : colors.anstoss.cardBorder,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {player.abbr ? (
        <Text
          verbatim
          style={{
            position: 'absolute',
            top: 6,
            left: 7,
            fontSize: 10,
            fontWeight: '700',
            color: colors.anstoss.textTertiary,
          }}
        >
          {player.abbr}
        </Text>
      ) : null}
      <Disc size={34} number={player.number} />
      <Text
        numberOfLines={1}
        verbatim
        style={{ fontSize: 11.5, fontWeight: '700', color: colors.onSurface, maxWidth: 80 }}
      >
        {player.last}
      </Text>
      {player.attendance ? (
        <>
          <AttendanceBars attendance={player.attendance} height={12} />
          <Text verbatim style={{ fontSize: 10, fontWeight: '700', color: colors.onSurfaceMuted }}>
            {percentText(player)}
          </Text>
        </>
      ) : null}
      {disabled && player.reason ? (
        <Text
          numberOfLines={1}
          style={{ fontSize: 9.5, fontWeight: '700', color: colors.status.urgent.onContainer }}
        >
          {player.reason}
        </Text>
      ) : player.status === 'maybe' ? (
        <Text style={{ fontSize: 9.5, fontWeight: '700', color: colors.status.action.solid }}>
          Unsicher
        </Text>
      ) : player.status === 'pending' ? (
        <Text style={{ fontSize: 9.5, fontWeight: '700', color: colors.onSurfaceMuted }}>
          Offen
        </Text>
      ) : null}
    </Pressable>
  );
  if (disabled) return card;
  const data: DragData = {
    src: 'pool',
    personId: player.id,
    number: String(player.number ?? '–'),
    name: player.last,
  };
  return (
    <Draggable inStrip data={data}>
      {card}
    </Draggable>
  );
}

/** Ziehfigur: Scheibe mit Nummer, Akzentring, Nachname. */
export function Ghost({ drag }: { drag: DragData }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          borderWidth: 3,
          borderColor: colors.primary,
        }}
      >
        <T variant="figure" verbatim color="#0B120E" style={{ fontSize: 24, lineHeight: 26 }}>
          {drag.number}
        </T>
      </View>
      <NamePlate name={drag.name} />
    </View>
  );
}
