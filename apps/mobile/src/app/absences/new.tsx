import { ABSENCE_KINDS, type Absence, type AbsenceKind } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useLeaveGuard } from '@/components/edited';
import { Button, Card, ChoiceChips, Chip, DateStepper, Screen, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { ABSENCE_ICONS, ABSENCE_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { teamTitle } from '@/lib/team-labels';
import { t } from '@/lib/i18n';

export default function NewAbsenceScreen() {
  const { api, me } = useSignedIn();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const queryClient = useQueryClient();
  const today = todayIso();
  const [personId, setPersonId] = useState(me.person.id);
  const [kind, setKind] = useState<AbsenceKind>('vacation');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Bearbeiten: dasselbe Formular, vorausgefüllt mit der bestehenden Abwesenheit
  const list = useQuery({
    queryKey: ['absences'],
    queryFn: () => api<Absence[]>('/absences'),
    enabled: editing,
  });
  const existing = list.data?.find((a) => a.id === id);
  const [loaded, setLoaded] = useState(!editing);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!existing || loaded) return;
    setPersonId(existing.personId);
    setKind(existing.kind);
    setStartsOn(existing.startsOn);
    setEndsOn(existing.endsOn);
    setScope(existing.teams.length ? 'selected' : 'all');
    setTeamIds(existing.teams.map((t) => t.id));
    setNote(existing.note ?? '');
    setLoaded(true);
  }, [existing, loaded]);

  const personTeams = useMemo(
    () => me.teams.filter((t) => t.personId === personId && t.functions.includes('player')),
    [me.teams, personId],
  );

  const save = useMutation({
    mutationFn: () =>
      api<Absence>(editing ? `/absences/${id}` : '/absences', {
        method: editing ? 'PATCH' : 'POST',
        body: {
          ...(editing ? {} : { personId }),
          kind,
          startsOn,
          endsOn,
          teamIds: scope === 'selected' ? teamIds : null,
          note: note.trim() || null,
        },
      }),
    onSuccess: () => {
      allowLeave();
      setSaved(true);
      for (const key of ['absences', 'home', 'events', 'event']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Abwesenheit konnte nicht gespeichert werden.',
      ),
  });

  const invalid = scope === 'selected' && teamIds.length === 0;
  const dirty =
    editing &&
    loaded &&
    !saved &&
    !!existing &&
    (kind !== existing.kind ||
      startsOn !== existing.startsOn ||
      endsOn !== existing.endsOn ||
      note !== (existing.note ?? '') ||
      (scope === 'selected' ? teamIds.join() : '') !== existing.teams.map((t) => t.id).join());
  const { guard, allowLeave } = useLeaveGuard(dirty, () => save.mutate());

  return (
    <Screen
      edges={[]}
      footer={
        <>
          {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
          <Button
            label={editing ? 'Änderungen speichern' : 'Abwesenheit speichern'}
            icon="checkmark"
            disabled={invalid}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </>
      }
    >
      {guard}
      {me.managedPersons.length > 1 && !editing ? (
        <Card>
          <ChoiceChips
            label="Für wen?"
            options={me.managedPersons.map((p) => ({
              value: p.id,
              label: p.relation === 'self' ? 'Mich' : p.firstName,
            }))}
            selected={[personId]}
            onToggle={(v) => {
              setPersonId(v);
              setTeamIds([]);
            }}
          />
        </Card>
      ) : null}

      <Card>
        <ChoiceChips
          label="Grund"
          options={ABSENCE_KINDS.map((k) => ({
            value: k,
            label: ABSENCE_LABELS[k],
            icon: ABSENCE_ICONS[k],
          }))}
          selected={[kind]}
          onToggle={setKind}
        />
      </Card>

      <Card style={{ gap: 14 }}>
        <DateStepper
          label="Von"
          value={startsOn}
          min={editing ? undefined : today}
          onChange={(v) => {
            setStartsOn(v);
            if (endsOn < v) setEndsOn(v);
          }}
        />
        <DateStepper
          label="Bis (einschließlich)"
          value={endsOn}
          min={startsOn}
          onChange={setEndsOn}
        />
      </Card>

      {personTeams.length > 1 ? (
        <Card style={{ gap: 12 }}>
          <ChoiceChips
            label="Gilt für"
            options={[
              { value: 'all', label: 'Alle Mannschaften' },
              { value: 'selected', label: 'Nur ausgewählte' },
            ]}
            selected={[scope]}
            onToggle={(v) => setScope(v as 'all' | 'selected')}
          />
          {scope === 'selected' ? (
            <ChoiceChips
              options={personTeams.map((t) => ({ value: t.id, label: teamTitle(t) }))}
              selected={teamIds}
              onToggle={(id) =>
                setTeamIds((current) =>
                  current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
                )
              }
            />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <TextField
          label="Notiz (optional)"
          value={note}
          onChangeText={setNote}
          placeholder={t('z. B. weitere Infos für das Trainerteam')}
          maxLength={200}
          multiline
        />
      </Card>
    </Screen>
  );
}
