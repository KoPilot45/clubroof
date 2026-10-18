import { Columns } from '@/components/columns';
import type { CashStats } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { HorizontalBars } from '@/components/cash-charts';
import { BarRows, ChartCard, ColumnChart, LineChart, StackBar } from '@/components/charts';
import { Card, Empty, ErrorNotice, Loading, Screen, Section, Stat, T } from '@/components/ui';
import { cashCategory } from '@/lib/cash';
import { formatEuro, formatPercent } from '@/lib/format';
import { t } from '@/lib/i18n';
import { periodLabel } from '@/lib/stats-text';
import { useTheme } from '@/lib/theme';
import type { StackSegment } from '@/components/charts';
import { useSignedIn } from '@/lib/session';

/** Kassenstatistik der Saison – für die ganze Mannschaft. */
export default function CashStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const stats = useQuery({
    queryKey: ['cash-stats', id],
    queryFn: () => api<CashStats>(`/teams/${id}/cash/stats`),
  });
  const { colors } = useTheme();
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

          <Columns min={460} gap={24}>
            {d.months.length > 0 ? (
              <ChartCard
                title="Kassenstand seit Saisonbeginn"
                sentence={balanceSentence(d)}
                table={{
                  head: [t('Monat'), t('Kassenstand')],
                  rows: d.months.map((m) => [periodLabel(m.month), formatEuro(m.balanceCents)]),
                }}
              >
                <LineChart
                  labels={d.months.map((m) => periodLabel(m.month))}
                  readoutFormat={formatEuro}
                  series={[
                    {
                      key: 'balance',
                      label: t('Kassenstand'),
                      color: colors.primary,
                      values: d.months.map((m) => m.balanceCents),
                      area: true,
                    },
                  ]}
                />
              </ChartCard>
            ) : null}
            {d.months.length > 0 ? (
              <ChartCard
                title="Einnahmen und Ausgaben je Monat"
                legend={[
                  { label: t('Einnahmen'), color: colors.anstoss.chart.income },
                  { label: t('Ausgaben'), color: colors.anstoss.chart.expense },
                ]}
                table={{
                  head: [t('Monat'), t('Einnahmen'), t('Ausgaben')],
                  rows: d.months.map((m) => [
                    periodLabel(m.month),
                    formatEuro(m.incomeCents),
                    formatEuro(m.expenseCents),
                  ]),
                }}
              >
                <ColumnChart
                  labels={d.months.map((m) => periodLabel(m.month))}
                  readoutFormat={formatEuro}
                  series={[
                    {
                      key: 'in',
                      label: t('Einnahmen'),
                      color: colors.anstoss.chart.income,
                      values: d.months.map((m) => m.incomeCents),
                    },
                    {
                      key: 'out',
                      label: t('Ausgaben'),
                      color: colors.anstoss.chart.expense,
                      values: d.months.map((m) => m.expenseCents),
                    },
                  ]}
                />
              </ChartCard>
            ) : null}

            {d.goal ? (
              <ChartCard
                title="Sparziel"
                sentence={t(
                  `${d.goal.name}: ${formatEuro(d.goal.balanceCents)} von ${formatEuro(d.goal.targetCents)} – ${formatPercent(Math.min(100, (d.goal.balanceCents / d.goal.targetCents) * 100))} erreicht.`,
                )}
                table={{
                  head: [t('Ziel'), t('Stand'), t('Fehlt')],
                  rows: [
                    [
                      d.goal.name,
                      formatEuro(d.goal.balanceCents),
                      formatEuro(Math.max(0, d.goal.targetCents - d.goal.balanceCents)),
                    ],
                  ],
                }}
              >
                <BarRows
                  max={d.goal.targetCents}
                  rows={[
                    {
                      key: 'goal',
                      label: d.goal.name,
                      value: Math.max(0, d.goal.balanceCents),
                      mark: d.goal.targetCents,
                      color: colors.anstoss.chart.aqua,
                      valueLabel: t(
                        `${formatEuro(d.goal.balanceCents)} von ${formatEuro(d.goal.targetCents)}`,
                      ),
                      chip: {
                        label: formatPercent(
                          Math.min(100, (d.goal.balanceCents / d.goal.targetCents) * 100),
                        ),
                        tone: d.goal.balanceCents >= d.goal.targetCents ? 'success' : 'neutral',
                      },
                    },
                  ]}
                />
              </ChartCard>
            ) : null}

            {d.sources.length ? (
              <ChartCard
                title="Woher das Geld kommt"
                sentence={sourcesSentence(d.sources)}
                table={{
                  head: [t('Art'), t('Betrag')],
                  rows: d.sources.map((x) => [cashCategory(x.category).label, formatEuro(x.cents)]),
                }}
              >
                <StackBar segments={sourceSegments(d.sources, colors)} />
              </ChartCard>
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
              <ChartCard
                title="Strafen nach Art"
                sentence={t(
                  `${d.fines[0]!.name} wurde am häufigsten vergeben (${d.fines[0]!.count}×).`,
                )}
                table={{
                  head: [t('Art'), t('Anzahl'), t('Summe')],
                  rows: d.fines.map((f) => [f.name, String(f.count), formatEuro(f.amountCents)]),
                }}
              >
                <BarRows
                  rows={d.fines.map((f, i) => ({
                    key: f.name,
                    label: f.name,
                    value: f.count,
                    color: i === 0 ? colors.primary : colors.anstoss.textTertiary,
                    valueLabel: `${f.count}× · ${formatEuro(f.amountCents)}`,
                  }))}
                />
              </ChartCard>
            ) : null}

            {d.finesByPerson.length ? (
              <ChartCard
                title="Strafen je Person"
                sentence={finesSentence(d.finesByPerson)}
                table={{
                  head: [t('Person'), t('Strafen'), t('Summe'), t('offen')],
                  rows: d.finesByPerson.map((p) => [
                    p.name,
                    String(p.count),
                    formatEuro(p.amountCents),
                    formatEuro(p.openCents),
                  ]),
                }}
              >
                <BarRows
                  rows={d.finesByPerson.map((p, i) => ({
                    key: p.personId,
                    label: p.name,
                    value: p.amountCents,
                    color: i === 0 ? colors.primary : colors.anstoss.textTertiary,
                    valueLabel: t(
                      `${p.count} ${p.count === 1 ? 'Strafe' : 'Strafen'} · ${formatEuro(p.amountCents)}`,
                    ),
                  }))}
                />
              </ChartCard>
            ) : null}

            {d.drinksByPerson.length ? (
              <ChartCard
                title="Getränke je Person"
                sentence={t(
                  `${d.drinksByPerson[0]!.name} hat mit ${d.drinksByPerson[0]!.count} Getränken am meisten.`,
                )}
                table={{
                  head: [t('Person'), t('Getränke'), t('Summe')],
                  rows: d.drinksByPerson.map((p) => [
                    p.name,
                    String(p.count),
                    formatEuro(p.amountCents),
                  ]),
                }}
              >
                <BarRows
                  rows={d.drinksByPerson.map((p, i) => ({
                    key: p.personId,
                    label: p.name,
                    value: p.amountCents,
                    color: i === 0 ? colors.anstoss.chart.aqua : colors.anstoss.textTertiary,
                    valueLabel: `${p.count}× · ${formatEuro(p.amountCents)}`,
                  }))}
                />
              </ChartCard>
            ) : null}

            {d.moral.length ? (
              <ChartCard
                title="Zahlungsmoral"
                sentence={moralSentence(d.moral)}
                table={{
                  head: [t('Person'), t('Soll'), t('bezahlt'), t('offen')],
                  rows: d.moral.map((p) => [
                    p.name,
                    formatEuro(p.chargedCents),
                    formatEuro(p.chargedCents - p.openCents),
                    formatEuro(p.openCents),
                  ]),
                }}
              >
                <BarRows
                  max={Math.max(1, ...d.moral.map((p) => p.chargedCents))}
                  rows={d.moral.map((p) => ({
                    key: p.personId,
                    label: p.name,
                    value: p.chargedCents - p.openCents,
                    mark: p.chargedCents,
                    color: colors.status.success.solid,
                    valueLabel:
                      p.openCents > 0 ? t(`offen ${formatEuro(p.openCents)}`) : t('alles bezahlt'),
                    chip: p.openCents > 0 ? { label: t('▲ offen'), tone: 'action' } : undefined,
                  }))}
                />
              </ChartCard>
            ) : null}
          </Columns>
        </>
      ) : null}
    </Screen>
  );
}

