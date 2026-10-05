import type { FacilityBooking, FacilityOccupancy } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  T,
  TeamBadge,
} from '@/components/ui';
import { formatDay, formatTime, todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

function weekOf(iso: string): { from: string; to: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  const mon = new Date(d.getTime() - offset * 86_400_000);
  const sun = new Date(mon.getTime() + 6 * 86_400_000);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

function BookingRow({
  booking,
  first,
  onRemove,
}: {
  booking: FacilityBooking;
  first: boolean;
  onRemove?: () => void;
}) {
  const isBlock = booking.kind === 'block';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: first ? 0 : 10,
        opacity: booking.cancelled ? 0.6 : 1,
      }}
    >
      <View style={{ width: 92 }}>
        <T variant="label">
          {isBlock &&
          new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime() >=
            23 * 3_600_000
            ? 'Ganztägig'
            : `${formatTime(booking.startsAt)}–${formatTime(booking.endsAt)}`}
        </T>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {booking.teamBadge ? <TeamBadge badge={booking.teamBadge} /> : null}
          <T
            variant="body"
            numberOfLines={2}
            style={{
              flex: 1,
              textDecorationLine: booking.cancelled ? 'line-through' : 'none',
            }}
          >
            {booking.title}
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {isBlock ? <Chip tone="urgent" icon="lock-closed" label="Gesperrt" /> : null}
          {booking.cancelled ? <Chip tone="neutral" label="Abgesagt" /> : null}
          {booking.conflict ? <Chip tone="action" icon="warning" label="Überschneidung" /> : null}
        </View>
      </View>
      {isBlock && onRemove ? (
        <Button label="Aufheben" variant="outline" onPress={onRemove} />
      ) : null}
    </View>
  );
}

export default function FacilitiesScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const range = mode === 'day' ? { from: date, to: date } : weekOf(date);

  const occupancy = useQuery({
    queryKey: ['facilities', range.from, range.to],
    queryFn: () =>
      api<FacilityOccupancy>(`/facilities/occupancy?from=${range.from}&to=${range.to}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/facilities/blocks/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['facilities'] }),
  });
  const o = occupancy.data;

  return (
    <Screen
      edges={[]}
      refreshing={occupancy.isRefetching}
      onRefresh={() => {
        void occupancy.refetch();
      }}
    >
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          options={[
            { value: 'day', label: 'Tag' },
            { value: 'week', label: 'Woche' },
          ]}
          selected={[mode]}
          onToggle={setMode}
        />
        <DateStepper label={mode === 'day' ? 'Tag' : 'Woche mit'} value={date} onChange={setDate} />
      </Card>
      {o?.canManage ? (
        <Button
          label="Sperrung anlegen"
          icon="lock-closed"
          variant="outline"
          onPress={() => router.push('/facilities/block-new')}
        />
      ) : null}
      {occupancy.isPending ? <Loading /> : null}
      {occupancy.error ? (
        <ErrorNotice message={occupancy.error.message} onRetry={() => occupancy.refetch()} />
      ) : null}
      {o && o.conflicts > 0 ? (
        <Chip tone="action" icon="warning" label={`${o.conflicts} Belegungen überschneiden sich`} />
      ) : null}
      {o?.facilities.map(({ facility, bookings }) => {
        const days = [...new Set(bookings.map((b) => formatDay(b.startsAt)))];
        return (
          <Card key={facility.id} style={{ gap: 10 }}>
            <T variant="heading">{facility.name}</T>
            {bookings.length === 0 ? <Empty icon="checkmark-circle-outline" text="Frei." /> : null}
            {days.map((d) => (
              <View key={d}>
                {mode === 'week' ? (
                  <T variant="label" style={{ marginBottom: 6 }}>
                    {d}
                  </T>
                ) : null}
                {bookings
                  .filter((b) => formatDay(b.startsAt) === d)
                  .map((b, i) => (
                    <BookingRow
                      key={b.id}
                      booking={b}
                      first={i === 0}
                      onRemove={o.canManage ? () => remove.mutate(b.id) : undefined}
                    />
                  ))}
              </View>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}
