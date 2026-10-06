import type { CashStats } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { BalanceBars, HorizontalBars, IncomeExpenseBars } from '@/components/cash-charts';
import {
  Card,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  Stat,
  T,
} from '@/components/ui';
import { cashCategory } from '@/lib/cash';
import { formatEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

/** Kassenstatistik der Saison – für die ganze Mannschaft. */
export default function CashStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const stats = useQuery({
    queryKey: ['cash-stats', id],
    queryFn: () => api<CashStats>(`/teams/${id}/cash/stats`),
  });
  const d = stats.data;
  const last = d?.months.at(-1);
  return (
    <Screen edges={[]} refreshing={stats.isRefetching} onRefresh={() => stats.refetch()}>
      {stats.isPending ? <Loading /> : null}
      {stats.error ? <ErrorNotice error={stats.error} onRetry={() => stats.refetch()} /> : null}
      {d ? (
        <>
          <Card style={{ gap: 8 }}>
            <T variant="overline">Saison auf einen Blick</T>
            <View style={{ flexDirection: 'row' }}>
              <Stat value={formatEuro(last?.balanceCents ?? 0)} label="Kassenstand" />
              <Stat value={formatEuro(d.openCents)} label="noch offen" />
              <Stat value={d.paidRate === null ? '–' : `${d.paidRate} %`} label="bezahlt" />
            </View>
          </Card>

          {d.months.length > 0 ? (
            <>
              <Section title="Kassenstand je Monat">
                <Card>
                  <BalanceBars months={d.months} />
                </Card>
              </Section>
              <Section title="Einnahmen und Ausgaben">
                <Card>
                  <IncomeExpenseBars months={d.months} />
                </Card>
              </Section>
            </>
          ) : null}

          <Section title="Nach Kategorie">
            <Card>
              {d.categories.length === 0 ? (
                <Empty icon="receipt-outline" text="Noch keine Buchungen in dieser Saison." />
              ) : (
                <HorizontalBars
                  rows={d.categories.map((c) => ({
                    key: c.category,
                    label: cashCategory(c.category).label,
                    value: c.incomeCents + c.expenseCents,
                    valueLabel:
                      c.incomeCents && c.expenseCents
                        ? `+${formatEuro(c.incomeCents)} / −${formatEuro(c.expenseCents)}`
                        : c.incomeCents
                          ? `+${formatEuro(c.incomeCents)}`
                          : `−${formatEuro(c.expenseCents)}`,
                  }))}
                />
              )}
            </Card>
          </Section>

          {d.fines.length ? (
            <Section title="Strafen nach Art">
              <Card>
                <HorizontalBars
                  rows={d.fines.map((f) => ({
                    key: f.name,
                    label: f.name,
                    value: f.count,
                    valueLabel: `${f.count}× · ${formatEuro(f.amountCents)}`,
                  }))}
                />
              </Card>
            </Section>
          ) : null}

          {d.finesByPerson.length ? (
            <Section title="Strafen je Person">
              <Card>
                {d.finesByPerson.map((p, i) => (
                  <ListRow
                    key={p.personId}
                    first={i === 0}
                    title={p.name}
                    subtitle={`${p.count} ${p.count === 1 ? 'Strafe' : 'Strafen'} · ${formatEuro(p.amountCents)}`}
                    trailing={
                      p.openCents > 0 ? (
                        <Chip tone="action" label={`offen ${formatEuro(p.openCents)}`} />
                      ) : (
                        <Chip tone="success" icon="checkmark" label="bezahlt" />
                      )
                    }
                  />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
