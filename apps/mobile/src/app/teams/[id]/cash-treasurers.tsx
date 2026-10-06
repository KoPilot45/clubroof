import type { TreasurerCandidates } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActionError } from '@/components/cash';
import {
  Card,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  Toggle,
} from '@/components/ui';
import { useSignedIn } from '@/lib/session';

/** Kassenwart der Mannschaft bestimmen – Spieler mit Login oder Eltern der Spieler. */
export default function CashTreasurersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['cash-treasurers', id],
    queryFn: () => api<TreasurerCandidates>(`/teams/${id}/cash/treasurers`),
  });
  const set = useMutation({
    mutationFn: (v: { personId: string; enabled: boolean }) =>
      api<TreasurerCandidates>(`/teams/${id}/cash/treasurers/${v.personId}`, {
        method: 'PUT',
        body: { enabled: v.enabled },
      }),
    onSuccess: (d) => {
      queryClient.setQueryData(['cash-treasurers', id], d);
      void queryClient.invalidateQueries({ queryKey: ['cash', id] });
    },
  });
  if (data.isPending) return <Loading />;
  if (data.error) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const active = new Set(data.data.treasurers.map((t) => t.personId));
  return (
    <Screen edges={[]}>
      <T variant="caption">
        Der Kassenwart bucht Einnahmen, Ausgaben und Einzahlungen und pflegt den Strafenkatalog –
        gemeinsam mit dem Trainerteam. Infrage kommen Mitglieder mit eigenem Login und Eltern.
      </T>
      <Section title="Mannschaft und Eltern">
        <Card>
          {data.data.candidates.length === 0 ? (
            <Empty icon="person-outline" text="Niemand mit Login in der Mannschaft." />
          ) : null}
          {data.data.candidates.map((c, i) => (
            <ListRow
              key={c.personId}
              first={i === 0}
              title={c.name}
              subtitle={active.has(c.personId) ? `Kassenwart · ${c.relation}` : c.relation}
              trailing={
                <Toggle
                  label={`${c.name} als Kassenwart`}
                  value={active.has(c.personId)}
                  disabled={set.isPending}
                  onChange={(enabled) => set.mutate({ personId: c.personId, enabled })}
                />
              }
            />
          ))}
        </Card>
      </Section>
      <ActionError error={set.error} />
    </Screen>
  );
}
