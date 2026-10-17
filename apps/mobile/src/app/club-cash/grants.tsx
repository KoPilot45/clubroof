import { CLUB_GRANT_STATUS_LABEL, type ClubGrant, type ClubGrants } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useBookingTarget } from '@/components/booking-target';
import {
  Button,
  Card,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  HeroCard,
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
import { Counted } from '@/lib/motion';

const TONE = {
  planned: 'neutral',
  applied: 'info',
  approved: 'action',
  received: 'success',
  rejected: 'urgent',
} as const;

/** Zuschüsse (Paket K5): Antrag, Bewilligung, Eingang (Buchung als Einnahme) und Frist des Verwendungsnachweises. */
export default function GrantsScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['club-grants'],
    queryFn: () => api<ClubGrants>('/club-cash/grants'),
  });
  const target = useBookingTarget('income', 'Zuschüsse');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [grantor, setGrantor] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [receivedOn, setReceivedOn] = useState(() => new Date().toISOString().slice(0, 10));

  const done = (d: ClubGrants) => {
    setError(null);
    setReceiving(null);
    queryClient.setQueryData(['club-grants'], d);
    void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const create = useMutation({
    mutationFn: () =>
      api<ClubGrants>('/club-cash/grants', {
        method: 'POST',
        body: {
          name: name.trim(),
          grantor: grantor.trim(),
          amountCents: parseEuro(amount),
          proofDeadline: deadline,
        },
      }),
    onSuccess: (d) => {
      done(d);
      setName('');
      setGrantor('');
      setAmount('');
      setDeadline(null);
    },
    onError: fail,
  });
  const act = useMutation({
    mutationFn: (v: { id: string; path: string; body?: object }) =>
      api<ClubGrants>(`/club-cash/grants/${v.id}/${v.path}`, { method: 'POST', body: v.body }),
    onSuccess: done,
    onError: fail,
  });

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;

  const next: Record<string, { label: string; status: string }[]> = {
    planned: [{ label: 'Als beantragt markieren', status: 'applied' }],
    applied: [
      { label: 'Bewilligt', status: 'approved' },
      { label: 'Abgelehnt', status: 'rejected' },
    ],
    approved: [],
    received: [],
    rejected: [{ label: 'Wieder auf „Geplant“', status: 'planned' }],
  };

  const card = (g: ClubGrant) => (
    <Card key={g.id} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
          {g.name}
        </T>
        <Chip tone={TONE[g.status]} label={t(CLUB_GRANT_STATUS_LABEL[g.status])} />
      </View>
      <T variant="caption">{`${g.grantor} · ${formatEuro(g.amountCents)}`}</T>
      {g.proofDeadline ? (
        <Chip
          tone={
            g.proofSubmittedAt
              ? 'success'
              : g.proofOverdue
                ? 'urgent'
                : g.proofDueSoon
                  ? 'action'
                  : 'neutral'
          }
          icon={g.proofSubmittedAt ? 'checkmark-circle' : 'time'}
          label={
            g.proofSubmittedAt
              ? t('Verwendungsnachweis eingereicht')
              : `${t(g.proofOverdue ? 'Nachweis überfällig seit' : 'Nachweis bis')} ${g.proofDeadline.split('-').reverse().join('.')}`
          }
        />
      ) : null}
      {d.canManage ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {next[g.status]!.map((n) => (
              <Button
                key={n.status}
                label={n.label}
                size="sm"
                variant="tonal"
                loading={act.isPending}
                onPress={() => act.mutate({ id: g.id, path: 'status', body: { status: n.status } })}
              />
            ))}
            {g.status === 'approved' ? (
              <Button
                label="Eingang buchen"
                icon="download-outline"
                size="sm"
                variant="tonal"
                onPress={() => setReceiving(receiving === g.id ? null : g.id)}
              />
            ) : null}
            {g.proofDeadline && g.status !== 'rejected' ? (
              <Button
                label={g.proofSubmittedAt ? 'Nachweis wieder offen' : 'Nachweis eingereicht'}
                size="sm"
                variant="outline"
                onPress={() =>
                  act.mutate({ id: g.id, path: 'proof', body: { submitted: !g.proofSubmittedAt } })
                }
              />
            ) : null}
          </View>
          {receiving === g.id ? (
            <View style={{ gap: 10 }}>
              {target.picker}
              <DateStepper label="Eingegangen am" value={receivedOn} onChange={setReceivedOn} />
              <Button
                label="Als Einnahme buchen"
                icon="checkmark"
                disabled={!target.ready}
                loading={act.isPending}
                onPress={() =>
                  act.mutate({
                    id: g.id,
                    path: 'receive',
                    body: { accountId: target.account, categoryId: target.category, receivedOn },
                  })
                }
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          Erwartete Zuschüsse
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
          <Counted value={d.expectedCents} format={formatEuro} />
        </T>
        <T variant="caption" color={colors.hero.onHero}>
          {`${t('Bereits eingegangen')} ${formatEuro(d.receivedCents)}`}
        </T>
      </HeroCard>
      <Section title="Zuschüsse">
        {d.grants.length === 0 ? (
          <Card>
            <Empty icon="ribbon-outline" text="Noch kein Zuschuss angelegt." />
          </Card>
        ) : null}
        {d.grants.map(card)}
      </Section>
      {d.canManage ? (
        <Section title="Zuschuss anlegen">
          <Card style={{ gap: 12 }}>
            <TextField label="Bezeichnung" value={name} onChangeText={setName} maxLength={100} />
            <TextField
              label="Geber (z. B. Stadt, Verband)"
              value={grantor}
              onChangeText={setGrantor}
              maxLength={100}
            />
            <TextField label="Betrag in €" value={amount} onChangeText={setAmount} />
            {deadline ? (
              <DateStepper
                label="Frist für den Verwendungsnachweis"
                value={deadline}
                onChange={setDeadline}
              />
            ) : (
              <Button
                label="Frist für den Verwendungsnachweis setzen"
                icon="time-outline"
                variant="outline"
                onPress={() => setDeadline(new Date().toISOString().slice(0, 10))}
              />
            )}
            <Button
              label="Zuschuss anlegen"
              icon="add"
              disabled={
                name.trim().length < 2 || grantor.trim().length < 2 || parseEuro(amount) === null
              }
              loading={create.isPending}
              onPress={() => create.mutate()}
            />
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
