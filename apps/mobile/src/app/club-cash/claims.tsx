import { Columns } from '@/components/columns';
import {
  CLUB_CLAIM_STATUS_LABEL,
  type ClubExpenseClaim,
  type ClubExpenseClaims,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, View } from 'react-native';
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
import { formatEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Counted } from '@/lib/motion';

const TONE = {
  submitted: 'action',
  approved: 'info',
  rejected: 'urgent',
  paid: 'success',
} as const;

/** Eingereichte Auslagen prüfen (Paket K5): genehmigen, ablehnen mit Begründung, erstatten (Buchung im Kassenbuch). */
export default function ClaimsAdminScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['club-claims'],
    queryFn: () => api<ClubExpenseClaims>('/club-cash/claims'),
  });
  const target = useBookingTarget('expense', 'Aufwandsentschädigungen');
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const done = (d: ClubExpenseClaims) => {
    setError(null);
    setOpen(null);
    setReason('');
    queryClient.setQueryData(['club-claims'], d);
    void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'reject' | 'pay' }) =>
      api<ClubExpenseClaims>(`/club-cash/claims/${v.id}/${v.action}`, {
        method: 'POST',
        body:
          v.action === 'reject'
            ? { reason: reason.trim() }
            : v.action === 'pay'
              ? { accountId: target.account, categoryId: target.category, paidOn }
              : undefined,
      }),
    onSuccess: done,
    onError: fail,
  });

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;

  const card = (c: ClubExpenseClaim) => (
    <Card key={c.id} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
          {c.description}
        </T>
        <Chip tone={TONE[c.status]} label={t(CLUB_CLAIM_STATUS_LABEL[c.status])} />
      </View>
      <T variant="caption">
        {[
          c.personName,
          formatEuro(c.amountCents),
          c.expenseDate.split('-').reverse().join('.'),
          c.kind === 'mileage' ? t(`${c.kilometers} km`) : null,
          c.rejectReason,
        ]
          .filter(Boolean)
          .join(' · ')}
      </T>
      {c.receiptUrl ? (
        <Button
          label="Beleg ansehen"
          icon="document-attach-outline"
          size="sm"
          variant="outline"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => void Linking.openURL(c.receiptUrl!)}
        />
      ) : null}
      {d.canManage && c.status === 'submitted' ? (
        open === c.id ? (
          <View style={{ gap: 8 }}>
            <TextField
              label="Begründung (bei Ablehnung)"
              value={reason}
              onChangeText={setReason}
              maxLength={300}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label="Genehmigen"
                icon="checkmark"
                style={{ flex: 1 }}
                loading={act.isPending}
                onPress={() => act.mutate({ id: c.id, action: 'approve' })}
              />
              <Button
                label="Ablehnen"
                variant="danger"
                style={{ flex: 1 }}
                disabled={reason.trim().length < 3}
                loading={act.isPending}
                onPress={() => act.mutate({ id: c.id, action: 'reject' })}
              />
            </View>
          </View>
        ) : (
          <Button
            label="Prüfen"
            size="sm"
            variant="tonal"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setOpen(c.id)}
          />
        )
      ) : null}
      {d.canManage && c.status === 'approved' ? (
        open === c.id ? (
          <View style={{ gap: 10 }}>
            {target.picker}
            <DateStepper label="Erstattet am" value={paidOn} onChange={setPaidOn} />
            <Button
              label="Erstattung buchen"
              icon="cash-outline"
              disabled={!target.ready}
              loading={act.isPending}
              onPress={() => act.mutate({ id: c.id, action: 'pay' })}
            />
          </View>
        ) : (
          <Button
            label="Erstatten"
            icon="cash-outline"
            size="sm"
            variant="tonal"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setOpen(c.id)}
          />
        )
      ) : null}
    </Card>
  );

  const openOnes = d.claims.filter((c) => c.status === 'submitted' || c.status === 'approved');
  const closed = d.claims.filter((c) => !(c.status === 'submitted' || c.status === 'approved'));
  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          Offene Auslagen
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
          <Counted value={d.openCents} format={formatEuro} />
        </T>
        <T variant="caption" color={colors.hero.onHero}>
          {d.openCount === 1 ? t('1 Auslage wartet') : t(`${d.openCount} Auslagen warten`)}
        </T>
      </HeroCard>
      <Columns min={460} gap={24}>
        <Section title="Offen">
          {openOnes.length === 0 ? (
            <Card>
              <Empty icon="checkmark-done-outline" text="Nichts zu prüfen." />
            </Card>
          ) : null}
          {openOnes.map(card)}
        </Section>
        {closed.length ? <Section title="Erledigt">{closed.map(card)}</Section> : null}
      </Columns>
    </Screen>
  );
}
