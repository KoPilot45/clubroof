import {
  CLUB_CASH_ACCOUNT_KIND_LABEL,
  CLUB_CASH_AREA_LABEL,
  type ClubCash,
  type ClubCashEntry,
  type ClubCashStats,
} from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
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
import { FundSwitcher } from '@/components/fund-switcher';
import { Sparkline } from '@/components/charts';
import { useFundFilter } from '@/lib/fund-filter';
import { formatEuro, formatEuroShort, formatPercent, todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';
import { Columns } from '@/components/columns';
import { Counted } from '@/lib/motion';

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
  showFund,
  onPress,
}: {
  entry: ClubCashEntry;
  first?: boolean;
  /** Kasse in der Zeile nennen (nur sinnvoll, wenn es mehrere Kassen gibt) */
  showFund?: boolean;
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
        showFund ? `${entry.fundName} › ${entry.accountName}` : entry.accountName,
        entry.categoryName,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={<Chip tone="neutral" label={signedAmount(entry)} />}
    />
  );
}

/** Zwei dünne Balken je Steuerbereich: Einnahmen (Blau) und Ausgaben (Orange) mit Saldo. */
function AreaPairs({ areas }: { areas: ClubCash['areaTotals'] }) {
  const { colors } = useTheme();
  const c = colors.anstoss.chart;
  const top = Math.max(1, ...areas.flatMap((a) => [a.incomeCents, a.expenseCents]));
  const bar = (cents: number, color: string) => (
    <View
      style={{
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.anstoss.overlay,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${(cents / top) * 100}%`,
          borderRadius: 5,
          backgroundColor: color,
        }}
      />
    </View>
  );
  return (
    <>
      {areas.map((a) => (
        <View
          key={a.area}
          accessible
          accessibilityLabel={`${CLUB_CASH_AREA_LABEL[a.area]}: ${t('Einnahmen')} ${formatEuro(a.incomeCents)}, ${t('Ausgaben')} ${formatEuro(a.expenseCents)}`}
          style={{ gap: 4 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="label" style={{ fontWeight: '700' }}>
              {CLUB_CASH_AREA_LABEL[a.area]}
            </T>
            <T variant="caption">{`${t('Saldo')} ${formatEuro(a.incomeCents - a.expenseCents)}`}</T>
          </View>
          {bar(a.incomeCents, c.income)}
          <T variant="caption">{`${t('Einnahmen')} ${formatEuro(a.incomeCents)}`}</T>
          {bar(a.expenseCents, c.expense)}
          <T variant="caption">{`${t('Ausgaben')} ${formatEuro(a.expenseCents)}`}</T>
        </View>
      ))}
    </>
  );
}

/** Drei Kennzahlen unter dem Hero: Ausgaben mit Vorjahr, Beitragseingang als Meter, Rücklagen mit Ziel. */
function KeyFigures({ st, year }: { st: ClubCashStats; year: number }) {
  const { colors } = useTheme();
  const c = colors.anstoss.chart;
  const rate = st.fees && st.fees.dueCents ? (st.fees.paidCents / st.fees.dueCents) * 100 : null;
  const reserved = st.reserves.reduce((sum, r) => sum + r.balanceCents, 0);
  const target = st.reserves.reduce((sum, r) => sum + (r.targetCents ?? 0), 0);
  const meter = (percent: number, color: string) => (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.anstoss.overlay,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, percent))}%`,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
    </View>
  );
  const tile = (
    key: string,
    value: string,
    label: string,
    sub: string,
    bar: React.ReactNode,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}, ${sub}`}
      onPress={onPress}
      style={{
        flex: 1,
        gap: 4,
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <T variant="caption" numberOfLines={2} style={{ minHeight: 30 }}>
        {label}
      </T>
      <T variant="figure" style={{ fontSize: 22, lineHeight: 26 }} numberOfLines={1} verbatim>
        {value}
      </T>
      {bar}
      <T variant="caption" numberOfLines={2} style={{ fontSize: 11 }} verbatim>
        {sub}
      </T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {tile(
        'exp',
        formatEuroShort(st.totals.expenseCents),
        t('Ausgaben'),
        t(`${year}, Vorjahr ${formatEuroShort(st.totals.previousExpenseCents)}`),
        meter(
          st.totals.previousExpenseCents
            ? (st.totals.expenseCents / st.totals.previousExpenseCents) * 100
            : st.totals.expenseCents
              ? 100
              : 0,
          c.expense,
        ),
        () => router.push('/club-cash/stats?topic=flows'),
      )}
      {rate !== null
        ? tile(
            'fees',
            formatPercent(rate),
            t('Beitragseingang'),
            st.fees!.overdueCount
              ? t(`${st.fees!.overdueCount} überfällig`)
              : t('nichts überfällig'),
            meter(rate, colors.status.success.solid),
            () => router.push('/club-cash/stats?topic=fees'),
          )
        : null}
      {tile(
        'res',
        formatEuroShort(reserved),
        t('Rücklagen'),
        target ? t(`Ziel ${formatEuroShort(target)}`) : t('ohne Ziel'),
        meter(target ? (reserved / target) * 100 : 0, c.aqua),
        () => router.push('/club-cash/reserves'),
      )}
    </View>
  );
}

/** Vereinskasse (Paket K1): Gesamtbestand, Konten, Summen je Abteilung, letzte Buchungen. */
export default function ClubCashScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const [fundId, setFundId] = useFundFilter();
  const cash = useQuery({
    queryKey: ['club-cash', 'overview', fundId ?? 'all'],
    queryFn: () => api<ClubCash>(fundId ? `/club-cash?fundId=${fundId}` : '/club-cash'),
  });
  const year = todayIso().slice(0, 4);
  const stats = useQuery({
    queryKey: ['club-cash', 'stats', fundId ?? 'all', `${year}-01-01`, 'overview'],
    queryFn: () =>
      api<ClubCashStats>(
        `/club-cash/stats?from=${year}-01-01&to=${todayIso()}&interval=month${fundId ? `&fundId=${fundId}` : ''}`,
      ),
  });
  const c = cash.data;
  const st = stats.data;
  const fund = c?.funds.find((f) => f.id === c.fundId);
  const full = c?.level === 'full';

  return (
    <Screen edges={[]} refreshing={cash.isRefetching} onRefresh={() => cash.refetch()}>
      {cash.isPending ? <Loading /> : null}
      {cash.error ? <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} /> : null}
      {c ? (
        <>
          <FundSwitcher funds={c.funds} value={c.fundId} onChange={setFundId} />
          <HeroCard>
            <T variant="overline" color={colors.hero.onHero}>
              {fund ? `${t('Bestand der Kasse')} ${fund.name}` : 'Gesamtbestand aller Konten'}
            </T>
            <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 64, lineHeight: 68 }}>
              <Counted value={c.totalBalanceCents} format={formatEuro} />
            </T>
            {st && st.balance.length > 1 ? (
              <Sparkline
                values={st.balance.map((b) => b.cents)}
                color={colors.hero.onHero}
                ring={colors.hero.to}
              />
            ) : null}
            {!full ? (
              <T variant="caption" color={colors.hero.onHero}>
                Du siehst Kontostände und Summen, keine einzelnen Buchungen.
              </T>
            ) : null}
          </HeroCard>

          {st ? <KeyFigures st={st} year={c.year} /> : null}

          <Columns min={440}>
            {!fund && c.funds.filter((f) => !f.archived).length > 1 ? (
              <Section title="Kassen">
                <Card>
                  {c.funds
                    .filter((f) => !f.archived)
                    .map((f, i) => (
                      <ListRow
                        key={f.id}
                        first={i === 0}
                        leading={<IconTile name="wallet" tone="violet" />}
                        title={f.name}
                        subtitle={[
                          f.isMain ? t('Hauptkasse') : null,
                          f.units.map((u) => u.name).join(', ') || null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        trailing={<Chip tone="neutral" label={formatEuro(f.balanceCents)} />}
                        onPress={() => setFundId(f.id)}
                      />
                    ))}
                </Card>
              </Section>
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
                {c.canManageFunds && c.accounts.every((a) => a.archived) ? (
                  <Button
                    label="Kasse einrichten"
                    icon="construct"
                    onPress={() => router.push('/club-cash/setup')}
                  />
                ) : null}
              </Card>
            </Section>

            <Section title={`${t('Einnahmen und Ausgaben')} ${c.year}`}>
              <Card style={{ gap: 14 }}>
                <AreaPairs areas={c.areaTotals} />
              </Card>
              <Button
                label="Alle Auswertungen ›"
                variant="outline"
                icon="stats-chart-outline"
                onPress={() => router.push('/club-cash/stats')}
              />
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
          </Columns>
        </>
      ) : null}
    </Screen>
  );
}
