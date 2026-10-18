import { Columns } from '@/components/columns';
import {
  CLUB_ALLOWANCE_KINDS,
  CLUB_ALLOWANCE_KIND_LABEL,
  type ClubAllowanceKind,
  type ClubAllowances,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { BudgetBar } from '@/components/budget-bar';
import { ChoiceCard } from '@/components/wizard';
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
  Notice,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

type Candidate = { personId: string; name: string; memberNumber: string | null };

/**
 * Übungsleiter- und Ehrenamtspauschale (Paket K5): Auszahlungen je Person und Jahr gegen den Freibetrag. Bei
 * Überschreitung wird nicht stillschweigend gebucht – erst nach Rückfrage. Steuerlich bitte prüfen lassen.
 */
export default function AllowancesScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const data = useQuery({
    queryKey: ['club-allowances', year],
    queryFn: () => api<ClubAllowances>(`/club-cash/allowances?year=${year}`),
  });
  const target = useBookingTarget('expense', 'Aufwandsentschädigungen');
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState<Candidate | null>(null);
  const [kind, setKind] = useState<ClubAllowanceKind>('trainer');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [exceeded, setExceeded] = useState<string | null>(null);

  const candidates = useQuery({
    queryKey: ['club-fees', 'members', search.trim()],
    queryFn: () =>
      api<Candidate[]>(`/club-cash/fees/members?q=${encodeURIComponent(search.trim())}`),
    enabled: search.trim().length >= 2 && !person,
  });
  const pay = useMutation({
    mutationFn: (force: boolean) =>
      api<ClubAllowances>('/club-cash/allowances', {
        method: 'POST',
        body: {
          personId: person!.personId,
          kind,
          amountCents: parseEuro(amount),
          paidOn,
          accountId: target.account,
          categoryId: target.category,
          force,
        },
      }),
    onSuccess: (d) => {
      setError(null);
      setExceeded(null);
      setAmount('');
      setPerson(null);
      setSearch('');
      setYear(d.year);
      queryClient.setQueryData(['club-allowances', d.year], d);
      void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
    },
    onError: (e) => {
      if (e instanceof RequestError && e.code === 'allowance_exceeded') {
        setExceeded(e.message);
        setError(null);
      } else
        setError(
          e instanceof RequestError
            ? e.message
            : 'Das hat nicht geklappt. Bitte versuche es erneut.',
        );
    },
  });

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const thisYear = new Date().getFullYear();

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <ChoiceChips
        scroll
        selected={[String(year)]}
        onToggle={(v) => setYear(Number(v))}
        options={[thisYear - 1, thisYear].map((y) => ({ value: String(y), label: String(y) }))}
      />
      <Columns min={420} gap={24}>
        <Section title="Freibeträge">
          <Card style={{ gap: 12 }}>
            {d.rows.length === 0 ? (
              <Empty icon="people-outline" text="Noch keine Auszahlung in diesem Jahr." />
            ) : null}
            {d.rows.map((r) => (
              <View key={`${r.personId}${r.kind}`} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
                    {`${r.personName} · ${t(CLUB_ALLOWANCE_KIND_LABEL[r.kind])}`}
                  </T>
                  <Chip
                    tone={
                      r.status === 'full' ? 'urgent' : r.status === 'warn' ? 'action' : 'success'
                    }
                    label={
                      r.status === 'full'
                        ? t('ausgeschöpft')
                        : r.status === 'warn'
                          ? t('fast ausgeschöpft')
                          : t('im Rahmen')
                    }
                  />
                </View>
                <BudgetBar
                  planned={r.limitCents}
                  actual={r.paidCents}
                  status={r.status === 'full' ? 'over' : r.status === 'warn' ? 'warn' : 'ok'}
                />
                <T variant="caption">
                  {`${formatEuro(r.paidCents)} ${t('von')} ${formatEuro(r.limitCents)} · ${t('noch frei')} ${formatEuro(r.remainingCents)}`}
                </T>
              </View>
            ))}
          </Card>
        </Section>

        {d.canManage ? (
          <Section title="Auszahlung erfassen">
            <Card style={{ gap: 12 }}>
              {person ? (
                <ChoiceCard
                  icon="person"
                  title={person.name}
                  text={person.memberNumber ?? undefined}
                  selected
                  onPress={() => setPerson(null)}
                />
              ) : (
                <>
                  <TextField label="Person suchen" value={search} onChangeText={setSearch} />
                  {(candidates.data ?? []).map((c) => (
                    <ChoiceCard
                      key={c.personId}
                      icon="person-outline"
                      title={c.name}
                      text={c.memberNumber ?? undefined}
                      selected={false}
                      onPress={() => setPerson(c)}
                    />
                  ))}
                </>
              )}
              <ChoiceChips
                selected={[kind]}
                onToggle={setKind}
                options={CLUB_ALLOWANCE_KINDS.map((k) => ({
                  value: k,
                  label: t(CLUB_ALLOWANCE_KIND_LABEL[k]),
                }))}
              />
              <TextField label="Betrag in €" value={amount} onChangeText={setAmount} />
              <DateStepper label="Gezahlt am" value={paidOn} onChange={setPaidOn} />
              {target.picker}
              {exceeded ? (
                <Notice
                  tone="action"
                  icon="warning"
                  title="Freibetrag würde überschritten"
                  text={exceeded}
                  action={{
                    label: 'Trotzdem buchen',
                    icon: 'checkmark',
                    onPress: () => pay.mutate(true),
                  }}
                />
              ) : null}
              <Button
                label="Auszahlung buchen"
                icon="cash-outline"
                disabled={!person || parseEuro(amount) === null || !target.ready}
                loading={pay.isPending}
                onPress={() => pay.mutate(false)}
              />
            </Card>
          </Section>
        ) : null}

        <Section title="Auszahlungen">
          <Card>
            {d.payments.length === 0 ? (
              <Empty icon="receipt-outline" text="Keine Auszahlungen." />
            ) : null}
            {d.payments.map((p, i) => (
              <ListRow
                key={p.id}
                first={i === 0}
                title={p.personName}
                subtitle={`${p.paidOn.split('-').reverse().join('.')} · ${t(CLUB_ALLOWANCE_KIND_LABEL[p.kind])}`}
                trailing={<Chip tone="neutral" label={formatEuro(p.amountCents)} />}
              />
            ))}
          </Card>
        </Section>
      </Columns>
    </Screen>
  );
}
