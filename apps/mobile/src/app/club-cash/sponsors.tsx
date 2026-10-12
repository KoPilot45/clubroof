import type { ClubSponsorIncome } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  ChoiceChips,
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
} from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Sponsoren-Einnahmen (Paket K5): Einnahmen im Kassenbuch, die einem Sponsor zugeordnet sind, je Jahr. */
export default function SponsorIncomeScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const data = useQuery({
    queryKey: ['club-sponsor-income', year],
    queryFn: () => api<ClubSponsorIncome>(`/club-cash/sponsor-income?year=${year}`),
  });
  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const thisYear = new Date().getFullYear();
  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      <ChoiceChips
        scroll
        selected={[String(year)]}
        onToggle={(v) => setYear(Number(v))}
        options={[thisYear - 1, thisYear].map((y) => ({ value: String(y), label: String(y) }))}
      />
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          {`${t('Sponsoren-Einnahmen')} ${year}`}
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
          {formatEuro(d.total)}
        </T>
      </HeroCard>
      <Section title="Je Sponsor">
        <Card>
          {d.sponsors.length === 0 ? (
            <Empty icon="heart-outline" text="Noch keine Einnahme einem Sponsor zugeordnet." />
          ) : null}
          {d.sponsors.map((s, i) => (
            <ListRow
              key={s.id ?? s.name}
              first={i === 0}
              leading={<IconTile name="heart" tone="pink" />}
              title={s.name}
              subtitle={s.count === 1 ? t('1 Buchung') : t(`${s.count} Buchungen`)}
              trailing={<Chip tone="neutral" label={formatEuro(s.cents)} />}
            />
          ))}
        </Card>
      </Section>
      {d.canManage ? (
        <Button
          label="Einnahme von einem Sponsor buchen"
          icon="add"
          variant="outline"
          onPress={() => router.push('/club-cash/new?kind=income')}
        />
      ) : null}
      <T variant="caption">
        Beim Buchen einer Einnahme wählst du den Sponsor aus (Verein → Sponsoren).
      </T>
    </Screen>
  );
}
