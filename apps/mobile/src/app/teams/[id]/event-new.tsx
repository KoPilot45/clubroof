import { at, fromIsoDate, type EventDetail, type Facility } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Screen,
  TextField,
  TimeStepper,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

type Type = 'training' | 'match' | 'team_event';

const DEFAULTS: Record<Type, { time: string; minutes: string }> = {
  training: { time: '18:00', minutes: '90' },
  match: { time: '15:00', minutes: '105' },
  team_event: { time: '19:00', minutes: '120' },
};

export default function NewEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const team = me.teams.find((t) => t.id === id);
  const facilities = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api<Facility[]>('/facilities'),
  });

  const [type, setType] = useState<Type>('training');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState(DEFAULTS.training.time);
  const [minutes, setMinutes] = useState(DEFAULTS.training.minutes);
  const [meetingBefore, setMeetingBefore] = useState('15');
  const [placeChoice, setPlace] = useState<string | null>(null);
  const [locationText, setLocationText] = useState('');
  const [opponent, setOpponent] = useState('');
  const [home, setHome] = useState<'home' | 'away'>('home');
  const [title, setTitle] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('Kabine Vereinsheim');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [repeat, setRepeat] = useState('1');

  const place = placeChoice ?? facilities.data?.[0]?.id ?? 'other';
  const startsAt = at(fromIsoDate(date), time, me.club.timezone);
  const endsAt = new Date(startsAt.getTime() + Number(minutes) * 60_000);
  const meetingAt =
    meetingBefore === '0' ? null : new Date(startsAt.getTime() - Number(meetingBefore) * 60_000);
  const isAway = type === 'match' && home === 'away';

  const save = useMutation({
    mutationFn: (allowConflict: boolean) =>
      api<EventDetail>(`/teams/${id}/events`, {
        method: 'POST',
        body: {
          type,
          title: type === 'team_event' ? title.trim() : null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          meetingAt: meetingAt?.toISOString() ?? null,
          meetingPoint: meetingAt ? meetingPoint.trim() || null : null,
          facilityId: !isAway && place !== 'other' ? place : null,
          locationText: isAway || place === 'other' ? locationText.trim() || null : null,
          description: description.trim() || null,
          opponentName: type === 'match' ? opponent.trim() : null,
          isHome: type === 'match' ? home === 'home' : null,
          allowConflict,
          repeatWeeks: type === 'match' ? 1 : Number(repeat),
        },
      }),
    onSuccess: (event) => {
      for (const key of ['events', 'team', 'home'])
        void queryClient.invalidateQueries({ queryKey: [key] });
      router.replace(`/events/${event.id}`);
    },
    onError: (e) => {
      setConflict(e instanceof RequestError && e.code === 'facility_conflict');
      setError(e instanceof RequestError ? e.message : 'Der Termin konnte nicht angelegt werden.');
    },
  });

  const validation =
    type === 'match' && !opponent.trim()
      ? 'Bitte gib den Gegner an.'
      : type === 'team_event' && !title.trim()
        ? 'Bitte gib einen Titel an.'
        : startsAt < new Date()
          ? 'Der Beginn liegt in der Vergangenheit.'
          : null;

  return (
    <Screen edges={[]}>
      <Card>
        <ChoiceChips
          label={`Neuer Termin für ${team?.name ?? 'die Mannschaft'}`}
          options={[
            { value: 'training', label: 'Training', icon: 'fitness-outline' },
            { value: 'match', label: 'Spiel', icon: 'football-outline' },
            { value: 'team_event', label: 'Teamevent', icon: 'people-outline' },
          ]}
          selected={[type]}
          onToggle={(v: Type) => {
            setType(v);
            setTime(DEFAULTS[v].time);
            setMinutes(DEFAULTS[v].minutes);
          }}
        />
      </Card>

      {type === 'match' ? (
        <Card style={{ gap: 12 }}>
          <TextField
            label="Gegner"
            value={opponent}
            onChangeText={setOpponent}
            placeholder="z. B. TSV Blauen"
            maxLength={80}
          />
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
      {type === 'team_event' ? (
        <Card>
          <TextField
            label="Titel"
            value={title}
            onChangeText={setTitle}
            placeholder="z. B. Mannschaftsabend"
            maxLength={120}
          />
        </Card>
      ) : null}

      <Card style={{ gap: 14 }}>
        <DateStepper label="Datum" value={date} min={todayIso()} onChange={setDate} />
        <TimeStepper label="Beginn" value={time} onChange={setTime} />
        <ChoiceChips
          label="Dauer"
          options={['60', '75', '90', '105', '120'].map((m) => ({ value: m, label: `${m} Min.` }))}
          selected={[minutes]}
          onToggle={setMinutes}
        />
        {type !== 'match' ? (
          <ChoiceChips
            label="Wiederholen"
            options={[
              { value: '1', label: 'Einmalig' },
              { value: '4', label: '4 Wochen' },
              { value: '8', label: '8 Wochen' },
              { value: '12', label: '12 Wochen' },
              { value: '26', label: '26 Wochen' },
            ]}
            selected={[repeat]}
            onToggle={setRepeat}
          />
        ) : null}
        <ChoiceChips
          label="Treffpunkt vorher"
          options={[
            { value: '0', label: 'Keiner' },
            { value: '15', label: '15 Min.' },
            { value: '30', label: '30 Min.' },
            { value: '60', label: '60 Min.' },
            { value: '90', label: '90 Min.' },
          ]}
          selected={[meetingBefore]}
          onToggle={setMeetingBefore}
        />
        {meetingAt ? (
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
              ...(facilities.data ?? []).map((f) => ({
                value: f.id,
                label: f.shortName ?? f.name,
              })),
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
            placeholder={isAway ? 'z. B. Sportplatz Blauen' : 'z. B. Stadtpark'}
            maxLength={160}
          />
        ) : null}
        <TextField
          label="Info für die Mannschaft (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="z. B. Bitte schwarze Stutzen mitbringen"
          maxLength={1000}
          multiline
        />
      </Card>

      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {conflict ? (
        <Button
          label="Trotzdem anlegen"
          variant="outline"
          icon="warning"
          loading={save.isPending}
          onPress={() => save.mutate(true)}
        />
      ) : null}
      {validation ? <Chip tone="action" label={validation} /> : null}
      <Button
        label="Termin anlegen"
        icon="checkmark"
        disabled={!!validation}
        loading={save.isPending}
        onPress={() => save.mutate(false)}
      />
    </Screen>
  );
}
