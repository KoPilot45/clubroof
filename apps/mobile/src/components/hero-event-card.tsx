/**
 * Inhalt der Hero-Karte eines Termins (Paket DESIGN-HELL-TERMINKARTE-HERO, Variante C): Marke und Mannschaft, Ring-Countdown,
 * Kopf wie in der Terminkarte (antippbar), Chip zur eigenen Antwort, Verteilung und Zählerleiste, Fußzeile mit Seitenpunkten
 * und Knopf. Gemeinsam für das Start-Plakat und „Als nächstes“ in den Terminen; die Karte (`HeroCard`) setzt der Aufrufer.
 */
import type { EventSummary } from '@clubroof/core';
import { Ionicons } from '@/components/icon';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/app-text';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { CountdownRing } from './countdown-ring';
import { HeroAnswer } from './event-answer';
import { EventMeta, TypeDateTile, TypeMark } from './event-card-parts';
import { T, withAlpha } from './ui';

export function HeroEventBody({
  event,
  index = 0,
  count = 1,
}: {
  event: EventSummary;
  index?: number;
  count?: number;
}) {
  const { colors } = useTheme();
  const on = colors.hero.onHero;
  const soft = withAlpha(on, 0.82);
  const childName =
    event.myResponses.length === 1 && event.myResponses[0]?.relation === 'child'
      ? event.myResponses[0].firstName
      : null;
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <TypeMark type={event.type} onHero />
          {event.team ? (
            <T
              variant="caption"
              color={soft}
              verbatim
              numberOfLines={1}
              style={{ fontWeight: '700' }}
            >
              {event.team.name}
            </T>
          ) : null}
        </View>
        <CountdownRing startsAt={event.startsAt} endsAt={event.endsAt} />
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={event.title}
        onPress={() => router.push(`/events/${event.id}`)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}
      >
        <TypeDateTile event={event} onHero />
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <T
            variant="headline"
            color={on}
            numberOfLines={3}
            style={{ fontSize: 22, lineHeight: 24 }}
            verbatim
          >
            {event.title}
          </T>
          <EventMeta event={event} childName={childName} onHero lines={2} />
        </View>
        <Ionicons name="chevron-forward" size={22} color={on} style={{ marginTop: 14 }} />
      </Pressable>
      <HeroAnswer event={event} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View testID="poster-dots" accessible={false} style={{ flexDirection: 'row', gap: 6 }}>
          {count > 1
            ? Array.from({ length: count }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === index ? 26 : 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: i === index ? on : colors.hero.track,
                  }}
                />
              ))
            : null}
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t(event.match ? 'Spiel ansehen' : 'Termin ansehen')}
          onPress={() => router.push(`/events/${event.id}`)}
          style={{
            minHeight: 40,
            justifyContent: 'center',
            borderRadius: 999,
            paddingHorizontal: 16,
            backgroundColor: on,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.hero.to }}>
            {`${t(event.match ? 'Spiel ansehen' : 'Termin ansehen')} ›`}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
