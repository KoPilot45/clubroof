import { Cell, DataTable } from '@/components/data-table';
import { useIsDesktop } from '@/lib/layout';
import type { ClubCash, ClubDonation, ClubDonations } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  HeroCard,
  ListRow,
  Loading,
  Notice,
  Screen,
  Section,
  T,
  TextField,
  Toggle,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Counted } from '@/lib/motion';

/**
 * Spenden und Zuwendungsbestätigungen (Paket K4). Die Bestätigung gibt es erst, wenn die Steuerdaten
 * vollständig sind und die Vorlage rechtlich bzw. steuerlich geprüft und freigegeben wurde.
 */
export default function DonationsScreen() {
  const desktop = useIsDesktop();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const key = ['club-donations', year];
  const data = useQuery({
    queryKey: key,
    queryFn: () => api<ClubDonations>(`/club-cash/donations?year=${year}`),
  });
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [donatedOn, setDonatedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [waiver, setWaiver] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const done = (d: ClubDonations) => {
    setError(null);
    queryClient.setQueryData(key, d);
    void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const accounts = (cash.data?.accounts ?? []).filter((a) => !a.archived);
  const categories = (cash.data?.categories ?? []).filter(
    (c) => !c.archived && c.direction === 'income',
  );
  const account = accountId ?? accounts[0]?.id;
  const category =
    categoryId ?? categories.find((c) => c.name === 'Spenden')?.id ?? categories[0]?.id;
  const create = useMutation({
    mutationFn: () =>
      api<ClubDonations>('/club-cash/donations', {
        method: 'POST',
        body: {
          accountId: account,
          categoryId: category,
          donorName: name.trim(),
          donorAddress: address.trim(),
          amountCents: parseEuro(amount),
          donatedOn,
          waiver,
        },
      }),
    onSuccess: (d) => {
      done(d);
      setYear(Number(donatedOn.slice(0, 4)));
      setName('');
      setAddress('');
      setAmount('');
      setWaiver(false);
    },
    onError: fail,
  });
  const issue = useMutation({
    mutationFn: (id: string) =>
      api<ClubDonations>(`/club-cash/donations/${id}/issue?year=${year}`, { method: 'POST' }),
    onSuccess: done,
    onError: fail,
  });
  const open = (id: string) =>
    void api<{ url: string }>(`/club-cash/donations/${id}/receipt-link`)
      .then(({ url }) => Linking.openURL(url))
      .catch(fail);

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const thisYear = new Date().getFullYear();

  const row = (x: ClubDonation, i: number) => (
    <View key={x.id}>
      <ListRow
        first={i === 0}
        strike={x.cancelled}
        title={x.donorName}
        subtitle={[
          x.donatedOn.split('-').reverse().join('.'),
          x.receiptNo ? `${t('Bestätigung')} ${x.receiptNo}` : t('Keine Bestätigung'),
        ].join(' · ')}
        trailing={<Chip tone="neutral" label={formatEuro(x.amountCents)} />}
      />
      {d.canManage && !x.cancelled ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10 }}>
          {x.receiptNo ? (
            <Button
              label="Bestätigung öffnen"
              icon="document-text-outline"
              size="sm"
              variant="tonal"
              onPress={() => open(x.id)}
            />
          ) : (
            <Button
              label="Bestätigung ausstellen"
              icon="ribbon-outline"
              size="sm"
              variant="tonal"
              disabled={!d.canIssue}
              loading={issue.isPending}
              onPress={() => issue.mutate(x.id)}
            />
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <ChoiceChips
        scroll
        selected={[String(year)]}
        onToggle={(v) => setYear(Number(v))}
        options={[thisYear - 2, thisYear - 1, thisYear].map((y) => ({
          value: String(y),
          label: String(y),
        }))}
      />
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          {`${t('Spenden')} ${year}`}
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
          <Counted value={d.totalCents} format={formatEuro} />
        </T>
        <T variant="caption" color={colors.hero.onHero}>
          {d.donations.filter((x) => !x.cancelled).length === 1
            ? t('1 Spende')
            : t(`${d.donations.filter((x) => !x.cancelled).length} Spenden`)}
        </T>
      </HeroCard>

      {!d.canIssue ? (
        <Notice
          tone="info"
          icon="information-circle"
          title="Zuwendungsbestätigungen noch nicht freigegeben"
          text={
            d.tax.complete
              ? 'Die Vorlage muss zuerst rechtlich bzw. steuerlich geprüft und von der Administration freigegeben werden.'
              : 'Die Steuerdaten des Vereins sind noch nicht vollständig. Die Administration trägt sie ein und gibt die Vorlage nach rechtlicher Prüfung frei.'
          }
          action={{
            label: 'Steuerdaten',
            icon: 'document-text',
            onPress: () => router.push('/club-cash/tax'),
          }}
        />
      ) : null}

      <Section title="Spenden">
        {desktop && d.donations.length > 0 ? null : (
          <Card>
            {d.donations.length === 0 ? (
              <Empty icon="heart-outline" text="Noch keine Spende in diesem Jahr." />
            ) : null}
            {d.donations.map(row)}
          </Card>
        )}
        {desktop && d.donations.length > 0 ? (
          <DataTable
            rows={d.donations}
            rowKey={(x) => x.id}
            exportName="spenden"
            defaultSort={{ key: 'date', dir: 'desc' }}
            columns={[
              {
                key: 'date',
                label: 'Datum',
                width: 110,
                sort: (x, y) => x.donatedOn.localeCompare(y.donatedOn),
                csv: (r) => r.donatedOn,
                render: (r) => <Cell muted>{r.donatedOn.split('-').reverse().join('.')}</Cell>,
              },
              {
                key: 'donor',
                label: 'Spender',
                flex: 2,
                sort: (x, y) => x.donorName.localeCompare(y.donorName),
                csv: (r) => r.donorName,
                render: (r) => (
                  <Cell>{r.cancelled ? `${r.donorName} (${t('Storniert')})` : r.donorName}</Cell>
                ),
              },
              {
                key: 'receipt',
                label: 'Bestätigung',
                flex: 1,
                csv: (r) => r.receiptNo ?? '',
                render: (r) => <Cell muted>{r.receiptNo ?? t('Keine Bestätigung')}</Cell>,
              },
              {
                key: 'amount',
                label: 'Betrag',
                width: 120,
                align: 'right',
                sort: (x, y) => x.amountCents - y.amountCents,
                csv: (r) => String(r.amountCents / 100),
                render: (r) => <Cell>{formatEuro(r.amountCents)}</Cell>,
              },
              {
                key: 'action',
                label: 'Aktion',
                width: 230,
                render: (r) =>
                  d.canManage && !r.cancelled ? (
                    r.receiptNo ? (
                      <Button
                        label="Bestätigung öffnen"
                        icon="document-text-outline"
                        size="sm"
                        variant="tonal"
                        onPress={() => open(r.id)}
                      />
                    ) : (
                      <Button
                        label="Bestätigung ausstellen"
                        icon="ribbon-outline"
                        size="sm"
                        variant="tonal"
                        disabled={!d.canIssue}
                        loading={issue.isPending}
                        onPress={() => issue.mutate(r.id)}
                      />
                    )
                  ) : null,
              },
            ]}
          />
        ) : null}
      </Section>

      {d.canManage ? (
        <Section title="Spende erfassen">
          <Card style={{ gap: 12 }}>
            <TextField label="Name" value={name} onChangeText={setName} maxLength={120} />
            <TextField
              label="Anschrift (für die Bestätigung)"
              value={address}
              onChangeText={setAddress}
              maxLength={240}
              placeholder={t('Straße, PLZ Ort')}
            />
            <TextField label="Betrag in €" value={amount} onChangeText={setAmount} />
            <DateStepper label="Spendendatum" value={donatedOn} onChange={setDonatedOn} />
            <ChoiceChips
              label="Eingang auf Konto"
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              selected={account ? [account] : []}
              onToggle={setAccountId}
            />
            <ChoiceChips
              label="Kategorie"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              selected={category ? [category] : []}
              onToggle={setCategoryId}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <T style={{ flex: 1 }}>Verzicht auf Erstattung von Aufwendungen</T>
              <Toggle
                label="Verzicht auf Erstattung von Aufwendungen"
                value={waiver}
                onChange={setWaiver}
              />
            </View>
            <Button
              label="Spende buchen"
              icon="add"
              disabled={
                name.trim().length < 2 || address.trim().length < 5 || parseEuro(amount) === null
              }
              loading={create.isPending}
              onPress={() => create.mutate()}
            />
            <T variant="caption">
              Die Spende wird als Einnahme im Kassenbuch gebucht. Mit ausgestellter Bestätigung kann
              die Buchung nicht mehr storniert werden.
            </T>
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
