import type { FineType, TeamCash } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

type Call = { path: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown };

/** Strafenkatalog der Mannschaft: alle sehen ihn, Trainerteam und Kassenwart pflegen ihn. */
export default function FinesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const cash = useQuery({
    queryKey: ['cash', id],
    queryFn: () => api<TeamCash>(`/teams/${id}/cash`),
  });
  const [editing, setEditing] = useState<FineType | 'new' | null>(null);
  const run = useMutation({
    mutationFn: (v: Call) => api<TeamCash>(v.path, { method: v.method, body: v.body }),
    onSuccess: (data) => {
      queryClient.setQueryData(['cash', id], data);
      setEditing(null);
    },
  });
  if (cash.isPending) return <Loading />;
  if (cash.error) return <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} />;
  const c = cash.data;
  const canEdit = c.permissions.manageFines;

  if (!c.config.fines) {
    return (
      <Screen edges={[]}>
        <Card>
          <Empty
            icon="alert-circle-outline"
            text="Strafen sind für diese Mannschaft nicht aktiviert."
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={[]} refreshing={cash.isRefetching} onRefresh={() => cash.refetch()}>
      <T variant="caption">
        {canEdit
          ? 'Lege Strafen und Beträge fest. Vergebene Strafen landen auf dem Konto der Person; eine spätere Änderung gilt nur für neue Strafen.'
          : 'Diese Strafen gelten in deiner Mannschaft. Festgelegt werden sie vom Trainerteam und der Kasse.'}
      </T>
      {canEdit ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            style={{ flex: 1 }}
            label="Strafe vergeben"
            icon="hand-left-outline"
            onPress={() => router.push(`/teams/${id}/cash-new?kind=fine`)}
          />
          <Button
            style={{ flex: 1 }}
            label="Neue Strafe"
            icon="add"
            variant="outline"
            onPress={() => setEditing('new')}
          />
        </View>
      ) : null}

      {editing === 'new' ? (
        <FineForm
          busy={run.isPending}
          onCancel={() => setEditing(null)}
          onSave={(body) =>
            run.mutate({ path: `/teams/${id}/cash/fine-types`, method: 'POST', body })
          }
        />
      ) : null}

      <Card>
        {c.fineCatalog.length === 0 ? (
          <Empty icon="list-outline" text="Noch keine Strafen festgelegt." />
        ) : null}
        {c.fineCatalog.map((f, i) =>
          editing !== 'new' && editing?.id === f.id ? (
            <FineForm
              key={f.id}
              initial={f}
              busy={run.isPending}
              onCancel={() => setEditing(null)}
              onSave={(body) =>
                run.mutate({ path: `/cash/fine-types/${f.id}`, method: 'PUT', body })
              }
              onDelete={() => run.mutate({ path: `/cash/fine-types/${f.id}`, method: 'DELETE' })}
            />
          ) : (
            <ListRow
              key={f.id}
              first={i === 0}
              title={f.name}
              subtitle={f.timesGiven ? `${f.timesGiven}× vergeben` : 'noch nicht vergeben'}
              trailing={<Chip tone="neutral" label={formatEuro(f.amountCents)} />}
              onPress={canEdit ? () => setEditing(f) : undefined}
            />
          ),
        )}
      </Card>
      {run.error ? (
        <Chip
          tone="urgent"
          icon="alert-circle"
          label={run.error instanceof RequestError ? run.error.message : 'Das hat nicht geklappt.'}
        />
      ) : null}
    </Screen>
  );
}

function FineForm({
  initial,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: FineType;
  busy: boolean;
  onSave: (body: { name: string; amountCents: number }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(
    initial ? (initial.amountCents / 100).toFixed(2).replace('.', ',') : '',
  );
  const cents = parseEuro(amount);
  const valid = name.trim().length >= 2 && !!cents;
  return (
    <Card style={{ gap: 10, marginVertical: 6 }}>
      <TextField
        label="Strafe"
        value={name}
        onChangeText={setName}
        placeholder={t('z. B. Zu spät zum Training')}
        maxLength={60}
      />
      <TextField
        label="Betrag in €"
        value={amount}
        onChangeText={setAmount}
        placeholder={t('0,50')}
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button label="Abbrechen" variant="outline" size="sm" onPress={onCancel} />
        <Button
          label="Speichern"
          size="sm"
          disabled={!valid}
          loading={busy}
          onPress={() => onSave({ name: name.trim(), amountCents: cents! })}
        />
        {onDelete ? (
          <Button
            label="Entfernen"
            icon="trash-outline"
            variant="danger"
            size="sm"
            onPress={onDelete}
          />
        ) : null}
      </View>
    </Card>
  );
}
