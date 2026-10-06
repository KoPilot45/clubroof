import type { EquipmentItem, EquipmentOverview } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

export default function EquipmentItemsScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [giving, setGiving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useQuery({
    queryKey: ['equipment'],
    queryFn: () => api<EquipmentOverview>('/equipment'),
  });
  const change = useMutation({
    mutationFn: (v: { path: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown }) =>
      api<EquipmentOverview>(v.path, { method: v.method, body: v.body }),
    onSuccess: (data) => {
      queryClient.setQueryData(['equipment'], data);
      setGiving(null);
      setCreating(false);
    },
  });
  if (list.isPending) return <Loading />;
  if (list.error) return <ErrorNotice error={list.error} onRetry={() => list.refetch()} />;
  const groups = [
    { title: 'Schlüssel', items: list.data.items.filter((i) => i.kind === 'key') },
    { title: 'Material', items: list.data.items.filter((i) => i.kind === 'material') },
  ];
  return (
    <Screen edges={[]} refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      {change.error ? (
        <Chip
          tone="urgent"
          icon="alert-circle"
          label={
            change.error instanceof RequestError ? change.error.message : 'Das hat nicht geklappt.'
          }
        />
      ) : null}
      {creating ? (
        <NewItem
          onCancel={() => setCreating(false)}
          onSave={(body) => change.mutate({ path: '/equipment', method: 'POST', body })}
          busy={change.isPending}
        />
      ) : (
        <Button label="Gegenstand erfassen" icon="add" onPress={() => setCreating(true)} />
      )}
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          {g.items.map((item) => (
            <Card key={item.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
                  {item.quantity > 1 ? `${item.quantity} × ${item.name}` : item.name}
                </T>
                {item.holder ? (
                  <Chip tone="action" icon="person" label={item.holder.name} />
                ) : (
                  <Chip tone="success" label="Verfügbar" />
                )}
              </View>
              <T variant="caption">
                {[
                  item.location,
                  item.handedOutAt ? `ausgegeben ${formatAgo(item.handedOutAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
              {giving === item.id ? (
                <HandOver
                  item={item}
                  onPick={(personId) =>
                    change.mutate({
                      path: `/equipment/${item.id}/holder`,
                      method: 'PUT',
                      body: { personId },
                    })
                  }
                  onCancel={() => setGiving(null)}
                />
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {item.holder ? (
                    <Button
                      label="Zurückgenommen"
                      icon="return-down-back"
                      variant="outline"
                      style={{ flex: 1 }}
                      onPress={() =>
                        change.mutate({
                          path: `/equipment/${item.id}/holder`,
                          method: 'PUT',
                          body: { personId: null },
                        })
                      }
                    />
                  ) : (
                    <Button
                      label="Ausgeben"
                      icon="hand-right-outline"
                      variant="outline"
                      style={{ flex: 1 }}
                      onPress={() => setGiving(item.id)}
                    />
                  )}
                </View>
              )}
            </Card>
          ))}
        </Section>
      ))}
    </Screen>
  );
}

function HandOver({
  item,
  onPick,
  onCancel,
}: {
  item: EquipmentItem;
  onPick: (personId: string) => void;
  onCancel: () => void;
}) {
  const { api } = useSignedIn();
  const [q, setQ] = useState('');
  const people = useQuery({
    queryKey: ['equipment-people', q],
    queryFn: () =>
      api<{ personId: string; name: string }[]>(
        `/equipment/people?q=${encodeURIComponent(q.trim())}`,
      ),
    enabled: q.trim().length >= 2,
  });
  return (
    <View style={{ gap: 6 }}>
      <TextField
        label={`„${item.name}“ ausgeben an`}
        value={q}
        onChangeText={setQ}
        placeholder={t('Name eingeben')}
      />
      {(people.data ?? []).map((p, i) => (
        <ListRow
          key={p.personId}
          first={i === 0}
          title={p.name}
          onPress={() => onPick(p.personId)}
        />
      ))}
      <Button label="Abbrechen" variant="outline" onPress={onCancel} />
    </View>
  );
}

function NewItem({
  busy,
  onSave,
  onCancel,
}: {
  busy: boolean;
  onSave: (body: {
    kind: 'material' | 'key';
    name: string;
    quantity: number;
    location: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<'material' | 'key'>('material');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState('');
  return (
    <Card style={{ gap: 10 }}>
      <ChoiceChips
        options={[
          { value: 'material' as const, label: 'Material' },
          { value: 'key' as const, label: 'Schlüssel' },
        ]}
        selected={[kind]}
        onToggle={setKind}
      />
      <TextField label="Bezeichnung" value={name} onChangeText={setName} maxLength={80} />
      <TextField label="Anzahl" value={quantity} onChangeText={setQuantity} maxLength={3} />
      <TextField label="Lagerort" value={location} onChangeText={setLocation} maxLength={80} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Abbrechen" variant="outline" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label="Speichern"
          style={{ flex: 1 }}
          loading={busy}
          disabled={name.trim().length < 2 || !(Number(quantity) >= 1)}
          onPress={() =>
            onSave({
              kind,
              name: name.trim(),
              quantity: Number(quantity),
              location: location.trim() || null,
            })
          }
        />
      </View>
    </Card>
  );
}
