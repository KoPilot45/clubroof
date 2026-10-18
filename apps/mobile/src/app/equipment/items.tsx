import type { EquipmentItem, EquipmentOverview, UpdateEquipmentInput } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { EditSheet } from '@/components/edit-sheet';
import { EditedNote } from '@/components/edited';
import { useConfirmDelete } from '@/lib/confirm';
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
  const confirmDelete = useConfirmDelete();
  const queryClient = useQueryClient();
  const [giving, setGiving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EquipmentItem | null>(null);
  const list = useQuery({
    queryKey: ['equipment'],
    queryFn: () => api<EquipmentOverview>('/equipment'),
  });
  const change = useMutation({
    mutationFn: (v: {
      path: string;
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
    }) => api<EquipmentOverview>(v.path, { method: v.method, body: v.body }),
    onSuccess: (data) => {
      queryClient.setQueryData(['equipment'], data);
      setGiving(null);
      setCreating(false);
      setEditing(null);
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
                  item.note,
                  item.handedOutAt ? `ausgegeben ${formatAgo(item.handedOutAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
              <EditedNote at={item.editedAt} />
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
                  <Button
                    label="Bearbeiten"
                    icon="create-outline"
                    variant="outline"
                    onPress={() => setEditing(item)}
                  />
                  {item.holder ? null : (
                    <Button
                      label="Ausmustern"
                      icon="archive-outline"
                      variant="outline"
                      onPress={() =>
                        confirmDelete({
                          name: item.name,
                          archive: true,
                          onConfirm: () =>
                            change.mutateAsync({ path: `/equipment/${item.id}`, method: 'DELETE' }),
                        })
                      }
                    />
                  )}
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
      <EditSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === 'key' ? 'Schlüssel bearbeiten' : 'Material bearbeiten'}
        fields={[
          { key: 'name', label: 'Bezeichnung', value: editing?.name ?? '', maxLength: 80 },
          { key: 'quantity', label: 'Anzahl', value: String(editing?.quantity ?? 1), maxLength: 3 },
          { key: 'location', label: 'Lagerort', value: editing?.location ?? '', maxLength: 80 },
          {
            key: 'note',
            label: 'Zustand / Hinweis (optional)',
            value: editing?.note ?? '',
            maxLength: 300,
          },
        ]}
        onSave={async (v) =>
          change.mutateAsync({
            path: `/equipment/${editing!.id}`,
            method: 'PATCH',
            body: {
              name: v.name!.trim(),
              quantity: Number(v.quantity),
              location: v.location!.trim() || null,
              note: v.note!.trim() || null,
            } satisfies UpdateEquipmentInput,
          })
        }
      />
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
