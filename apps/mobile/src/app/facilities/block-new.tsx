import { at, fromIsoDate, type FacilityOccupancy } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Loading,
  Screen,
  TextField,
  TimeStepper,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

export default function NewBlockScreen() {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const today = todayIso();
  const list = useQuery({
    queryKey: ['facilities', today, today],
    queryFn: () => api<FacilityOccupancy>(`/facilities/occupancy?from=${today}&to=${today}`),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [allDay, setAllDay] = useState<'yes' | 'no'>('yes');
  const [from, setFrom] = useState('08:00');
  const [to, setTo] = useState('18:00');
  const [reason, setReason] = useState('');
  const [cancel, setCancel] = useState<'yes' | 'no'>('yes');
  const [error, setError] = useState<string | null>(null);

  const facilities = list.data?.facilities ?? [];
  const facility = facilityId ?? facilities[0]?.facility.id ?? null;
  const day = fromIsoDate(date);
  const startsAt = at(day, allDay === 'yes' ? '00:00' : from, me.club.timezone);
  const endsAt =
    allDay === 'yes'
      ? at(new Date(day.getTime() + 86_400_000), '00:00', me.club.timezone)
      : at(day, to, me.club.timezone);

  const save = useMutation({
    mutationFn: () =>
      api<FacilityOccupancy>('/facilities/blocks', {
        method: 'POST',
        body: {
          facilityId: facility,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          reason: reason.trim(),
          cancelEvents: cancel === 'yes',
        },
      }),
    onSuccess: () => {
      for (const key of ['facilities', 'events', 'home', 'team'])
        void queryClient.invalidateQueries({ queryKey: [key] });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Sperrung konnte nicht angelegt werden.',
      ),
  });

  if (list.isPending) return <Loading />;
  const valid = !!facility && reason.trim().length >= 2 && endsAt > startsAt;

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          label="Platz"
          options={facilities.map((f) => ({ value: f.facility.id, label: f.facility.name }))}
          selected={facility ? [facility] : []}
          onToggle={setFacilityId}
        />
        <DateStepper label="Datum" value={date} min={today} onChange={setDate} />
        <ChoiceChips
          label="Zeitraum"
          options={[
            { value: 'yes', label: 'Ganztägig' },
            { value: 'no', label: 'Uhrzeit wählen' },
          ]}
          selected={[allDay]}
          onToggle={setAllDay}
        />
        {allDay === 'no' ? (
          <>
            <TimeStepper label="Von" value={from} onChange={setFrom} />
            <TimeStepper label="Bis" value={to} onChange={setTo} />
          </>
        ) : null}
      </Card>
      <Card style={{ gap: 12 }}>
        <TextField
          label="Grund"
          value={reason}
          onChangeText={setReason}
          placeholder="z. B. Platzpflege"
          maxLength={160}
        />
        <ChoiceChips
          label="Betroffene Termine"
          options={[
            { value: 'yes', label: 'Absagen und informieren' },
            { value: 'no', label: 'Nicht ändern' },
          ]}
          selected={[cancel]}
          onToggle={setCancel}
        />
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Sperrung anlegen"
        icon="lock-closed"
        disabled={!valid}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
