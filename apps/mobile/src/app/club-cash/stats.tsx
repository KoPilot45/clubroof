import { CLUB_CASH_AREA_LABEL, type ClubCashStats } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FundSwitcher } from '@/components/fund-switcher';
import { BarRows, ChartCard, ColumnChart, LineChart, StackBar } from '@/components/charts';
import { Card, Empty, ErrorNotice, Loading, Screen, Segment, T } from '@/components/ui';
import { useFundFilter } from '@/lib/fund-filter';
import { readSetting, writeSetting } from '@/lib/flags';
import { formatEuro, formatEuroShort, formatPercent, todayIso } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import {
  areasSentence,
  balanceSentence,
  departmentsSentence,
  feesSentence,
  flowsSentence,
  periodLabel,
  planChip,
  planSentence,
  reservesSentence,
} from '@/lib/stats-text';
import { useTheme } from '@/lib/theme';
import { Columns } from '@/components/columns';
import type { ClubCash } from '@clubroof/core';

type Topic = 'overview' | 'flows' | 'plan' | 'fees' | 'departments';
type Period = 'month' | 'quarter' | 'year' | 'season';

const TOPICS: { key: Topic; label: string }[] = [
  { key: 'overview', label: 'Überblick' },
  { key: 'flows', label: 'Einnahmen & Ausgaben' },
  { key: 'plan', label: 'Plan gegen Ist' },
  { key: 'fees', label: 'Beiträge' },
  { key: 'departments', label: 'Abteilungen' },
];

/** Zeitraum der Auswahl bis heute (Vereinszeit): Monat, Quartal, Jahr oder Saison (1. Juli). */
function rangeOf(period: Period, today: string): { from: string; to: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const pad = (n: number) => String(n).padStart(2, '0');
  if (period === 'month') return { from: `${y}-${pad(m)}-01`, to: today };
  if (period === 'quarter')
    return { from: `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`, to: today };
  if (period === 'season') return { from: `${m >= 7 ? y : y - 1}-07-01`, to: today };
  return { from: `${y}-01-01`, to: today };
}

