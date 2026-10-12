import type { ClubReserve, ClubReserveMove, ClubReserves } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { BudgetBar } from '@/components/budget-bar';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
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
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/**
 * Rücklagen (Paket K3): zweckgebundene Töpfe innerhalb einer Kasse. Gebunden werden kann nur der freie
 * Kassenbestand; die Töpfe sind kein eigenes Konto, sondern ein Merker für den Bestand.
 */
export default function ReservesScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['club-reserves'],
    queryFn: () => api<ClubReserves>('/club-cash/reserves'),
  });
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [bookedOn, setBookedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [fundId, setFundId] = useState<string | null>(null);

  const done = (d: ClubReserves) => {
    setError(null);
    queryClient.setQueryData(['club-reserves'], d);
    setAmount('');
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const create = useMutation({
    mutationFn: () =>
      api<ClubReserves>('/club-cash/reserves', {
        method: 'POST',
        body: {
          fundId: fundId ?? data.data?.funds[0]?.fundId,
          name: name.trim(),
          targetCents: target.trim() ? parseEuro(target) : null,
        },
      }),
    onSuccess: (d) => {
      done(d);
      setName('');
      setTarget('');
    },
    onError: fail,
  });
  const move = useMutation({
    mutationFn: (v: { id: string; kind: 'allocate' | 'release' }) =>
      api<ClubReserves>(`/club-cash/reserves/${v.id}/moves`, {
        method: 'POST',
        body: { kind: v.kind, amountCents: parseEuro(amount), bookedOn },
      }),
    onSuccess: done,
    onError: fail,
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      api<ClubReserves>(`/club-cash/reserves/${id}`, { method: 'PATCH', body: { archived: true } }),
    onSuccess: done,
    onError: fail,
  });

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const active = d.reserves.filter((r) => !r.archived);
  const reserved = active.reduce((sum, r) => sum + r.balanceCents, 0);
  const chosenFund = d.funds.find((f) => f.fundId === fundId) ?? d.funds[0];

  const reserveRow = (r: ClubReserve) => (
    <View key={r.id}>
      <ListRow
        leading={<IconTile name="lock-closed" tone="violet" />}
        title={r.name}
        subtitle={[
          d.funds.length > 1 ? r.fundName : null,
          r.targetCents ? `${t('Ziel')} ${formatEuro(r.targetCents)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        trailing={<Chip tone="neutral" label={formatEuro(r.balanceCents)} />}
        onPress={() => setOpen(open === r.id ? null : r.id)}
      />
      {r.targetCents ? (
        <View style={{ paddingBottom: 8 }}>
          <BudgetBar planned={r.targetCents} actual={r.balanceCents} status="ok" />
        </View>
      ) : null}
      {open === r.id ? (
        <ReserveDetail
          r={r}
          canManage={d.canManage}
          amount={amount}
          setAmount={setAmount}
          bookedOn={bookedOn}
          setBookedOn={setBookedOn}
          busy={move.isPending}
          archiving={archive.isPending}
          onMove={(kind) => move.mutate({ id: r.id, kind })}
          onArchive={() => archive.mutate(r.id)}
        />
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          Gebundene Rücklagen
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
          {formatEuro(reserved)}
        </T>
        <T variant="caption" color={colors.hero.onHero}>
          Teil des Kassenbestands, der für einen Zweck zurückgelegt ist.
        </T>
      </HeroCard>

      <Section title="Kassen">
        <Card>
          {d.funds.map((f, i) => (
            <ListRow
              key={f.fundId}
              first={i === 0}
              title={f.fundName}
              subtitle={`${t('Bestand')} ${formatEuro(f.balanceCents)} · ${t('gebunden')} ${formatEuro(f.reservedCents)}`}
              trailing={
                <Chip
                  tone="success"
                  label={`${t('frei')} ${formatEuro(f.balanceCents - f.reservedCents)}`}
                />
              }
            />
          ))}
        </Card>
      </Section>

      <Section title="Rücklagen">
        <Card>
          {active.length === 0 ? (
            <Empty icon="lock-closed-outline" text="Noch keine Rücklage." />
          ) : null}
          {active.map(reserveRow)}
        </Card>
      </Section>

      {d.canManage ? (
        <Section title="Rücklage anlegen">
          <Card style={{ gap: 12 }}>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder={t('z. B. Platzsanierung')}
            />
            <TextField label="Zielbetrag in € (optional)" value={target} onChangeText={setTarget} />
            {d.funds.length > 1 ? (
              <ChoiceChips
                label="Kasse"
                options={d.funds.map((f) => ({ value: f.fundId, label: f.fundName }))}
                selected={chosenFund ? [chosenFund.fundId] : []}
                onToggle={setFundId}
              />
            ) : null}
            <Button
              label="Rücklage anlegen"
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

/** Zuführen, Entnehmen und Verlauf eines Rücklagen-Topfs. */
function ReserveDetail({
  r,
  canManage,
  amount,
  setAmount,
  bookedOn,
  setBookedOn,
  busy,
  archiving,
  onMove,
  onArchive,
}: {
  r: ClubReserve;
  canManage: boolean;
  amount: string;
  setAmount: (v: string) => void;
  bookedOn: string;
  setBookedOn: (v: string) => void;
  busy: boolean;
  archiving: boolean;
  onMove: (kind: 'allocate' | 'release') => void;
  onArchive: () => void;
}) {
  const { api } = useSignedIn();
  const moves = useQuery({
    queryKey: ['club-reserves', r.id, 'moves', r.balanceCents],
    queryFn: () => api<ClubReserveMove[]>(`/club-cash/reserves/${r.id}/moves`),
  });
  return (
    <View style={{ gap: 10, paddingBottom: 10 }}>
      {canManage ? (
        <>
          <TextField label="Betrag in €" value={amount} onChangeText={setAmount} />
          <DateStepper label="Datum" value={bookedOn} onChange={setBookedOn} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label="Zuführen"
              icon="arrow-down"
              style={{ flex: 1 }}
              disabled={parseEuro(amount) === null}
              loading={busy}
              onPress={() => onMove('allocate')}
            />
            <Button
              label="Entnehmen"
              icon="arrow-up"
              variant="outline"
              style={{ flex: 1 }}
              disabled={parseEuro(amount) === null}
              loading={busy}
              onPress={() => onMove('release')}
            />
          </View>
          <Button
            label="Rücklage auflösen"
            variant="danger"
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            loading={archiving}
            onPress={onArchive}
          />
        </>
      ) : null}
      {(moves.data ?? []).map((m) => (
        <T key={m.id} variant="caption">
          {[
            m.bookedOn.split('-').reverse().join('.'),
            `${m.kind === 'allocate' ? '+' : '−'}${formatEuro(m.amountCents)}`,
            m.note,
            m.createdByName,
          ]
            .filter(Boolean)
            .join(' · ')}
        </T>
      ))}
    </View>
  );
}
