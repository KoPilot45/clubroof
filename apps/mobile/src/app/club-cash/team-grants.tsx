import type { ClubTeamGrants } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useBookingTarget } from '@/components/booking-target';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

/** Zuschuss an eine Mannschaftskasse (Paket K5): Ausgabe der Vereinskasse, Einnahme in der Kasse der Mannschaft. */
export default function TeamGrantsScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['club-team-grants'],
    queryFn: () => api<ClubTeamGrants>('/club-cash/team-grants'),
  });
  const target = useBookingTarget('expense', 'Sportgeräte und Material');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [bookedOn, setBookedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<ClubTeamGrants>('/club-cash/team-grants', {
        method: 'POST',
        body: {
          teamId,
          accountId: target.account,
          categoryId: target.category,
          amountCents: parseEuro(amount),
          bookedOn,
          note: note.trim() || null,
        },
      }),
    onSuccess: (d) => {
      setError(null);
      setAmount('');
      setNote('');
      queryClient.setQueryData(['club-team-grants'], d);
      void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
      ),
  });

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Card>
        <T variant="caption">
          Der Zuschuss steht als Ausgabe im Kassenbuch und zugleich als Einnahme in der
          Mannschaftskasse. Danach kann er nicht mehr einzeln storniert werden.
        </T>
      </Card>
      {d.canManage ? (
        <Section title="Zuschuss buchen">
          <Card style={{ gap: 12 }}>
            <ChoiceChips
              scroll
              label="Mannschaft"
              selected={teamId ? [teamId] : []}
              onToggle={setTeamId}
              options={d.teams.map((x) => ({ value: x.id, label: x.name }))}
            />
            <TextField label="Betrag in €" value={amount} onChangeText={setAmount} />
            <TextField
              label="Verwendungszweck (optional)"
              value={note}
              onChangeText={setNote}
              maxLength={120}
            />
            <DateStepper label="Datum" value={bookedOn} onChange={setBookedOn} />
            {target.picker}
            <Button
              label="Zuschuss buchen"
              icon="swap-horizontal"
              disabled={!teamId || parseEuro(amount) === null || !target.ready}
              loading={create.isPending}
              onPress={() => create.mutate()}
            />
          </Card>
        </Section>
      ) : null}
      <Section title="Bisherige Zuschüsse">
        <Card>
          {d.grants.length === 0 ? (
            <Empty icon="shirt-outline" text="Noch kein Zuschuss gebucht." />
          ) : null}
          {d.grants.map((g, i) => (
            <ListRow
              key={g.id}
              first={i === 0}
              title={g.teamName}
              subtitle={g.bookedOn.split('-').reverse().join('.')}
              trailing={<Chip tone="neutral" label={formatEuro(g.amountCents)} />}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
