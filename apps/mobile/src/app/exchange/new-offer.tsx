import type { ExchangeOverview } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, ChoiceChips, Chip, Loading, Screen, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatShortDate, todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

function nextDays(n: number): string[] {
  const start = new Date(`${todayIso()}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function NewOfferScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['exchange'],
    queryFn: () => api<ExchangeOverview>('/exchange'),
  });
  const [teamId, setTeamId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [count, setCount] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teams = overview.data?.myTeams ?? [];
  const team = teamId ?? teams[0]?.id ?? null;
  const n = Number(count);

  const save = useMutation({
    mutationFn: () =>
      api<ExchangeOverview>('/exchange/offers', {
        method: 'POST',
        body: { teamId: team, day, count: n, note: note.trim() || null },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['exchange'], data);
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Das Angebot konnte nicht gespeichert werden.',
      ),
  });

  if (overview.isPending) return <Loading />;
  const valid = !!team && !!day && Number.isInteger(n) && n >= 1 && n <= 10;

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        {teams.length > 1 ? (
          <ChoiceChips
            label="Abgebende Mannschaft"
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            selected={team ? [team] : []}
            onToggle={setTeamId}
          />
        ) : null}
        <ChoiceChips
          label="Tag"
          options={nextDays(14).map((d) => ({ value: d, label: formatShortDate(d) }))}
          selected={day ? [day] : []}
          onToggle={setDay}
        />
      </Card>
      <Card style={{ gap: 12 }}>
        <TextField label="Anzahl Spieler" value={count} onChangeText={setCount} maxLength={2} />
        <TextField
          label="Hinweis (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="z. B. Ein Stürmer hat Zeit"
          maxLength={300}
        />
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Angebot speichern"
        icon="hand-right"
        disabled={!valid}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
