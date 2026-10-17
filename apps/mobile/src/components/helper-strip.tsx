import type { HelperEvent } from '@clubroof/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DateTile, T } from '@/components/ui';
import { clubDayMinutes, formatDateTile, todayIso } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

const GAP = 10;
const SIDE = 22;

/** Kalendertage bis zum Beginn (Vereinszeit), 0 = heute */
const daysTo = (iso: string) =>
  Math.max(
    0,
    Math.round(
      (Date.parse(`${clubDayMinutes(iso).day}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) /
        86_400_000,
    ),
  );

/**
 * Wischleiste „Helfer gesucht“ auf der Vereinsseite (Paket TH): kompakte Karten, Einrasten, Pager-Punkte ab zwei
 * Karten, kein automatischer Wechsel. Antippen öffnet die Helfer-Seite der Veranstaltung.
 */
export function HelperStrip({ items }: { items: HelperEvent[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const open = items
    .filter((h) => h.openSpots > 0 && new Date(h.event.startsAt) > new Date())
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt))
    .slice(0, 6);
  if (open.length === 0) return null;
  const card = Math.min(width - SIDE * 2, 320);
  const step = card + GAP;
  const tint = colors.anstoss.categories.team;
  return (
    <>
      <View
        style={{ gap: 10, marginHorizontal: -SIDE }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={step}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SIDE, gap: GAP }}
            scrollEventThrottle={32}
            onScroll={(e) =>
              setIndex(
                Math.max(
                  0,
                  Math.min(open.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)),
                ),
              )
            }
          >
            {open.map((h) => {
              const tile = formatDateTile(h.event.startsAt);
              const days = daysTo(h.event.startsAt);
              const when =
                days === 0 ? t('heute') : days === 1 ? t('morgen') : t(`in ${days} Tagen`);
              const missing =
                h.openSpots === 1 ? t('1 Helfer fehlt') : t(`${h.openSpots} Helfer fehlen`);
              return (
                <Pressable
                  key={h.event.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${h.event.title}, ${when}, ${missing}`}
                  onPress={() => router.push(`/helpers?event=${h.event.id}`)}
                  style={{
                    width: card,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <DateTile weekday={tile.weekday} day={tile.day} color={tint} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="heading" numberOfLines={1} verbatim>
                      {h.event.title}
                    </T>
                    <T variant="caption" numberOfLines={1}>
                      {when}
                    </T>
                    <T variant="label" color={colors.primaryText}>
                      {missing}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {open.length >= 2 ? (
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            accessibilityLabel={t(`Karte ${index + 1} von ${open.length}`)}
          >
            {open.map((h, i) => (
              <View
                key={h.event.id}
                style={{
                  width: i === index ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === index ? colors.primary : colors.anstoss.textTertiary,
                  opacity: i === index ? 1 : 0.5,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </>
  );
}