/** Auswertungen der Vereinskasse (Paket ST): Themen-Chips und eine Zeitraumwahl für alle Karten. */
export default function ClubCashStatsScreen() {
  const { topic: topicParam } = useLocalSearchParams<{ topic?: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const [fundId, setFundId] = useFundFilter();
  const [topic, setTopic] = useState<Topic>(
    TOPICS.some((x) => x.key === topicParam) ? (topicParam as Topic) : 'overview',
  );
  const [period, setPeriod] = useState<Period>('year');
  // Zeitraum merkt sich das Gerät
  useEffect(() => {
    void readSetting('club-stats-period').then((v) => {
      if (v === 'month' || v === 'quarter' || v === 'year' || v === 'season') setPeriod(v);
    });
  }, []);
  const choose = (p: Period) => {
    setPeriod(p);
    void writeSetting('club-stats-period', p);
  };
  const today = todayIso();
  const { from, to } = rangeOf(period, today);
  const funds = useQuery({
    queryKey: ['club-cash', 'overview', 'all'],
    queryFn: () => api<ClubCash>('/club-cash'),
  });
  const stats = useQuery({
    queryKey: ['club-cash', 'stats', fundId ?? 'all', from, to],
    queryFn: () =>
      api<ClubCashStats>(
        `/club-cash/stats?from=${from}&to=${to}&interval=month${fundId ? `&fundId=${fundId}` : ''}`,
      ),
    placeholderData: (previous) => previous,
  });
  const d = stats.data;
  const c = colors.anstoss.chart;
  const labels = (d?.balance ?? []).map((b) => periodLabel(b.key));

  return (
    <Screen edges={[]} refreshing={stats.isRefetching} onRefresh={() => stats.refetch()}>
      {funds.data ? (
        <FundSwitcher funds={funds.data.funds} value={fundId} onChange={setFundId} />
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -22 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 22 }}
        accessibilityRole="tablist"
      >
        {TOPICS.filter((x) => x.key !== 'fees' || d?.fees !== null).map((x) => {
          const active = x.key === topic;
          return (
            <Pressable
              key={x.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTopic(x.key)}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : colors.surfaceRaised,
              }}
            >
              <T
                variant="label"
                color={active ? colors.onPrimary : colors.onSurface}
                style={{ fontWeight: '800' }}
              >
                {x.label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      <Segment
        value={period}
        onChange={choose}
        options={[
          { value: 'month', label: t('Monat') },
          { value: 'quarter', label: t('Quartal') },
          { value: 'year', label: t('Jahr') },
          { value: 'season', label: t('Saison') },
        ]}
      />
      {stats.isPending ? <Loading /> : null}
      {stats.error ? <ErrorNotice error={stats.error} onRetry={() => stats.refetch()} /> : null}
      {d ? (
        <View style={{ gap: 14, opacity: stats.isPlaceholderData ? 0.5 : 1 }}>
          {topic === 'overview' ? (
            <Columns min={520}>
              <ChartCard
                title="Bestand im Verlauf"
                sentence={balanceSentence(d)}
                legend={[
                  { label: t('Bestand'), color: c.income },
                  { label: t('Vorjahr'), color: colors.anstoss.textTertiary, dashed: true },
                ]}
                table={{
                  head: [t('Zeitraum'), t('Bestand'), t('Vorjahr')],
                  rows: d.balance.map((b) => [
                    periodLabel(b.key),
                    formatEuro(b.cents),
                    formatEuro(b.previousCents),
                  ]),
                }}
              >
                <LineChart
                  labels={labels}
                  readoutFormat={formatEuro}
                  series={[
                    {
                      key: 'now',
                      label: t('Bestand'),
                      color: c.income,
                      values: d.balance.map((b) => b.cents),
                      area: true,
                    },
                    {
                      key: 'prev',
                      label: t('Vorjahr'),
                      color: colors.anstoss.textTertiary,
                      values: d.balance.map((b) => b.previousCents),
                      dashed: true,
                    },
                  ]}
                />
              </ChartCard>
              <FlowsCard d={d} labels={labels} />
            </Columns>
          ) : null}

          {topic === 'flows' ? (
            <Columns min={520}>
              <FlowsCard d={d} labels={labels} />
              <ChartCard
                title="Einnahmen und Ausgaben je Bereich"
                sentence={areasSentence(d)}
                legend={[
                  { label: t('Einnahmen'), color: c.income },
                  { label: t('Ausgaben'), color: c.expense },
                ]}
                table={{
                  head: [t('Bereich'), t('Einnahmen'), t('Ausgaben'), t('Saldo')],
                  rows: d.areas.map((a) => [
                    CLUB_CASH_AREA_LABEL[a.area],
                    formatEuro(a.incomeCents),
                    formatEuro(a.expenseCents),
                    formatEuro(a.incomeCents - a.expenseCents),
                  ]),
                }}
              >
                <BarRows
                  max={Math.max(1, ...d.areas.flatMap((a) => [a.incomeCents, a.expenseCents]))}
                  rows={d.areas.flatMap((a) => [
                    {
                      key: `${a.area}-in`,
                      label: CLUB_CASH_AREA_LABEL[a.area],
                      value: a.incomeCents,
                      color: c.income,
                      valueLabel: `${t('Einnahmen')} ${formatEuro(a.incomeCents)}`,
                    },
                    {
                      key: `${a.area}-out`,
                      label: `${t('Saldo')} ${formatEuro(a.incomeCents - a.expenseCents)}`,
                      value: a.expenseCents,
                      color: c.expense,
                      valueLabel: `${t('Ausgaben')} ${formatEuro(a.expenseCents)}`,
                    },
                  ])}
                />
              </ChartCard>
            </Columns>
          ) : null}

          {topic === 'plan' ? (
            <Columns min={520}>
              {d.plan ? (
                <ChartCard
                  title="Plan gegen Ist"
                  sentence={planSentence(d)}
                  table={{
                    head: [t('Kategorie'), t('Plan'), t('Ist'), t('Anteil')],
                    rows: d.plan.lines.map((l) => [
                      l.name,
                      formatEuro(l.plannedCents),
                      formatEuro(l.actualCents),
                      planChip(l.plannedCents, l.actualCents).label,
                    ]),
                  }}
                >
                  <BarRows
                    max={120}
                    rows={d.plan.lines
                      .filter((l) => l.plannedCents > 0)
                      .map((l) => {
                        const chip = planChip(l.plannedCents, l.actualCents);
                        return {
                          key: l.categoryId,
                          label: l.name,
                          value: Math.min(120, (l.actualCents / l.plannedCents) * 100),
                          mark: 100,
                          color: l.direction === 'expense' && chip.over ? c.expense : c.income,
                          valueLabel: t(
                            `${formatEuro(l.actualCents)} von ${formatEuro(l.plannedCents)}`,
                          ),
                          chip: {
                            label: chip.label,
                            tone: l.direction === 'expense' && chip.over ? 'action' : 'neutral',
                          },
                        } as const;
                      })}
                  />
                </ChartCard>
              ) : (
                <Card>
                  <Empty
                    icon="clipboard-outline"
                    text="Für dieses Jahr gibt es keinen Haushaltsplan."
                  />
                </Card>
              )}
              {d.reserves.length ? (
                <ChartCard
                  title="Rücklagen"
                  sentence={reservesSentence(d)}
                  table={{
                    head: [t('Rücklage'), t('Stand'), t('Ziel')],
                    rows: d.reserves.map((r) => [
                      r.name,
                      formatEuro(r.balanceCents),
                      r.targetCents ? formatEuro(r.targetCents) : '–',
                    ]),
                  }}
                >
                  <BarRows
                    rows={d.reserves.map((r) => ({
                      key: r.id,
                      label: r.name,
                      value: r.targetCents
                        ? Math.min(120, (Math.max(0, r.balanceCents) / r.targetCents) * 100)
                        : 0,
                      mark: r.targetCents ? 100 : undefined,
                      color: c.aqua,
                      valueLabel: r.targetCents
                        ? t(`${formatEuro(r.balanceCents)} von ${formatEuro(r.targetCents)}`)
                        : t(`${formatEuro(r.balanceCents)}, ohne Ziel`),
                      chip: r.targetCents
                        ? {
                            label: formatPercent(
                              (Math.max(0, r.balanceCents) / r.targetCents) * 100,
                            ),
                            tone:
                              r.balanceCents >= r.targetCents
                                ? ('success' as const)
                                : ('neutral' as const),
                          }
                        : undefined,
                    }))}
                    max={120}
                  />
                </ChartCard>
              ) : null}
            </Columns>
          ) : null}

          {topic === 'fees' && d.fees ? (
            <Columns min={520}>
              <ChartCard
                title="Beitragsstatus"
                sentence={feesSentence(d)}
                table={{
                  head: [t('Status'), t('Betrag')],
                  rows: [
                    [t('bezahlt'), formatEuro(d.fees.paidCents)],
                    [t('offen'), formatEuro(d.fees.openCents - d.fees.overdueCents)],
                    [t('überfällig'), formatEuro(d.fees.overdueCents)],
                  ],
                }}
              >
                <StackBar
                  segments={[
                    {
                      key: 'paid',
                      label: t('bezahlt'),
                      color: colors.status.success.solid,
                      cents: d.fees.paidCents,
                    },
                    {
                      key: 'open',
                      label: t('offen'),
                      color: colors.status.action.solid,
                      cents: d.fees.openCents - d.fees.overdueCents,
                    },
                    {
                      key: 'overdue',
                      label: t('überfällig'),
                      color: colors.status.urgent.solid,
                      cents: d.fees.overdueCents,
                    },
                  ]}
                />
              </ChartCard>
              <ChartCard
                title="Beitragseingang je Monat"
                table={{
                  head: [t('Zeitraum'), t('Eingang')],
                  rows: d.fees.received.map((r) => [periodLabel(r.key), formatEuro(r.cents)]),
                }}
              >
                <ColumnChart
                  labels={d.fees.received.map((r) => periodLabel(r.key))}
                  readoutFormat={formatEuro}
                  series={[
                    {
                      key: 'in',
                      label: t('Eingang'),
                      color: c.income,
                      values: d.fees.received.map((r) => r.cents),
                    },
                  ]}
                />
              </ChartCard>
            </Columns>
          ) : null}

          {topic === 'departments' ? (
            d.departments.length ? (
              <ChartCard
                title="Ausgaben je Abteilung"
                sentence={departmentsSentence(d)}
                table={{
                  head: [t('Abteilung'), t('Ausgaben')],
                  rows: d.departments.map((x) => [x.name, formatEuro(x.expenseCents)]),
                }}
              >
                <BarRows
                  rows={d.departments.map((x) => ({
                    key: x.id,
                    label: x.name,
                    value: x.expenseCents,
                    color: c.expense,
                    valueLabel: formatEuro(x.expenseCents),
                  }))}
                />
              </ChartCard>
            ) : (
              <Card>
                <Empty
                  icon="people-outline"
                  text="Im Zeitraum gibt es keine Ausgaben je Abteilung."
                />
              </Card>
            )
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

/** Einnahmen und Ausgaben je Monat als gruppierte Säulen (Blau/Orange). */
function FlowsCard({ d, labels }: { d: ClubCashStats; labels: string[] }) {
  const { colors } = useTheme();
  const c = colors.anstoss.chart;
  return (
    <ChartCard
      title="Einnahmen und Ausgaben je Monat"
      sentence={flowsSentence(d)}
      legend={[
        { label: t('Einnahmen'), color: c.income },
        { label: t('Ausgaben'), color: c.expense },
      ]}
      table={{
        head: [t('Zeitraum'), t('Einnahmen'), t('Ausgaben'), t('Saldo')],
        rows: d.flows.map((f) => [
          periodLabel(f.key),
          formatEuro(f.incomeCents),
          formatEuro(f.expenseCents),
          formatEuro(f.incomeCents - f.expenseCents),
        ]),
      }}
    >
      <ColumnChart
        labels={labels}
        format={formatEuroShort}
        readoutFormat={formatEuro}
        series={[
          {
            key: 'in',
            label: t('Einnahmen'),
            color: c.income,
            values: d.flows.map((f) => f.incomeCents),
          },
          {
            key: 'out',
            label: t('Ausgaben'),
            color: c.expense,
            values: d.flows.map((f) => f.expenseCents),
          },
        ]}
      />
    </ChartCard>
  );
}
