import type { MatchIncidentKind, MatchSheet, SaveReportInput } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { INCIDENT_LABELS, IncidentRow } from '@/components/match';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

type Draft = SaveReportInput['incidents'][number];
const GOALS: MatchIncidentKind[] = ['goal', 'penalty_goal', 'own_goal'];

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const { colors, radii } = useTheme();
  const btn = (delta: number, text: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`${label} ${delta > 0 ? 'erhöhen' : 'verringern'}`)}
      onPress={() => onChange(Math.max(0, value + delta))}
      style={{
        width: 40,
        height: 40,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T variant="heading">{text}</T>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <T variant="caption" numberOfLines={1}>
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {btn(-1, '−')}
        <T variant="display" color={colors.primaryText}>
          {value}
        </T>
        {btn(1, '+')}
      </View>
    </View>
  );
}

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const sheet = useQuery({
    queryKey: ['match', id],
    queryFn: () => api<MatchSheet>(`/events/${id}/match`),
  });
  if (sheet.isPending) return <Loading />;
  if (sheet.error) return <ErrorNotice error={sheet.error} onRetry={() => sheet.refetch()} />;
  return <Editor sheet={sheet.data} />;
}

function Editor({ sheet }: { sheet: MatchSheet }) {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const [goalsFor, setGoalsFor] = useState(sheet.goalsFor ?? 0);
  const [goalsAgainst, setGoalsAgainst] = useState(sheet.goalsAgainst ?? 0);
  const [incidents, setIncidents] = useState<Draft[]>(
    (sheet.report?.incidents ?? []).map((i) => ({
      kind: i.kind,
      personId: i.person?.id ?? null,
      assistPersonId: i.assist?.id ?? null,
      minute: i.minute,
    })),
  );
  const [kind, setKind] = useState<MatchIncidentKind>('goal');
  const [person, setPerson] = useState<string | null>(null);
  const [assist, setAssist] = useState<string | null>(null);
  const [minute, setMinute] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Mit Aufstellung nur Kaderspieler, sonst alle Spieler des Spiels
  const squad = sheet.lineup?.entries.length
    ? sheet.lineup.entries.map((e) => ({ id: e.personId, name: e.name }))
    : (sheet.candidates ?? [])
        .filter((c) => c.status !== 'no')
        .map((c) => ({ id: c.personId, name: c.name }));
  const nameOf = (pid: string | null | undefined) => squad.find((p) => p.id === pid)?.name ?? null;
  const counted = incidents.filter((i) => GOALS.includes(i.kind)).length;
  const needsPerson = kind !== 'own_goal';
  const isGoal = GOALS.includes(kind);

  const add = () => {
    setIncidents((cur) =>
      [
        ...cur,
        {
          kind,
          personId: needsPerson ? person : null,
          assistPersonId: isGoal && needsPerson ? assist : null,
          minute: minute.trim() ? Number(minute) : null,
        },
      ].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999)),
    );
    if (isGoal && counted + 1 > goalsFor) setGoalsFor(counted + 1);
    setPerson(null);
    setAssist(null);
    setMinute('');
  };

  const save = useMutation({
    mutationFn: (complete: boolean) =>
      api<MatchSheet>(`/events/${sheet.eventId}/report`, {
        method: 'PUT',
        body: { goalsFor, goalsAgainst, incidents, complete } satisfies SaveReportInput,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['match', sheet.eventId], data);
      for (const k of ['event', 'stats', 'team', 'events'])
        void queryClient.invalidateQueries({ queryKey: [k] });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Der Spielbericht konnte nicht gespeichert werden.',
      ),
  });

  const ours = me.club.shortName;
  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <T variant="heading">{sheet.title}</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Counter label={`Tore ${ours}`} value={goalsFor} onChange={setGoalsFor} />
          <Counter
            label={`Tore ${sheet.opponentName}`}
            value={goalsAgainst}
            onChange={setGoalsAgainst}
          />
        </View>
        {counted !== goalsFor ? (
          <Chip
            tone="action"
            icon="information-circle"
            label={`Erfasst sind ${counted} von ${goalsFor} Toren.`}
          />
        ) : null}
      </Card>

      <Section title="Ereignisse">
        <Card style={{ gap: 10 }}>
          {incidents.length === 0 ? (
            <T variant="caption">Noch keine Tore oder Karten erfasst.</T>
          ) : null}
          {incidents.map((i, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <IncidentRow
                  i={{
                    id: String(idx),
                    kind: i.kind,
                    minute: i.minute ?? null,
                    person: i.personId ? { id: i.personId, name: nameOf(i.personId) ?? '?' } : null,
                    assist: i.assistPersonId
                      ? { id: i.assistPersonId, name: nameOf(i.assistPersonId) ?? '?' }
                      : null,
                  }}
                />
              </View>
              <Button
                label="Entfernen"
                variant="outline"
                onPress={() => setIncidents((cur) => cur.filter((_, j) => j !== idx))}
              />
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Ereignis hinzufügen">
        <Card style={{ gap: 12 }}>
          <ChoiceChips
            options={(Object.keys(INCIDENT_LABELS) as MatchIncidentKind[]).map((k) => ({
              value: k,
              label: INCIDENT_LABELS[k],
            }))}
            selected={[kind]}
            onToggle={(v) => {
              setKind(v);
              setAssist(null);
            }}
          />
          {needsPerson ? (
            <ChoiceChips
              label={isGoal ? 'Torschütze' : 'Spieler'}
              options={squad.map((p) => ({ value: p.id, label: p.name }))}
              selected={person ? [person] : []}
              onToggle={setPerson}
            />
          ) : null}
          {isGoal && needsPerson && person ? (
            <ChoiceChips
              label="Vorlage (optional)"
              options={squad
                .filter((p) => p.id !== person)
                .map((p) => ({ value: p.id, label: p.name }))}
              selected={assist ? [assist] : []}
              onToggle={(v) => setAssist((cur) => (cur === v ? null : v))}
            />
          ) : null}
          <TextField
            label="Minute (optional)"
            value={minute}
            onChangeText={(v) => setMinute(v.replace(/\D/g, ''))}
            maxLength={3}
          />
          <Button
            label="Hinzufügen"
            icon="add"
            variant="outline"
            disabled={needsPerson && !person}
            onPress={add}
          />
        </Card>
      </Section>

      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Spielbericht abschließen"
        icon="checkmark-circle"
        disabled={counted !== goalsFor}
        loading={save.isPending && save.variables === true}
        onPress={() => save.mutate(true)}
      />
      <Button
        label="Zwischenspeichern"
        variant="outline"
        loading={save.isPending && save.variables === false}
        onPress={() => save.mutate(false)}
      />
    </Screen>
  );
}
