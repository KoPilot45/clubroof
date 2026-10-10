import {
  addDays,
  at,
  fromIsoDate,
  toIsoDate,
  type EventDetail,
  type Facility,
  type MatchKind,
  type TeamManage,
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
  Screen,
  T,
  TextField,
  TimeStepper,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';
import { MapLinkField } from '@/components/map-link-field';

type Type = 'training' | 'match' | 'team_event';

const MATCH_KIND_OPTIONS: { value: MatchKind; label: string }[] = [
  { value: 'league', label: 'Liga' },
  { value: 'cup', label: 'Pokal' },
  { value: 'friendly', label: 'Testspiel' },
];

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

  // Treffpunkt-Regeln der Mannschaft (nur für das Trainerteam abrufbar)
  const rules = useQuery({
    queryKey: ['team-manage', id],
    queryFn: () => api<TeamManage>(`/teams/${id}/manage`),
    retry: false,
  });

  const [type, setType] = useState<Type>('training');
  const [kind, setKind] = useState<MatchKind>('league');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState(DEFAULTS.training.time);
  const [minutes, setMinutes] = useState(DEFAULTS.training.minutes);
  // `rule` = Regel der Mannschaft (Standard), sonst Minuten vorher oder `0` = kein Treffen
  const [meetingChoice, setMeetingChoice] = useState<string | null>(null);
  const [placeChoice, setPlace] = useState<string | null>(null);
  const [locationText, setLocationText] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [opponent, setOpponent] = useState('');
  const [home, setHome] = useState<'home' | 'away'>('home');
  const [title, setTitle] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [repeat, setRepeat] = useState<'once' | 'weekly'>('once');
  const [repeatUntil, setRepeatUntil] = useState<string | null>(null);

  const place = placeChoice ?? facilities.data?.[0]?.id ?? 'other';
  const startsAt = at(fromIsoDate(date), time, me.club.timezone);
  const endsAt = new Date(startsAt.getTime() + Number(minutes) * 60_000);
  const ruleMinutes =
    type === 'match'
      ? rules.data?.profile.matchMeetingMinutes
      : type === 'training'
        ? rules.data?.profile.trainingMeetingMinutes
        : null;
  const meetingBefore = meetingChoice ?? (ruleMinutes != null ? 'rule' : '0');
  const meetingMinutes = meetingBefore === 'rule' ? (ruleMinutes ?? 0) : Number(meetingBefore);
  const meetingAt = meetingMinutes > 0 ? new Date(startsAt.getTime() - meetingMinutes * 60_000) : null;
  const isAway = type === 'match' && home === 'away';
  // Wiederholen: wöchentlich bis zu einem Datum (Standard: 8 Wochen)
  const until = repeatUntil ?? toIsoDate(addDays(fromIsoDate(date), 56));
  const untilValid = until >= date;
  const occurrences = untilValid
    ? Math.floor((fromIsoDate(until).getTime() - fromIsoDate(date).getTime()) / 86_400_000 / 7) + 1
    : 0;

  const save = useMutation({
    mutationFn: (allowConflict: boolean) =>
      api<EventDetail>(`/teams/${id}/events`, {
        method: 'POST',
        body: {
          type,
          title: type === 'team_event' ? title.trim() : null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          // „Regel der Mannschaft“: Treffen und Standard-Treffpunkt berechnet der Server
          ...(meetingBefore === 'rule'
            ? { ...(meetingPoint.trim() ? { meetingPoint: meetingPoint.trim() } : {}) }
            : {
                meetingAt: meetingAt?.toISOString() ?? null,
                meetingPoint: meetingAt ? meetingPoint.trim() || null : null,
              }),
          facilityId: !isAway && place !== 'other' ? place : null,
          locationText: isAway || place === 'other' ? locationText.trim() || null : null,
          locationUrl: isAway || place === 'other' ? locationUrl.trim() || null : null,
          description: description.trim() || null,
          opponentName: type === 'match' ? opponent.trim() : null,
          isHome: type === 'match' ? home === 'home' : null,
          allowConflict,
          matchKind: type === 'match' ? kind : null,
          ...(type !== 'match' && repeat === 'weekly' ? { repeatUntil: until } : {}),
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
          : type !== 'match' && repeat === 'weekly' && !untilValid
            ? 'Das Enddatum liegt vor dem ersten Termin.'
            : type !== 'match' && repeat === 'weekly' && occurrences > 53
              ? 'Höchstens 53 Termine (etwa ein Jahr).'
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
            placeholder={t('z. B. TSV Blauen')}
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
          <ChoiceChips
            label="Art des Spiels"
            options={MATCH_KIND_OPTIONS}
            selected={[kind]}
            onToggle={setKind}
          />
        </Card>
      ) : null}
      {type === 'team_event' ? (
        <Card>
          <TextField
            label="Titel"
            value={title}
            onChangeText={setTitle}
            placeholder={t('z. B. Mannschaftsabend')}
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
          <>
            <ChoiceChips
              label="Wiederholen"
              options={[
                { value: 'once' as const, label: 'Einmalig' },
                { value: 'weekly' as const, label: 'Wöchentlich bis …' },
              ]}
              selected={[repeat]}
              onToggle={setRepeat}
            />
            {repeat === 'weekly' ? (
              <>
                <DateStepper
                  label="Wiederholen bis einschließlich"
                  value={until}
                  min={date}
                  onChange={setRepeatUntil}
                />
                <T variant="caption">
                  {untilValid
                    ? occurrences === 1
                      ? 'Es wird nur dieser eine Termin angelegt.'
                      : `Es werden ${occurrences} wöchentliche Termine angelegt.`
                    : 'Das Enddatum liegt vor dem ersten Termin.'}
                </T>
              </>
            ) : null}
          </>
        ) : null}
        <ChoiceChips
          label="Treffpunkt vorher"
          options={[
            ...(ruleMinutes != null
              ? [{ value: 'rule', label: `Regel der Mannschaft (${ruleMinutes} Min.)` }]
              : []),
            { value: '0', label: 'Keiner' },
            { value: '15', label: '15 Min.' },
            { value: '30', label: '30 Min.' },
            { value: '60', label: '60 Min.' },
            { value: '90', label: '90 Min.' },
          ]}
          selected={[meetingBefore]}
          onToggle={setMeetingChoice}
        />
        {meetingAt ? (
          <TextField
            label={
              meetingBefore === 'rule' ? 'Treffpunkt (leer = Standard der Mannschaft)' : 'Treffpunkt'
            }
            value={meetingPoint}
            onChangeText={setMeetingPoint}
            placeholder={rules.data?.profile.defaultMeetingPoint ?? 'z. B. Kabine Vereinsheim'}
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
        {isAway || place === 'other' ? (
          <MapLinkField value={locationUrl} onChange={setLocationUrl} />
        ) : null}
        <TextField
          label="Info für die Mannschaft (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder={t('z. B. Bitte schwarze Stutzen mitbringen')}
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
