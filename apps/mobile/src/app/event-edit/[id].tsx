import {
  at,
  fromIsoDate,
  type EventDetail,
  type Facility,
  type UpdateEventInput,
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
  ErrorNotice,
  Loading,
  Screen,
  TextField,
  TimeStepper,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

const isoDayIn = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
const hmIn = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('de-DE', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const event = useQuery({
    queryKey: ['event', id],
    queryFn: () => api<EventDetail>(`/events/${id}`),
  });
  const facilities = useQuery({
    queryKey: ['facilities-list'],
    queryFn: () => api<Facility[]>('/facilities'),
  });
  if (event.isPending || facilities.isPending) return <Loading />;
  if (event.error) return <ErrorNotice error={event.error} onRetry={() => event.refetch()} />;
  return <Form event={event.data} facilities={facilities.data ?? []} />;
}

function Form({ event, facilities }: { event: EventDetail; facilities: Facility[] }) {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const tz = me.club.timezone;
  const start = new Date(event.startsAt);
  const durationMin = event.endsAt
    ? Math.round((new Date(event.endsAt).getTime() - start.getTime()) / 60_000)
    : 90;
  const meetingBefore = event.meetingAt
    ? Math.round((start.getTime() - new Date(event.meetingAt).getTime()) / 60_000)
    : 0;

  const [date, setDate] = useState(isoDayIn(start, tz));
  const [time, setTime] = useState(hmIn(start, tz));
  const [minutes, setMinutes] = useState(String(durationMin));
  const [before, setBefore] = useState(String(meetingBefore));
  const [meetingPoint, setMeetingPoint] = useState(event.meetingPoint ?? '');
  const [place, setPlace] = useState(event.edit?.facilityId ?? 'other');
  const [locationText, setLocationText] = useState(event.edit?.locationText ?? '');
  const [description, setDescription] = useState(event.description ?? '');
  const [title, setTitle] = useState(event.title);
  const [opponent, setOpponent] = useState(event.match?.opponentName ?? '');
  const [home, setHome] = useState<'home' | 'away'>(
    event.match?.isHome === false ? 'away' : 'home',
  );
  const [scope, setScope] = useState<'single' | 'following'>('single');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const isMatch = event.type === 'match';
  const isAway = isMatch && home === 'away';
  const following = event.edit?.seriesFollowing ?? 0;

  const save = useMutation({
    mutationFn: (allowConflict: boolean) => {
      const startsAt = at(fromIsoDate(date), time, tz);
      const endsAt = new Date(startsAt.getTime() + Number(minutes) * 60_000);
      const body: UpdateEventInput = {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        meetingAt:
          before === '0'
            ? null
            : new Date(startsAt.getTime() - Number(before) * 60_000).toISOString(),
        meetingPoint: meetingPoint.trim() || null,
        facilityId: !isAway && place !== 'other' ? place : null,
        locationText: isAway || place === 'other' ? locationText.trim() || null : null,
        description: description.trim() || null,
        scope,
        allowConflict,
        ...(event.type === 'team_event' ? { title: title.trim() } : {}),
        ...(isMatch ? { opponentName: opponent.trim(), isHome: home === 'home' } : {}),
      };
      return api<EventDetail>(`/events/${event.id}`, { method: 'PATCH', body });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['event', event.id], data);
      for (const key of ['events', 'team', 'home', 'facilities'])
        void queryClient.invalidateQueries({ queryKey: [key] });
      router.back();
    },
    onError: (e) => {
      setConflict(e instanceof RequestError && e.code === 'facility_conflict');
      setError(
        e instanceof RequestError ? e.message : 'Die Änderung konnte nicht gespeichert werden.',
      );
    },
  });

  const invalid = (isMatch && !opponent.trim()) || (event.type === 'team_event' && !title.trim());

  return (
    <Screen edges={[]}>
      {event.type === 'team_event' ? (
        <Card>
          <TextField label="Titel" value={title} onChangeText={setTitle} maxLength={120} />
        </Card>
      ) : null}
      {isMatch ? (
        <Card style={{ gap: 12 }}>
          <TextField label="Gegner" value={opponent} onChangeText={setOpponent} maxLength={80} />
          <ChoiceChips
            options={[
              { value: 'home', label: 'Heimspiel' },
              { value: 'away', label: 'Auswärtsspiel' },
            ]}
            selected={[home]}
            onToggle={setHome}
          />
        </Card>
      ) : null}
      <Card style={{ gap: 14 }}>
        <DateStepper label="Datum" value={date} onChange={setDate} />
        <TimeStepper label="Beginn" value={time} onChange={setTime} />
        <ChoiceChips
          label="Dauer"
          options={['60', '75', '90', '105', '120'].map((m) => ({ value: m, label: `${m} Min.` }))}
          selected={[minutes]}
          onToggle={setMinutes}
        />
        <ChoiceChips
          label="Treffpunkt vorher"
          options={['0', '15', '30', '60', '90'].map((m) => ({
            value: m,
            label: m === '0' ? 'Keiner' : `${m} Min.`,
          }))}
          selected={[before]}
          onToggle={setBefore}
        />
        {before !== '0' ? (
          <TextField
            label="Treffpunkt"
            value={meetingPoint}
            onChangeText={setMeetingPoint}
            maxLength={120}
          />
        ) : null}
      </Card>
      <Card style={{ gap: 12 }}>
        {!isAway ? (
          <ChoiceChips
            label="Ort"
            options={[
              ...facilities.map((f) => ({ value: f.id, label: f.shortName ?? f.name })),
              { value: 'other', label: 'Anderer Ort' },
            ]}
            selected={[place]}
            onToggle={setPlace}
          />
        ) : null}
        {isAway || place === 'other' ? (
          <TextField
            label={isAway ? 'Spielort' : 'Ort'}
            value={locationText}
            onChangeText={setLocationText}
            maxLength={160}
          />
        ) : null}
        <TextField
          label="Info für die Mannschaft"
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
          multiline
        />
      </Card>
      {following > 0 ? (
        <Card>
          <ChoiceChips
            label="Dieser Termin gehört zu einer Serie"
            options={[
              { value: 'single', label: 'Nur diesen Termin' },
              { value: 'following', label: `Diesen und ${following} folgende` },
            ]}
            selected={[scope]}
            onToggle={setScope}
          />
        </Card>
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {conflict ? (
        <Button
          label="Trotzdem speichern"
          variant="outline"
          icon="warning"
          loading={save.isPending}
          onPress={() => save.mutate(true)}
        />
      ) : null}
      <Button
        label="Änderung speichern und informieren"
        icon="checkmark"
        disabled={invalid}
        loading={save.isPending}
        onPress={() => save.mutate(false)}
      />
    </Screen>
  );
}
