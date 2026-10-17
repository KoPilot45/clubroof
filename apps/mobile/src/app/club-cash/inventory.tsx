import type { ClubInventory, ClubInventoryItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  HeroCard,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { View } from 'react-native';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Counted } from '@/lib/motion';

/** Inventar (Paket K5): Anschaffungen mit Wert und Standort, Aussonderung mit Grund (nichts wird gelöscht). */
export default function InventoryScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['club-inventory'],
    queryFn: () => api<ClubInventory>('/club-cash/inventory'),
  });
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cost, setCost] = useState('');
  const [location, setLocation] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const done = (d: ClubInventory) => {
    setError(null);
    setOpen(null);
    setReason('');
    queryClient.setQueryData(['club-inventory'], d);
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const create = useMutation({
    mutationFn: () =>
      api<ClubInventory>('/club-cash/inventory', {
        method: 'POST',
        body: {
          name: name.trim(),
          category: category.trim() || null,
          quantity: Number(quantity) || 1,
          costCents: cost.trim() ? parseEuro(cost) : null,
          location: location.trim() || null,
        },
      }),
    onSuccess: (d) => {
      done(d);
      setName('');
      setCategory('');
      setQuantity('1');
      setCost('');
      setLocation('');
    },
    onError: fail,
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; body: object }) =>
      api<ClubInventory>(`/club-cash/inventory/${v.id}`, { method: 'PATCH', body: v.body }),
    onSuccess: done,
    onError: fail,
  });

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const present = d.items.filter((i) => !i.disposedAt);
  const gone = d.items.filter((i) => i.disposedAt);

  const row = (i: ClubInventoryItem, n: number) => (
    <View key={i.id}>
      <ListRow
        first={n === 0}
        strike={!!i.disposedAt}
        leading={<IconTile name="cube" tone="orange" />}
        title={`${i.quantity} × ${i.name}`}
        subtitle={[
          i.category,
          i.location,
          i.acquiredOn ? i.acquiredOn.split('-').reverse().join('.') : null,
          i.disposedReason ? `${t('Ausgesondert')}: ${i.disposedReason}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        trailing={
          i.costCents != null ? <Chip tone="neutral" label={formatEuro(i.costCents)} /> : undefined
        }
        onPress={
          d.canManage && !i.disposedAt ? () => setOpen(open === i.id ? null : i.id) : undefined
        }
      />
      {d.canManage && open === i.id ? (
        <View style={{ gap: 8, paddingBottom: 10 }}>
          <TextField
            label="Grund der Aussonderung"
            value={reason}
            onChangeText={setReason}
            maxLength={200}
          />
          <Button
            label="Aussondern"
            icon="trash-outline"
            variant="danger"
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            disabled={reason.trim().length < 3}
            loading={patch.isPending}
            onPress={() =>
              patch.mutate({ id: i.id, body: { dispose: true, reason: reason.trim() } })
            }
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          Wert des Inventars
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
          <Counted value={d.totalCostCents} format={formatEuro} />
        </T>
        <T variant="caption" color={colors.hero.onHero}>
          {t(`${present.length} Positionen (Anschaffungswerte)`)}
        </T>
      </HeroCard>
      <Section title="Vorhanden">
        <Card>
          {present.length === 0 ? <Empty icon="cube-outline" text="Noch nichts erfasst." /> : null}
          {present.map(row)}
        </Card>
      </Section>
      {gone.length ? (
        <Section title="Ausgesondert">
          <Card>{gone.map(row)}</Card>
        </Section>
      ) : null}
      {d.canManage ? (
        <Section title="Gegenstand aufnehmen">
          <Card style={{ gap: 12 }}>
            <TextField label="Bezeichnung" value={name} onChangeText={setName} maxLength={100} />
            <TextField
              label="Art (z. B. Sportgeräte)"
              value={category}
              onChangeText={setCategory}
              maxLength={60}
            />
            <TextField label="Anzahl" value={quantity} onChangeText={setQuantity} />
            <TextField
              label="Anschaffungswert gesamt in € (optional)"
              value={cost}
              onChangeText={setCost}
            />
            <TextField
              label="Standort (z. B. Geräteraum)"
              value={location}
              onChangeText={setLocation}
              maxLength={100}
            />
            <Button
              label="Aufnehmen"
              icon="add"
              disabled={name.trim().length < 2}
              loading={create.isPending}
              onPress={() => create.mutate()}
            />
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
