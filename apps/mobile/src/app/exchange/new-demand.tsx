import type { DemandDetail, EventSummary, ExchangeOverview } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, ChoiceChips, Chip, Loading, Screen, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

const POSITIONS = ['Torwart', 'Abwehr', 'Innenverteidigung', 'Außenbahn', 'Mittelfeld', 'Sturm'];

export default function NewDemandScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['exchange'],
    queryFn: () => api<ExchangeOverview>('/exchange'),
  });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventSummary[]>('/events') });
  const [teamId, setTeamId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [count, setCount] = useState('1');
  const [positions, setPositions] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teams = overview.data?.myTeams ?? [];
  const team = teamId ?? teams[0]?.id ?? null;
  const list = (events.data ?? []).filter((e) => e.team?.id === team && e.status === 'scheduled');
  const n = Number(count);

  const save = useMutation({
    mutationFn: () =>
      api<DemandDetail>('/exchange/demands', {
        method: 'POST',
        body: { teamId: team, eventId, count: n, positions, note: note.trim() || null },
      }),
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ['exchange'] });
      router.replace(`/exchange/${d.id}`);
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Der Bedarf konnte nicht gemeldet werden.'),
  });

  if (overview.isPending || events.isPending) return <Loading />;
  const valid = !!team && !!eventId && Number.isInteger(n) && n >= 1 && n <= 10;

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        {teams.length > 1 ? (
          <ChoiceChips
            label="Mannschaft"
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            selected={team ? [team] : []}
            onToggle={(v) => {
              setTeamId(v);
              setEventId(null);
            }}
          />
        ) : null}
        <ChoiceChips
          label="Termin"
          options={list.map((e) => ({
            value: e.id,
            label: `${formatDay(e.startsAt)} ${formatTime(e.startsAt)} · ${e.title}`,
          }))}
          selected={eventId ? [eventId] : []}
          onToggle={setEventId}
        />
      </Card>
      <Card style={{ gap: 12 }}>
        <TextField label="Anzahl Spieler" value={count} onChangeText={setCount} maxLength={2} />
        <ChoiceChips
          label="Positionen (optional)"
          options={POSITIONS.map((p) => ({ value: p, label: p }))}
          selected={positions}
          onToggle={(p) =>
            setPositions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
          }
        />
        <TextField
          label="Hinweis (optional)"
          value={note}
          onChangeText={setNote}
          placeholder={t('z. B. Zwei Ausfälle durch Krankheit')}
          maxLength={300}
        />
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Bedarf melden"
        icon="megaphone"
        disabled={!valid}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
