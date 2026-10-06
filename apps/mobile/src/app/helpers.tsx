import type { HelperEvent } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ShiftRow } from '@/components/helpers';
import { Card, Chip, Empty, ErrorNotice, Loading, Screen, T } from '@/components/ui';
import { formatLongDate, formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

export default function HelpersScreen() {
  const { api } = useSignedIn();
  const helpers = useQuery({
    queryKey: ['helpers'],
    queryFn: () => api<HelperEvent[]>('/helpers'),
  });
  return (
    <Screen edges={[]} refreshing={helpers.isRefetching} onRefresh={() => helpers.refetch()}>
      <T variant="caption">
        Ohne Ehrenamt läuft nichts. Trag dich in eine Schicht ein – das Organisationsteam sieht
        sofort, wo noch Hände fehlen.
      </T>
      {helpers.isPending ? <Loading /> : null}
      {helpers.error ? (
        <ErrorNotice error={helpers.error} onRetry={() => helpers.refetch()} />
      ) : null}
      {helpers.data?.length === 0 ? (
        <Empty icon="hand-left-outline" text="Aktuell werden keine Helfer gesucht." />
      ) : null}
      {helpers.data?.map((h) => (
        <Card key={h.event.id} style={{ gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/events/${h.event.id}`)}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <T variant="heading">{h.event.title}</T>
                <T variant="caption">
                  {formatLongDate(h.event.startsAt)}, {formatTime(h.event.startsAt)} Uhr
                  {h.event.location ? ` · ${h.event.location}` : ''}
                </T>
              </View>
              {h.openSpots > 0 ? (
                <Chip tone="action" label={`${h.openSpots} frei`} />
              ) : (
                <Chip tone="success" label="Alle Plätze besetzt" />
              )}
            </View>
          </Pressable>
          {h.shifts.map((shift, i) => (
            <ShiftRow key={shift.id} shift={shift} first={i === 0} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}
