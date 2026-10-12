/**
 * Datumsauswahl mit Kalender (Paket DP): Monatsraster, Wischen zwischen Monaten, „Heute“,
 * Mindest- und Höchstdatum. Wird vom `DateStepper` geöffnet, wenn man auf das Datum tippt.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { hapticSelect } from '@/lib/haptics';
import { todayIso } from '@/lib/format';
import { dateFormat, t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Text } from './app-text';
import { Button, Sheet, T } from './ui';

const monthTitle = dateFormat({ month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekday = dateFormat({ weekday: 'short', timeZone: 'UTC' });
const dayNumber = dateFormat({ day: 'numeric', timeZone: 'UTC' });
const longDay = dateFormat({
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const utc = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

/** Zellen eines Monats, Woche beginnt am Montag; `null` = leere Zelle. */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(iso(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarSheet({
  visible,
  value,
  min,
  max,
  title,
  onSelect,
  onClose,
}: {
  visible: boolean;
  /** ISO-Datum JJJJ-MM-TT */
  value: string;
  min?: string;
  max?: string;
  title: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const { colors, radii } = useTheme();
  const start = utc(value);
  const [cursor, setCursor] = useState({ y: start.getUTCFullYear(), m: start.getUTCMonth() });
  // Beim Öffnen auf den Monat des aktuellen Werts springen
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setCursor({ y: start.getUTCFullYear(), m: start.getUTCMonth() });
  } else if (!visible && wasVisible) setWasVisible(false);

  const today = todayIso();
  const inRange = (d: string) => (!min || d >= min) && (!max || d <= max);
  const monthStart = iso(cursor.y, cursor.m, 1);
  const monthEnd = iso(
    cursor.y,
    cursor.m,
    new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate(),
  );
  const canPrev = !min || monthStart > min;
  const canNext = !max || monthEnd < max;
  const step = (delta: number) =>
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  // Wischen zwischen Monaten (nach links = nächster Monat)
  const latest = useRef({ canPrev, canNext });
  latest.current = { canPrev, canNext };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -50 && latest.current.canNext) step(1);
          else if (g.dx > 50 && latest.current.canPrev) step(-1);
        },
      }),
    [],
  );

  const cells = monthCells(cursor.y, cursor.m);
  const monday = Date.UTC(2026, 0, 5);
  const arrow = (
    icon: 'chevron-back' | 'chevron-forward',
    enabled: boolean,
    label: string,
    delta: number,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!enabled}
      onPress={() => step(delta)}
      hitSlop={6}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: enabled ? 1 : 0.3,
        backgroundColor: colors.surfaceVariant,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.onSurface} />
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {arrow('chevron-back', canPrev, t('Vorheriger Monat'), -1)}
        <T variant="headline" style={{ fontSize: 20, lineHeight: 24 }} accessibilityRole="header">
          {monthTitle.format(new Date(Date.UTC(cursor.y, cursor.m, 1)))}
        </T>
        {arrow('chevron-forward', canNext, t('Nächster Monat'), 1)}
      </View>
      <View {...pan.panHandlers} style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row' }}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
              <T variant="caption" verbatim>
                {weekday.format(new Date(monday + i * 86_400_000))}
              </T>
            </View>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row' }}>
            {cells.slice(row * 7, row * 7 + 7).map((d, col) => {
              if (!d) return <View key={col} style={{ flex: 1, height: 44 }} />;
              const selected = d === value;
              const enabled = inRange(d);
              return (
                <View key={col} style={{ flex: 1, alignItems: 'center' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !enabled }}
                    accessibilityLabel={longDay.format(utc(d))}
                    disabled={!enabled}
                    onPress={() => {
                      hapticSelect();
                      onSelect(d);
                      onClose();
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: enabled ? 1 : 0.3,
                      // heutiger Tag in Vereinsfarbe wie in allen Kalendern der App
                      backgroundColor: selected
                        ? colors.primary
                        : d === today
                          ? colors.primaryContainer
                          : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: selected || d === today ? '700' : '400',
                        color: selected
                          ? colors.onPrimary
                          : d === today
                            ? colors.onPrimaryContainer
                            : colors.onSurface,
                      }}
                    >
                      {dayNumber.format(utc(d))}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          style={{ flex: 1 }}
          label="Heute"
          variant="outline"
          disabled={!inRange(today)}
          onPress={() => {
            onSelect(today);
            onClose();
          }}
        />
        <Button style={{ flex: 1 }} label="Schließen" variant="tonal" onPress={onClose} />
      </View>
    </Sheet>
  );
}