const names = (list: { name: string }[]) => list.map((p) => p.name).join(', ');

/** Aussage zu den Strafen: wer vorn liegt. */
function finesSentence(list: CashStats['finesByPerson']): string | null {
  const top = list[0];
  if (!top) return null;
  return t(`${top.name} liegt mit ${formatEuro(top.amountCents)} vorn.`);
}

/** Aussage zur Zahlungsmoral: wie viele noch offen haben. */
function moralSentence(list: CashStats['moral']): string | null {
  const open = list.filter((p) => p.openCents > 0);
  if (open.length === 0) return t('Alle haben ihre Forderungen bezahlt.');
  return open.length === 1
    ? t(`1 Person hat noch offen: ${names(open)}.`)
    : t(`${open.length} Personen haben noch offen.`);
}

/** Aussage zum Kassenstand: Veränderung seit Saisonbeginn. */
function balanceSentence(d: CashStats): string | null {
  const first = d.months[0];
  const last = d.months.at(-1);
  if (!first || !last || d.months.length < 2) return null;
  const diff = last.balanceCents - first.balanceCents;
  return diff >= 0
    ? t(`Seit ${periodLabel(first.month, true)} ist die Kasse um ${formatEuro(diff)} gewachsen.`)
    : t(
        `Seit ${periodLabel(first.month, true)} ist die Kasse um ${formatEuro(-diff)} geschrumpft.`,
      );
}

/** Aussage zur Herkunft: größte Quelle mit Anteil. */
function sourcesSentence(list: CashStats['sources']): string | null {
  const total = list.reduce((sum, x) => sum + x.cents, 0);
  const top = list[0];
  if (!top || total === 0) return null;
  return t(
    `Am meisten kommt aus ${cashCategory(top.category).label} (${formatPercent((top.cents / total) * 100)}).`,
  );
}

/** Farbe folgt der Sache (feste Reihenfolge); mehr als vier Quellen werden zu „Sonstige“ gefaltet. */
function sourceSegments(
  list: CashStats['sources'],
  colors: ReturnType<typeof useTheme>['colors'],
): StackSegment[] {
  const c = colors.anstoss.chart;
  const FIXED: Record<string, string> = {
    strafe: c.expense,
    getraenke: c.aqua,
    umlage: c.yellow,
    beitrag: c.income,
  };
  const known = list.filter((x) => FIXED[x.category]);
  const rest = list.filter((x) => !FIXED[x.category]);
  const segments: StackSegment[] = known.map((x) => ({
    key: x.category,
    label: cashCategory(x.category).label,
    color: FIXED[x.category]!,
    cents: x.cents,
  }));
  const other = rest.reduce((sum, x) => sum + x.cents, 0);
  if (other > 0)
    segments.push({
      key: 'other',
      label: t('Sonstige'),
      color: colors.anstoss.textTertiary,
      cents: other,
    });
  return segments;
}
