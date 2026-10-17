import type {
  ClubEventForm,
  ClubEventType,
  CreateClubEventInput,
  EventPlanning,
  UpdateClubEventInput,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { EditedNote, useLeaveGuard } from '@/components/edited';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TextField,
  TimeStepper,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';
import { MapLinkField } from '@/components/map-link-field';
import { AudiencePicker, type Audience } from '@/components/audience-picker';

const TYPES: { value: ClubEventType; label: string }[] = [
  { value: 'club_event', label: 'Veranstaltung' },
  { value: 'meeting', label: 'Versammlung' },
  { value: 'work_assignment', label: 'Arbeitseinsatz' },
];

type Shift = {
  /** vorhandene Schicht (Bearbeiten) */
  id?: string;
  /** Zahl der schon Angemeldeten: Plätze dürfen nicht darunter sinken, die Schicht bleibt */
  signedUp?: number;
  title: string;
  from: string;
  to: string;
  capacity: number;
};

/** Datum (JJJJ-MM-TT) und Uhrzeit (HH:MM) eines ISO-Zeitpunkts in Ortszeit des Geräts, wie sie die Steller zeigen. */
const localDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const localTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function NewClubEventScreen() {
  const { api } = useSignedIn();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const queryClient = useQueryClient();
  const planning = useQuery({
    queryKey: ['admin', 'club-events'],
    queryFn: () => api<EventPlanning>('/admin/club-events'),
  });
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 3_600_000).toISOString().slice(0, 10);
  const [type, setType] = useState<ClubEventType>('club_event');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(inTwoWeeks);
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('18:00');
  const [scope, setScope] = useState<string>('club');
  const [audience, setAudience] = useState<Audience>({ teamIds: [], personIds: [] });
  const [place, setPlace] = useState<string>('text');
  const [locationText, setLocationText] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [program, setProgram] = useState<{ time: string; title: string }[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);

  // Bearbeiten: dasselbe Formular, vorausgefüllt (kein zweites Formular)
  const form = useQuery({
    queryKey: ['admin', 'club-event-form', id],
    queryFn: () => api<ClubEventForm>(`/admin/club-events/${id}`),
    enabled: editing,
    staleTime: 0,
  });
  const [loaded, setLoaded] = useState(!editing);
  const [saved, setSaved] = useState(false);
  const [initial, setInitial] = useState('');
  const snapshot = JSON.stringify({
    title,
    description,
    date,
    from,
    to,
    audience,
    place,
    locationText,
    locationUrl,
    program,
    shifts,
  });
  useEffect(() => {
    const f = form.data;
    if (!f || loaded) return;
    setType(f.type);
    setTitle(f.title);
    setDescription(f.description ?? '');
    setDate(localDate(f.startsAt));
    setFrom(localTime(f.startsAt));
    setTo(localTime(f.endsAt));
    setAudience({ teamIds: f.teamIds, personIds: f.personIds });
    setPlace(f.facilityId ?? 'text');
    setLocationText(f.locationText ?? '');
    setLocationUrl(f.locationUrl ?? '');
    setProgram(f.program);
    setShifts(
      f.shifts.map((x) => ({
        id: x.id,
        signedUp: x.signedUp,
        title: x.title,
        from: localTime(x.startsAt),
        to: localTime(x.endsAt),
        capacity: x.capacity,
      })),
    );
    setLoaded(true);
  }, [form.data, loaded]);
  // Ausgangsstand merken, sobald das Formular gefüllt ist (für „ungespeicherte Änderungen“)
  useEffect(() => {
    if (editing && loaded && !initial) setInitial(snapshot);
  }, [editing, loaded, initial, snapshot]);

  const iso = (time: string) => new Date(`${date}T${time}:00`).toISOString();
  const save = useMutation<EventPlanning | ClubEventForm, Error, boolean>({
    mutationFn: (allowConflict: boolean) => {
      if (editing) {
        const patch: UpdateClubEventInput = {
          title: title.trim(),
          description: description.trim() || null,
          startsAt: iso(from),
          endsAt: iso(to),
          teamIds: audience.teamIds,
          personIds: audience.personIds,
          facilityId: place === 'text' ? null : place,
          locationText: place === 'text' ? locationText.trim() || null : null,
          locationUrl: place === 'text' ? locationUrl.trim() || null : null,
          program: program.filter((p) => p.title.trim()),
          shifts: shifts
            .filter((x) => x.title.trim())
            .map((x) => ({
              ...(x.id ? { id: x.id } : {}),
              title: x.title.trim(),
              startsAt: iso(x.from),
              endsAt: iso(x.to),
              capacity: x.capacity,
            })),
          allowConflict,
        };
        return api<ClubEventForm>(`/admin/club-events/${id}`, { method: 'PATCH', body: patch });
      }
      const body: CreateClubEventInput = {
        type,
        title: title.trim(),
        description: description.trim() || null,
        startsAt: iso(from),
        endsAt: iso(to),
        orgUnitId: scope === 'club' ? null : scope,
        ...(audience.teamIds.length ? { teamIds: audience.teamIds } : {}),
        ...(audience.personIds.length ? { personIds: audience.personIds } : {}),
        facilityId: place === 'text' ? null : place,
        locationText: place === 'text' ? locationText.trim() || null : null,
        locationUrl: place === 'text' ? locationUrl.trim() || null : null,
        program: program.filter((p) => p.title.trim()),
        shifts: shifts
          .filter((x) => x.title.trim())
          .map((x) => ({
            title: x.title.trim(),
            startsAt: iso(x.from),
            endsAt: iso(x.to),
            capacity: x.capacity,
          })),
        allowConflict,
      };
      return api<EventPlanning>('/admin/club-events', { method: 'POST', body });
    },
    onSuccess: () => {
      allowLeave();
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['event'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['helpers'] });
      router.back();
    },
    onError: (e) => {
      if (e instanceof RequestError && e.code === 'facility_conflict') setConflict(e.message);
    },
  });

  const dirty = editing && loaded && !saved && initial !== '' && snapshot !== initial;
  const { guard, allowLeave } = useLeaveGuard(dirty, () => save.mutate(false));
  if (planning.isPending || (editing && form.isPending)) return <Loading />;
  if (planning.error)
    return <ErrorNotice error={planning.error} onRetry={() => planning.refetch()} />;
  const p = planning.data;
  const error = save.error instanceof RequestError && !conflict ? save.error.message : null;

  return (
    <Screen edges={[]}>
      {guard}
      <Card style={{ gap: 12 }}>
        {editing ? null : <ChoiceChips options={TYPES} selected={[type]} onToggle={setType} />}
        <TextField
          label="Titel"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder={t('z. B. Sommerfest')}
        />
        <TextField
          label="Beschreibung (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          multiline
        />
        <DateStepper
          label="Datum"
          value={date}
          onChange={setDate}
          min={editing ? undefined : new Date().toISOString().slice(0, 10)}
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TimeStepper label="Beginn" value={from} onChange={setFrom} step={30} />
          </View>
          <View style={{ flex: 1 }}>
            <TimeStepper label="Ende" value={to} onChange={setTo} step={30} />
          </View>
        </View>
        {p.scopes.length > 1 && !editing ? (
          <ChoiceChips
            label="Für wen?"
            options={p.scopes.map((x) => ({ value: x.orgUnitId ?? 'club', label: x.label }))}
            selected={[scope]}
            onToggle={setScope}
          />
        ) : null}
        <AudiencePicker value={audience} onChange={setAudience} />
        <ChoiceChips
          label="Ort"
          options={[
            ...p.facilities.map((f) => ({ value: f.id, label: f.name })),
            { value: 'text', label: 'Anderer Ort' },
          ]}
          selected={[place]}
          onToggle={(v) => {
            setPlace(v);
            setConflict(null);
          }}
        />
        {place === 'text' ? (
          <TextField
            label="Ort"
            value={locationText}
            onChangeText={setLocationText}
            maxLength={120}
            placeholder={t('z. B. Vereinsheim')}
          />
        ) : null}
        {place === 'text' ? <MapLinkField value={locationUrl} onChange={setLocationUrl} /> : null}
      </Card>

      <Section title="Ablaufplan (optional)">
        <Card style={{ gap: 10 }}>
          {program.map((item, i) => (
            <View key={i} style={{ gap: 6 }}>
              <TimeStepper
                label={`Programmpunkt ${i + 1}`}
                value={item.time}
                step={15}
                onChange={(time) =>
                  setProgram(program.map((x, j) => (j === i ? { ...x, time } : x)))
                }
              />
              <TextField
                label="Was passiert?"
                value={item.title}
                maxLength={80}
                onChangeText={(t) =>
                  setProgram(program.map((x, j) => (j === i ? { ...x, title: t } : x)))
                }
              />
            </View>
          ))}
          <Button
            label="Programmpunkt hinzufügen"
            variant="outline"
            icon="add"
            onPress={() =>
              setProgram([...program, { time: program.at(-1)?.time ?? from, title: '' }])
            }
          />
        </Card>
      </Section>

      <Section title="Helfer (optional)">
        <Card style={{ gap: 12 }}>
          {shifts.map((x, i) => {
            const set = (patch: Partial<Shift>) =>
              setShifts(shifts.map((y, j) => (j === i ? { ...y, ...patch } : y)));
            return (
              <View key={i} style={{ gap: 6 }}>
                <TextField
                  label={`Schicht ${i + 1}`}
                  value={x.title}
                  maxLength={60}
                  onChangeText={(t) => set({ title: t })}
                  placeholder={t('z. B. Grill')}
                />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <TimeStepper
                      label="Von"
                      value={x.from}
                      step={30}
                      onChange={(v) => set({ from: v })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TimeStepper
                      label="Bis"
                      value={x.to}
                      step={30}
                      onChange={(v) => set({ to: v })}
                    />
                  </View>
                </View>
                <ChoiceChips
                  label="Helfer"
                  options={[...new Set(['1', '2', '3', '4', '6', '8', '10', String(x.capacity)])]
                    .map(Number)
                    .sort((a, b) => a - b)
                    .filter((n) => n >= (x.signedUp ?? 1))
                    .map((n) => ({ value: String(n), label: String(n) }))}
                  selected={[String(x.capacity)]}
                  onToggle={(n) => set({ capacity: Number(n) })}
                />
                {x.signedUp ? (
                  <T variant="caption">
                    {t(`Schon eingetragen: ${x.signedUp}. Diese Schicht bleibt bestehen.`)}
                  </T>
                ) : (
                  <Button
                    label="Schicht entfernen"
                    variant="outline"
                    icon="trash-outline"
                    onPress={() => setShifts(shifts.filter((_, j) => j !== i))}
                  />
                )}
              </View>
            );
          })}
          <Button
            label="Schicht hinzufügen"
            variant="outline"
            icon="add"
            onPress={() => setShifts([...shifts, { title: '', from, to, capacity: 2 }])}
          />
        </Card>
      </Section>

      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {conflict ? (
        <Card style={{ gap: 8 }}>
          <Chip tone="action" icon="warning" label="Platz belegt" />
          <T>{conflict}</T>
          <Button label="Trotzdem planen" variant="outline" onPress={() => save.mutate(true)} />
        </Card>
      ) : null}
      {editing ? <EditedNote at={form.data?.editedAt} /> : null}
      <Button
        label={editing ? 'Änderungen speichern' : 'Veranstaltung anlegen'}
        icon="checkmark"
        loading={save.isPending}
        disabled={title.trim().length < 3 || to <= from}
        onPress={() => {
          setConflict(null);
          save.mutate(false);
        }}
      />
      <T variant="caption">
        {editing
          ? 'Wer zugesagt hat oder als Helfer eingetragen ist, erfährt von geänderter Zeit oder geändertem Ort.'
          : 'Alle in der gewählten Abteilung werden benachrichtigt. Helferschichten erscheinen unter „Helfer gesucht“.'}
      </T>
    </Screen>
  );
}
