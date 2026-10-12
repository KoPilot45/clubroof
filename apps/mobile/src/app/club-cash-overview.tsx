import { CLUB_CASH_AREA_LABEL, type ClubCash, type ClubFees } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import {
  Card,
  Chip,
  ErrorNotice,
  HeroCard,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/**
 * Kassenübersicht für den Vorstand (Paket K6): reine Anzeige – Kassenstand, Einnahmen und Ausgaben,
 * Beitragsquote. Keine Buchungen, Belege oder Funktionen. Erscheint nur, wenn der Verein die
 * Auswertung in „Wer darf die Kasse einsehen?“ freigibt.
 */
export default function ClubCashOverviewScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const fees = useQuery({
    queryKey: ['club-fees', 'summary'],
    queryFn: () => api<ClubFees>('/club-cash/fees?status=open'),
  });
  const c = cash.data;
  const f = fees.data?.summary;
  const income = c?.areaTotals.reduce((sum, a) => sum + a.incomeCents, 0) ?? 0;
  const expense = c?.areaTotals.reduce((sum, a) => sum + a.expenseCents, 0) ?? 0;
  const feeBase = f ? f.paidThisYearCents + f.openCents : 0;
  const quota = feeBase > 0 ? Math.round(((f?.paidThisYearCents ?? 0) / feeBase) * 100) : null;

  return (
    <Screen edges={[]} refreshing={cash.isRefetching} onRefresh={() => cash.refetch()}>
      {cash.isPending ? <Loading /> : null}
      {cash.error ? <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} /> : null}
      {c ? (
        <>
          <HeroCard>
            <T variant="overline" color={colors.hero.onHero}>
              Kassenstand gesamt
            </T>
            <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 44 }}>
              {formatEuro(c.totalBalanceCents)}
            </T>
            <T variant="caption" color={colors.hero.onHero}>
              Nur zur Ansicht – ohne Buchungen und Belege.
            </T>
          </HeroCard>

          <Section title={`${t('Einnahmen und Ausgaben')} ${c.year}`}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Chip
                  tone="success"
                  icon="arrow-down"
                  label={`${t('Einnahmen')} ${formatEuro(income)}`}
                />
                <Chip
                  tone="action"
                  icon="arrow-up"
                  label={`${t('Ausgaben')} ${formatEuro(expense)}`}
                />
              </View>
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

          {c.funds.filter((k) => !k.archived).length > 1 ? (
            <Section title="Kassen">
              <Card>
                {c.funds
                  .filter((k) => !k.archived)
                  .map((k, i) => (
                    <ListRow
                      key={k.id}
                      first={i === 0}
                      leading={<IconTile name="wallet" tone="blue" />}
                      title={k.name}
                      subtitle={k.units.map((u) => u.name).join(', ') || undefined}
                      trailing={<Chip tone="neutral" label={formatEuro(k.balanceCents)} />}
                    />
                  ))}
              </Card>
            </Section>
          ) : null}

          {f ? (
            <Section title="Mitgliedsbeiträge">
              <Card style={{ gap: 6 }}>
                <T variant="label" style={{ fontWeight: '700' }}>
                  {quota === null ? t('Noch keine Beiträge') : `${t('Beitragsquote')} ${quota} %`}
                </T>
                <T variant="caption">
                  {`${t('Eingegangen')} ${formatEuro(f.paidThisYearCents)} · ${t('Offen')} ${formatEuro(f.openCents)} · ${t('Überfällig')} ${formatEuro(f.overdueCents)}`}
                </T>
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
