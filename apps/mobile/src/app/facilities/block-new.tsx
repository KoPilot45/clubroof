import {
  at,
  calendarDayOf,
  fromIsoDate,
  toIsoDate,
  type FacilityOccupancy,
  type UpdateFacilityBlockInput,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
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
import { useLeaveGuard } from '@/components/edited';
import { RequestError } from '@/lib/api';
import { formatTime, todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

export default function NewBlockScreen() {
  const { api, me } = useSignedIn();
  // Bearbeiten: dasselbe Formular, vorausgefüllt aus der gewählten Sperrung
  const params = useLocalSearchParams<{
    id?: string;
    facilityId?: string;
    startsAt?: string;
    endsAt?: string;
    reason?: string;
  }>();
  const editing = !!params.id;
  const preset = (() => {
    if (!editing || !params.startsAt || !params.endsAt) return null;
    const start = new Date(params.startsAt);
    const end = new Date(params.endsAt);
    const from = formatTime(params.startsAt);
    const to = formatTime(params.endsAt);
    return {
      date: toIsoDate(calendarDayOf(start, me.club.timezone)),
      allDay: from === '00:00' && to === '00:00' && end.getTime() - start.getTime() >= 86_400_000,
      from,
      to: to === '00:00' ? '23:59' : to,
    };
  })();
  const queryClient = useQueryClient();
  const today = todayIso();
  const list = useQuery({
    queryKey: ['facilities', today, today],
    queryFn: () => api<FacilityOccupancy>(`/facilities/occupancy?from=${today}&to=${today}`),
  });
  const [facilityId, setFacilityId] = useState<string | null>(params.facilityId ?? null);
  const [date, setDate] = useState(preset?.date ?? today);
  const [allDay, setAllDay] = useState<'yes' | 'no'>(preset && !preset.allDay ? 'no' : 'yes');
  const [from, setFrom] = useState(preset?.from ?? '08:00');
  const [to, setTo] = useState(preset?.to ?? '18:00');
  const [reason, setReason] = useState(params.reason ?? '');
  const [cancel, setCancel] = useState<'yes' | 'no'>(editing ? 'no' : 'yes');
  const [saved, setSaved] = useState(false);
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
      api<FacilityOccupancy>(editing ? `/facilities/blocks/${params.id}` : '/facilities/blocks', {
        method: editing ? 'PATCH' : 'POST',
        body: {
          facilityId: facility!,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          reason: reason.trim(),
          cancelEvents: cancel === 'yes',
        } satisfies UpdateFacilityBlockInput,
      }),
    onSuccess: () => {
      allowLeave();
      setSaved(true);
      for (const key of ['facilities', 'events', 'home', 'team'])
        void queryClient.invalidateQueries({ queryKey: [key] });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError
          ? e.message
          : editing
            ? 'Die Änderungen konnten nicht gespeichert werden.'
            : 'Die Sperrung konnte nicht angelegt werden.',
      ),
  });
  const dirty =
    editing &&
    !saved &&
    (facility !== params.facilityId ||
      startsAt.toISOString() !== new Date(params.startsAt ?? 0).toISOString() ||
      endsAt.toISOString() !== new Date(params.endsAt ?? 0).toISOString() ||
      reason !== (params.reason ?? ''));
  const { guard, allowLeave } = useLeaveGuard(dirty, () => save.mutate());

  if (list.isPending) return <Loading />;
  const valid = !!facility && reason.trim().length >= 2 && endsAt > startsAt;

  return (
    <Screen
      edges={[]}
      footer={
        <>
          {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
          <Button
            label={editing ? 'Änderungen speichern' : 'Sperrung anlegen'}
            icon={editing ? 'checkmark' : 'lock-closed'}
            disabled={!valid}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </>
      }
    >
      {guard}
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          label="Platz"
          options={facilities.map((f) => ({ value: f.facility.id, label: f.facility.name }))}
          selected={facility ? [facility] : []}
          onToggle={setFacilityId}
        />
        <DateStepper
          label="Datum"
          value={date}
          min={editing ? undefined : today}
          onChange={setDate}
        />
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
          placeholder={t('z. B. Platzpflege')}
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
    </Screen>
  );
}
