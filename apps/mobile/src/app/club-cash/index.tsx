import {
  CLUB_CASH_ACCOUNT_KIND_LABEL,
  CLUB_CASH_AREA_LABEL,
  type ClubCash,
  type ClubCashEntry,
} from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
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
  type IconName,
} from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

const KIND_ICON: Record<ClubCash['accounts'][number]['kind'], IconName> = {
  bank: 'business',
  cash: 'cash',
  savings: 'trending-up',
  paypal: 'logo-paypal',
  other: 'wallet',
};

/** Betrag mit Vorzeichen für eine Buchung (Zugang +, Abgang −). */
export function signedAmount(e: Pick<ClubCashEntry, 'kind' | 'amountCents'>) {
  const plus = e.kind === 'income' || e.kind === 'transfer_in';
  return `${plus ? '+' : '−'}${formatEuro(e.amountCents)}`;
}

export function EntryRow({
  entry,
  first,
  onPress,
}: {
  entry: ClubCashEntry;
  first?: boolean;
  onPress?: () => void;
}) {
  const transfer = entry.kind === 'transfer_in' || entry.kind === 'transfer_out';
  return (
    <ListRow
      first={first}
      strike={!!entry.cancelled}
      onPress={onPress}
      leading={
        <IconTile
          name={transfer ? 'swap-horizontal' : entry.kind === 'income' ? 'arrow-down' : 'arrow-up'}
          tone={
            entry.cancelled
              ? 'archived'
              : transfer
                ? 'blue'
                : entry.kind === 'income'
                  ? 'success'
                  : 'action'
          }
        />
      }
      title={entry.purpose}
      subtitle={[
        entry.bookedOn.split('-').reverse().join('.'),
        entry.accountName,
        entry.categoryName,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={<Chip tone="neutral" label={signedAmount(entry)} />}
    />
  );
}

/** Vereinskasse (Paket K1): Gesamtbestand, Konten, Summen je Bereich, letzte Buchungen. */
export default function ClubCashScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const c = cash.data;
  const full = c?.level === 'full';

  return (
    <Screen edges={[]} refreshing={cash.isRefetching} onRefresh={() => cash.refetch()}>
      {cash.isPending ? <Loading /> : null}
      {cash.error ? <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} /> : null}
      {c ? (
        <>
          <HeroCard>
            <T variant="overline" color={colors.hero.onHero}>
              Gesamtbestand aller Konten
            </T>
            <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 44 }}>
              {formatEuro(c.totalBalanceCents)}
            </T>
            {!full ? (
              <T variant="caption" color={colors.hero.onHero}>
                Du siehst Kontostände und Summen, keine einzelnen Buchungen.
              </T>
            ) : null}
          </HeroCard>

          {c.canManage ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label="Einnahme"
                  icon="arrow-down"
                  style={{ flex: 1 }}
                  onPress={() => router.push('/club-cash/new?kind=income')}
                />
                <Button
                  label="Ausgabe"
                  icon="arrow-up"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => router.push('/club-cash/new?kind=expense')}
                />
              </View>
              <Button
                label="Umbuchung zwischen Konten"
                icon="swap-horizontal"
                variant="outline"
                onPress={() => router.push('/club-cash/new?kind=transfer')}
              />
            </View>
          ) : null}

          <Section title="Konten">
            <Card>
              {c.accounts
                .filter((a) => !a.archived)
                .map((a, i) => (
                  <ListRow
                    key={a.id}
                    first={i === 0}
                    leading={<IconTile name={KIND_ICON[a.kind]} tone="blue" />}
                    title={a.name}
                    subtitle={CLUB_CASH_ACCOUNT_KIND_LABEL[a.kind]}
                    trailing={<Chip tone="neutral" label={formatEuro(a.balanceCents)} />}
                    onPress={
                      full ? () => router.push(`/club-cash/entries?accountId=${a.id}`) : undefined
                    }
                  />
                ))}
              {c.accounts.every((a) => a.archived) ? (
                <Empty icon="wallet-outline" text="Noch kein Konto angelegt." />
              ) : null}
            </Card>
          </Section>

          <Section title={`${t('Einnahmen und Ausgaben')} ${c.year}`}>
            <Card style={{ gap: 10 }}>
              {c.areaTotals.map((a) => (
                <View key={a.area} style={{ gap: 2 }}>
                  <T variant="label" style={{ fontWeight: '700' }}>
                    {CLUB_CASH_AREA_LABEL[a.area]}
                  </T>
                  <T variant="caption">
                    {`${t('Einnahmen')} ${formatEuro(a.incomeCents)} · ${t('Ausgaben')} ${formatEuro(a.expenseCents)}`}
                  </T>
                </View>
              ))}
            </Card>
          </Section>

          {full ? (
            <Section title="Letzte Buchungen">
              <Card>
                {c.recent.length === 0 ? (
                  <Empty icon="receipt-outline" text="Noch keine Buchungen." />
                ) : (
                  c.recent.map((e, i) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      first={i === 0}
                      onPress={() => router.push(`/club-cash/entries?focus=${e.id}`)}
                    />
                  ))
                )}
              </Card>
              <Button
                label="Kassenbuch öffnen"
                icon="book-outline"
                variant="outline"
                onPress={() => router.push('/club-cash/entries')}
              />
            </Section>
          ) : null}

          <Button
            label={c.canManage || c.canChangeSettings ? 'Einrichtung' : 'Konten und Kategorien'}
            icon="settings-outline"
            variant="outline"
            onPress={() => router.push('/club-cash/manage')}
          />
        </>
      ) : null}
    </Screen>
  );
}
