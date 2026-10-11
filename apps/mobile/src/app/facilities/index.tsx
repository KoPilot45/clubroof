import type { FacilityBooking, FacilityOccupancy } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { FacilityGrid, type GridColumn } from '@/components/facility-grid';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  ErrorNotice,
  Loading,
  Screen,
  Sheet,
  T,
} from '@/components/ui';
import { formatDateTile, formatShortDate, formatTime, todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

function weekOf(iso: string): { from: string; to: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  const mon = new Date(d.getTime() - offset * 86_400_000);
  const sun = new Date(mon.getTime() + 6 * 86_400_000);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

const addDays = (iso: string, days: number) =>
  new Date(new Date(`${iso}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

export default function FacilitiesScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ booking: FacilityBooking; place: string } | null>(
    null,
  );
  const range = mode === 'day' ? { from: date, to: date } : weekOf(date);

  const occupancy = useQuery({
    queryKey: ['facilities', range.from, range.to],
    queryFn: () =>
      api<FacilityOccupancy>(`/facilities/occupancy?from=${range.from}&to=${range.to}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/facilities/blocks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
  const o = occupancy.data;

  // Wochenwechsel per Wisch (nur Wochenansicht: dort gibt es kein waagerechtes Scrollen)
  const swipe = useRef<(dir: number) => void>(() => {});
  swipe.current = (dir) => setDate((d) => addDays(d, dir * 7));
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > 60) swipe.current(g.dx < 0 ? 1 : -1);
        },
      }),
    [],
  );

  const facility =
    o?.facilities.find((f) => f.facility.id === facilityId) ??
    o?.facilities.find((f) => f.bookings.length > 0) ??
    o?.facilities[0];

  const dayColumns: GridColumn[] =
    o?.facilities.map(({ facility: f, bookings }) => ({
      key: f.id,
      title: f.shortName ?? f.name,
      day: date,
      bookings,
    })) ?? [];
  const weekColumns: GridColumn[] = facility
    ? Array.from({ length: 7 }, (_, i) => {
        const day = addDays(range.from, i);
        const tile = formatDateTile(`${day}T12:00:00Z`);
        return {
          key: day,
          title: tile.weekday,
          subtitle: formatShortDate(day),
          day,
          bookings: facility.bookings,
        };
      })
    : [];

  const pressBooking = (booking: FacilityBooking, column: GridColumn) => {
    const place = mode === 'day' ? column.title : (facility?.facility.name ?? '');
    const full = o?.facilities.find((f) => f.bookings.some((b) => b.id === booking.id));
    setSelected({ booking, place: full?.facility.name ?? place });
  };
  const sel = selected?.booking;

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
        {mode === 'week' && o && o.facilities.length > 1 ? (
          <ChoiceChips
            options={o.facilities.map((f) => ({
              value: f.facility.id,
              label: f.facility.name,
            }))}
            selected={facility ? [facility.facility.id] : []}
            onToggle={setFacilityId}
          />
        ) : null}
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
        <ErrorNotice error={occupancy.error} onRetry={() => occupancy.refetch()} />
      ) : null}
      {o && o.conflicts > 0 ? (
        <Chip tone="action" icon="warning" label={`${o.conflicts} Belegungen überschneiden sich`} />
      ) : null}
      {o && mode === 'day' ? (
        o.facilities.length ? (
          <FacilityGrid columns={dayColumns} onPressBooking={pressBooking} />
        ) : (
          <T variant="body">Keine Plätze angelegt.</T>
        )
      ) : null}
      {o && mode === 'week' && facility ? (
        <View {...pan.panHandlers} style={{ gap: 12 }}>
          <T variant="heading" verbatim>
            {facility.facility.name}
          </T>
          <FacilityGrid
            columns={weekColumns.slice(0, 5)}
            onPressBooking={pressBooking}
            minColumnWidth={0}
          />
          <FacilityGrid
            columns={weekColumns.slice(5)}
            onPressBooking={pressBooking}
            tinted
            minColumnWidth={0}
          />
          <T variant="caption">Wischen wechselt die Woche.</T>
        </View>
      ) : null}
      <Sheet visible={!!sel} onClose={() => setSelected(null)} title={sel?.title}>
        {sel ? (
          <>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {sel.kind === 'block' ? (
                <Chip tone="urgent" icon="lock-closed" label="Gesperrt" />
              ) : null}
              {sel.teamBadge ? <Chip tone="primary" label={sel.teamBadge} /> : null}
              {sel.cancelled ? <Chip tone="neutral" label="Abgesagt" /> : null}
              {sel.conflict ? <Chip tone="action" icon="warning" label="Überschneidung" /> : null}
            </View>
            <T variant="body" verbatim>
              {`${selected?.place ?? ''} · ${formatTime(sel.startsAt)}–${formatTime(sel.endsAt)}`}
            </T>
            {sel.kind === 'event' ? (
              <Button
                label="Termin öffnen"
                onPress={() => {
                  setSelected(null);
                  router.push(`/events/${sel.id}`);
                }}
              />
            ) : null}
            {o?.canManage && sel.kind === 'event' ? (
              <Button
                label="Platz sperren"
                icon="lock-closed"
                variant="outline"
                onPress={() => {
                  setSelected(null);
                  router.push('/facilities/block-new');
                }}
              />
            ) : null}
            {o?.canManage && sel.kind === 'block' ? (
              <Button
                label="Sperrung aufheben"
                variant="outline"
                onPress={() => remove.mutate(sel.id)}
              />
            ) : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
