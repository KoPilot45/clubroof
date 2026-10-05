import type { MemberListItem, TransferKind, TransferOverview } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
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
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

const KINDS: { value: TransferKind; label: string; hint: string }[] = [
  {
    value: 'internal',
    label: 'Wechsel im Verein',
    hint: 'Der Spieler wechselt ab heute dauerhaft die Mannschaft.',
  },
  {
    value: 'loan',
    label: 'Leihe',
    hint: 'Spielt befristet zusätzlich in einer anderen Mannschaft; das Stammteam bleibt.',
  },
  {
    value: 'join',
    label: 'Zugang',
    hint: 'Neuzugang von einem anderen Verein. Das Mitglied muss angelegt sein.',
  },
  {
    value: 'leave',
    label: 'Abgang',
    hint: 'Verlässt die Mannschaft (z. B. Vereinswechsel). Die Mitgliedschaft bleibt bestehen.',
  },
];

export default function NewTransferScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['admin', 'transfers'],
    queryFn: () => api<TransferOverview>('/admin/transfers'),
  });
  const [q, setQ] = useState('');
  const [person, setPerson] = useState<MemberListItem | null>(null);
  const [kind, setKind] = useState<TransferKind>('internal');
  const [fromTeam, setFromTeam] = useState<string | null>(null);
  const [toTeam, setToTeam] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState(todayIso());
  const [external, setExternal] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const search = useQuery({
    queryKey: ['admin', 'members', 'search', q.trim()],
    queryFn: () =>
      api<MemberListItem[]>(`/admin/members?status=active&q=${encodeURIComponent(q.trim())}`),
    enabled: q.trim().length >= 2 && !person,
  });
  const teams = overview.data?.teams ?? [];
  const needsFrom = kind === 'internal' || kind === 'leave';
  const needsTo = kind !== 'leave';
  const teamOptions = teams.map((t) => ({ value: t.id, label: `${t.badge} · ${t.name}` }));

  const save = useMutation({
    mutationFn: () =>
      api<TransferOverview>('/admin/transfers', {
        method: 'POST',
        body: {
          personId: person!.id,
          kind,
          fromTeamId: needsFrom ? fromTeam : null,
          toTeamId: needsTo ? toTeam : null,
          endsOn: kind === 'loan' ? endsOn : null,
          externalClub: external.trim() || null,
          note: note.trim() || null,
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'transfers'], data);
      void queryClient.invalidateQueries();
      router.back();
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Die Bewegung konnte nicht erfasst werden.'),
  });

  const valid =
    !!person &&
    (!needsFrom || !!fromTeam) &&
    (!needsTo || !!toTeam) &&
    (kind !== 'loan' || endsOn > todayIso()) &&
    (kind !== 'join' || external.trim().length > 1);

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 10 }}>
        {person ? (
          <>
            <T variant="label">Spieler</T>
            <Chip
              tone="primary"
              label={`${person.firstName} ${person.lastName} · ${person.teams.map((t) => t.badge).join(', ') || 'ohne Mannschaft'}`}
            />
            <Button label="Andere Person" variant="outline" onPress={() => setPerson(null)} />
          </>
        ) : (
          <>
            <TextField
              label="Spieler suchen"
              value={q}
              onChangeText={setQ}
              placeholder="Name eingeben"
            />
            {(search.data ?? []).slice(0, 8).map((m) => (
              <Button
                key={m.id}
                label={`${m.lastName}, ${m.firstName}${m.teams.length ? ` · ${m.teams.map((t) => t.badge).join(', ')}` : ''}`}
                variant="outline"
                onPress={() => setPerson(m)}
              />
            ))}
          </>
        )}
      </Card>
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          label="Art"
          options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
          selected={[kind]}
          onToggle={setKind}
        />
        <T variant="caption">{KINDS.find((k) => k.value === kind)!.hint}</T>
        {needsFrom ? (
          <ChoiceChips
            label="Von"
            options={teamOptions}
            selected={fromTeam ? [fromTeam] : []}
            onToggle={setFromTeam}
          />
        ) : null}
        {needsTo ? (
          <ChoiceChips
            label="Nach"
            options={teamOptions}
            selected={toTeam ? [toTeam] : []}
            onToggle={setToTeam}
          />
        ) : null}
        {kind === 'loan' ? (
          <DateStepper label="Leihe bis" value={endsOn} min={todayIso()} onChange={setEndsOn} />
        ) : null}
        {kind === 'join' || kind === 'leave' ? (
          <TextField
            label={kind === 'join' ? 'Bisheriger Verein' : 'Neuer Verein (optional)'}
            value={external}
            onChangeText={setExternal}
            maxLength={80}
          />
        ) : null}
        <TextField label="Notiz (optional)" value={note} onChangeText={setNote} maxLength={300} />
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Bewegung erfassen"
        icon="checkmark"
        disabled={!valid}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
