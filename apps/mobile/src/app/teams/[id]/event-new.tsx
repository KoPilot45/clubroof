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
import { useLeaveGuard } from '@/components/edited';
import { View } from 'react-native';
import {
  Button,
  ChoiceChips,
  Chip,
  DateStepper,
  Screen,
  Section,
  Segment,
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

/** Regeldauer je Terminart in Minuten (Vorschlag für das Ende) */
const DEFAULTS: Record<Type, { time: string; minutes: number }> = {
  training: { time: '18:00', minutes: 90 },
  match: { time: '15:00', minutes: 105 },
  team_event: { time: '19:00', minutes: 120 },
};

/** „HH:MM“ plus Minuten (über Mitternacht hinaus umlaufend) */
function shiftTime(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function NewEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
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
  // Ende: Vorschlag aus Beginn + Regeldauer, bis jemand ein eigenes Ende wählt
  const [endPicked, setEndPicked] = useState<string | null>(null);
  // Treffen: „Standard der Mannschaft“ oder „Individuell“ (eigene Treffzeit und Treffpunkt)
  const [meetingMode, setMeetingMode] = useState<'standard' | 'custom'>('standard');
  const [meetPicked, setMeetPicked] = useState<string | null>(null);
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
  const endTime = endPicked ?? shiftTime(time, DEFAULTS[type].minutes);
  let endsAt = at(fromIsoDate(date), endTime, me.club.timezone);
  // Ende vor dem Beginn = nach Mitternacht
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86_400_000);
  const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const ruleMinutes =
    type === 'match'
      ? rules.data?.profile.matchMeetingMinutes
      : type === 'training'
        ? rules.data?.profile.trainingMeetingMinutes
        : null;
  const meetTime = meetPicked ?? shiftTime(time, -(ruleMinutes || 30));
  const customMeeting = meetingMode === 'custom';
  let customMeetAt = at(fromIsoDate(date), meetTime, me.club.timezone);
  // Treffzeit nach dem Beginn gilt als am Vortag
  if (customMeetAt > startsAt) customMeetAt = new Date(customMeetAt.getTime() - 86_400_000);
  const meetingAt = customMeeting ? customMeetAt : null;
  const isAway = type === 'match' && home === 'away';
  // Ruhiger Hinweis (Paket E2): wer zur selben Zeit auf dem Platz ist; erst ab drei Gruppen eine Warnung
  const parallelFacility = !isAway && place !== 'other' ? place : null;
  const parallel = useQuery({
    queryKey: ['parallel', parallelFacility, startsAt.toISOString(), endsAt.toISOString()],
    enabled: !!parallelFacility && durationMinutes <= 12 * 60,
    queryFn: () =>
      api<{ groups: string[]; blocked: string | null; crowded: boolean }>(
        `/facilities/parallel?facilityId=${parallelFacility}&startsAt=${encodeURIComponent(startsAt.toISOString())}&endsAt=${encodeURIComponent(endsAt.toISOString())}`,
      ),
  });
  // Wiederholen: wöchentlich bis zu einem Datum (Standard: 8 Wochen)
  const until = repeatUntil ?? toIsoDate(addDays(fromIsoDate(date), 56));
  const untilValid = until >= date;
  const occurrences = untilValid
    ? Math.floor((fromIsoDate(until).getTime() - fromIsoDate(date).getTime()) / 86_400_000 / 7) + 1
    : 0;

  // Begonnene Texteingaben gehen beim Verlassen nicht still verloren
  const dirty = [opponent, title, description, meetingPoint, locationText, locationUrl].some(
    (v) => v.trim() !== '',
  );
  const { guard, allowLeave } = useLeaveGuard(dirty, () => {
    if (!validation) save.mutate(false);
  });

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
          ...(!customMeeting
            ? {}
            : {
                meetingAt: meetingAt?.toISOString() ?? null,
                meetingPoint: meetingPoint.trim() || null,
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
      allowLeave();
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
          : durationMinutes > 12 * 60
            ? 'Das Ende liegt mehr als 12 Stunden nach dem Beginn.'
            : type !== 'match' && repeat === 'weekly' && !untilValid
              ? 'Das Enddatum liegt vor dem ersten Termin.'
              : type !== 'match' && repeat === 'weekly' && occurrences > 53
                ? 'Höchstens 53 Termine (etwa ein Jahr).'
                : null;

  return (
    <Screen
      edges={[]}
      footer={
        <>
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
          {parallel.data?.blocked ? (
            <Chip
              tone="action"
              icon="warning"
              label={t(`Platz gesperrt: ${parallel.data.blocked}`)}
            />
          ) : parallel.data?.crowded ? (
            <Chip
              tone="action"
              icon="people"
              label={t(`Schon mehrere Gruppen auf dem Platz: ${parallel.data.groups.join(', ')}`)}
            />
          ) : parallel.data?.groups.length ? (
            <Chip
              tone="info"
              icon="people-outline"
              label={t(`${parallel.data.groups.join(', ')} trainiert parallel`)}
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
        </>
      }
    >
      {guard}
      <Segment
        options={[
          { value: 'training' as Type, label: 'Training' },
          { value: 'match' as Type, label: 'Spiel' },
          { value: 'team_event' as Type, label: 'Teamevent' },
        ]}
        value={type}
        onChange={(v: Type) => {
          setType(v);
          setTime(DEFAULTS[v].time);
          setEndPicked(null);
          setMeetPicked(null);
        }}
      />

      {type === 'match' ? (
        <Section title="Spiel">
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
        </Section>
      ) : null}
      {type === 'team_event' ? (
        <Section title="Teamevent">
          <TextField
            label="Titel"
            value={title}
            onChangeText={setTitle}
            placeholder={t('z. B. Mannschaftsabend')}
            maxLength={120}
          />
        </Section>
      ) : null}

      <Section title="Wann">
        <DateStepper label="Datum" value={date} min={todayIso()} onChange={setDate} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TimeStepper label="Beginn" value={time} onChange={setTime} />
          </View>
          <View style={{ flex: 1 }}>
            <TimeStepper label="Ende" value={endTime} onChange={setEndPicked} />
          </View>
        </View>
        <T variant="caption">
          {t(
            `Dauer: ${Math.floor(durationMinutes / 60)}:${String(durationMinutes % 60).padStart(2, '0')} Std.`,
          )}
        </T>
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
                  max={toIsoDate(addDays(fromIsoDate(date), 364))}
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
      </Section>

      <Section title="Treffpunkt">
        <Segment
          options={[
            { value: 'standard' as const, label: 'Standard' },
            { value: 'custom' as const, label: 'Individuell' },
          ]}
          value={meetingMode}
          onChange={setMeetingMode}
        />
        {customMeeting ? (
          <>
            <TimeStepper label="Treffzeit" value={meetTime} onChange={setMeetPicked} />
            <TextField
              label="Treffpunkt"
              value={meetingPoint}
              onChangeText={setMeetingPoint}
              placeholder={rules.data?.profile.defaultMeetingPoint ?? 'z. B. Kabine Vereinsheim'}
              maxLength={120}
            />
          </>
        ) : (
          <T variant="caption">
            {ruleMinutes != null
              ? t(
                  `Treffen ${ruleMinutes} Min. vorher am Standard-Treffpunkt der Mannschaft${
                    rules.data?.profile.defaultMeetingPoint
                      ? `: ${rules.data.profile.defaultMeetingPoint}`
                      : ''
                  }`,
                )
              : t('Die Mannschaft hat keine Treffpunkt-Regel; es wird kein Treffen angelegt.')}
          </T>
        )}
      </Section>

      <Section title="Ort">
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
      </Section>
    </Screen>
  );
}
