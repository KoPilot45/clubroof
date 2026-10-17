import type { EventSummary } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { T } from '@/components/ui';
import { kindOf } from '@/lib/event-types';
import { formatShortDate } from '@/lib/format';
import { useTeamColorOf } from '@/lib/team-colors';
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
  variant = 'dots',
  onToday,
}: {
  /** Erster Tag des Monats (lokal) */
  month: Date;
  events: EventSummary[];
  selected: string | null;
  onSelect: (day: string) => void;
  onMonth: (delta: number) => void;
  /** Farbe je Termin (z. B. nach Terminart); ohne Angabe: Vereinstermine in Vereinsfarbe */
  colorOf?: (event: EventSummary) => string;
  /** `grid`: höhere Felder mit Kürzel-Chips der Termine (Paket KM); `dots`: Punkte */
  variant?: 'dots' | 'grid';
  /** zeigt den Knopf „Heute“ (springt in den heutigen Monat und wählt den Tag) */
  onToday?: () => void;
}) {
  const { colors, sizes } = useTheme();
  const teamColorOf = useTeamColorOf();
  // Runde Monatsknöpfe (44) wie die Kopfzeilenknöpfe
  const navButton = {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: sizes.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
  } as const;
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
          style={navButton}
        >
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <T variant="headline" style={{ fontSize: 20 }}>
          {monthLabel.format(month)}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Nächster Monat')}
          onPress={() => onMonth(1)}
          style={navButton}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
        </Pressable>
      </View>
      {onToday ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Heute')}
          onPress={onToday}
          style={{
            alignSelf: 'center',
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 16,
            borderRadius: 22,
            backgroundColor: colors.primaryContainer,
          }}
        >
          <T variant="label" color={colors.onPrimaryContainer}>
            Heute
          </T>
        </Pressable>
      ) : null}
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
            if (!d) return <View key={i} style={{ flex: 1, height: 44 }} />;
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            const active = k === selected;
            if (variant === 'grid')
              return (
                <GridCell
                  key={k}
                  date={d}
                  list={list}
                  active={active}
                  today={k === today}
                  onPress={() => onSelect(k)}
                />
              );
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`${d.getDate()}. ${list.length ? `${list.length} Termine` : 'keine Termine'}`}
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(k)}
                style={{
                  flex: 1,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  borderRadius: 14,
                  backgroundColor: active
                    ? colors.primary
                    : k === today
                      ? colors.primaryContainer
                      : 'transparent',
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
                        e.status === 'cancelled'
                          ? colors.status.urgent.solid
                          : colorOf
                            ? colorOf(e)
                            : (teamColorOf(e.team?.id) ??
                              (e.team === null ? colors.primaryText : colors.onSurfaceMuted)),
                      ),
                    ),
                  ]
                    .slice(0, 3)
                    .map((c) => (
                      <View
                        key={c}
                        style={{
                          width: 5,
                          height: 5,
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

type ChipStyle = { bg: string; fg: string; border: string; bold: boolean; dashed: boolean };

/** Darstellung eines Termins im Raster: Spiel kräftig grün, Training hellblau, Verein hellorange. */
export function gridChipStyle(
  e: Pick<EventSummary, 'type' | 'team' | 'status'>,
  colors: ReturnType<typeof useTheme>['colors'],
): ChipStyle {
  const kind = kindOf(e);
  const base: ChipStyle =
    kind === 'match' || kind === 'tournament'
      ? {
          bg: colors.status.success.solid,
          fg: colors.status.success.onSolid,
          border: colors.status.success.solid,
          bold: true,
          dashed: false,
        }
      : kind === 'training'
        ? {
            bg: colors.tints.blue.container,
            fg: colors.tints.blue.onContainer,
            border: colors.tints.blue.container,
            bold: false,
            dashed: false,
          }
        : {
            bg: colors.tints.orange.container,
            fg: colors.tints.orange.onContainer,
            border: colors.tints.orange.onContainer,
            bold: false,
            dashed: true,
          };
  // Abgesagt: rot umrandet (Schrift durchgestrichen im Chip)
  return e.status === 'cancelled'
    ? {
        ...base,
        bg: colors.surface,
        fg: colors.status.urgent.onContainer,
        border: colors.status.urgent.solid,
        dashed: false,
      }
    : base;
}

/** Kürzel im Chip: Mannschaftskürzel, bei Vereinsterminen „V“. */
const chipLabel = (e: EventSummary) => e.team?.badge ?? 'V';

function GridCell({
  date,
  list,
  active,
  today,
  onPress,
}: {
  date: Date;
  list: EventSummary[];
  active: boolean;
  today: boolean;
  onPress: () => void;
}) {
  const { colors, radii } = useTheme();
  // Spiele zuerst, dann Training, dann Übriges
  const rank = (e: EventSummary) => {
    const k = kindOf(e);
    return k === 'match' || k === 'tournament' ? 0 : k === 'training' ? 1 : 2;
  };
  const sorted = [...list].sort((a, b) => rank(a) - rank(b));
  const shown = sorted.slice(0, 2);
  const more = sorted.length - shown.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatShortDate(dayKey(date))} ${
        list.length ? t(`${list.length} Termine`) : t('keine Termine')
      }`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 74,
        padding: 2,
        gap: 2,
        alignItems: 'center',
        borderRadius: radii.sm,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primaryContainer : colors.surface,
      }}
    >
      <View
        style={{
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          paddingHorizontal: 4,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: today ? colors.primary : 'transparent',
        }}
      >
        <T
          variant="caption"
          color={today ? colors.onPrimary : colors.onSurface}
          style={{ fontWeight: today ? '800' : '600' }}
          verbatim
        >
          {date.getDate()}
        </T>
      </View>
      {shown.map((e) => {
        const c = gridChipStyle(e, colors);
        return (
          <View
            key={e.id}
            style={{
              alignSelf: 'stretch',
              alignItems: 'center',
              borderRadius: 6,
              paddingVertical: 1,
              backgroundColor: c.bg,
              borderWidth: 1,
              borderColor: c.border,
              borderStyle: c.dashed ? 'dashed' : 'solid',
            }}
          >
            <T
              variant="caption"
              color={c.fg}
              numberOfLines={1}
              verbatim
              style={{
                fontSize: 11,
                fontWeight: c.bold ? '800' : '600',
                textDecorationLine: e.status === 'cancelled' ? 'line-through' : 'none',
              }}
            >
              {chipLabel(e)}
            </T>
          </View>
        );
      })}
      {more > 0 ? (
        <T variant="caption" color={colors.onSurfaceMuted} verbatim style={{ fontSize: 11 }}>
          {`+${more}`}
        </T>
      ) : null}
    </Pressable>
  );
}
