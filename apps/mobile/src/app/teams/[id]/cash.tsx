import type { CashEntry, TeamCash } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  type IconName,
} from '@/components/ui';
import { formatEuro, formatShortDate } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const CATEGORY: Record<string, { label: string; icon: IconName }> = {
  strafe: { label: 'Strafe', icon: 'alert-circle-outline' },
  getraenke: { label: 'Getränke', icon: 'beer-outline' },
  einzahlung: { label: 'Einzahlung', icon: 'cash-outline' },
  sponsoring: { label: 'Sponsoring', icon: 'ribbon-outline' },
  material: { label: 'Material', icon: 'football-outline' },
  uebertrag: { label: 'Übertrag', icon: 'swap-horizontal-outline' },
  veranstaltung: { label: 'Veranstaltung', icon: 'beer-outline' },
  einnahmen_spieltag: { label: 'Spieltag', icon: 'storefront-outline' },
  einnahme: { label: 'Einnahme', icon: 'arrow-down-circle-outline' },
  ausgabe: { label: 'Ausgabe', icon: 'arrow-up-circle-outline' },
};

function EntryRow({
  entry,
  first,
  showPerson,
}: {
  entry: CashEntry;
  first: boolean;
  showPerson: boolean;
}) {
  const { colors } = useTheme();
  const cat = CATEGORY[entry.category] ?? {
    label: entry.category,
    icon: 'receipt-outline' as const,
  };
  const negative = entry.isCharge || entry.direction === 'expense';
  const subtitle = [
    formatShortDate(entry.bookedOn),
    cat.label,
    showPerson ? entry.person?.name : entry.counterparty,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      first={first}
      leading={<IconTile name={cat.icon} tone={entry.isCharge ? 'action' : 'primary'} />}
      title={entry.description}
      subtitle={subtitle}
      trailing={
        <T
          variant="label"
          color={negative ? colors.status.urgent.onContainer : colors.status.success.onContainer}
        >
          {negative ? '−' : '+'}
          {formatEuro(entry.amountCents)}
        </T>
      }
    />
  );
}

export default function CashScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const cash = useQuery({
    queryKey: ['cash', id],
    queryFn: () => api<TeamCash>(`/teams/${id}/cash`),
  });
  const c = cash.data;
  const open = (c?.members ?? []).filter((m) => m.balanceCents < 0);

  return (
    <Screen edges={[]} refreshing={cash.isRefetching} onRefresh={() => cash.refetch()}>
      {cash.isPending ? <Loading /> : null}
      {cash.error ? <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} /> : null}
      {c ? (
        <>
          {c.balanceCents !== null ? (
            <Card style={{ gap: 12, backgroundColor: colors.primary, borderColor: colors.primary }}>
              <T variant="overline" color={colors.onPrimary}>
                Aktueller Kassenstand
              </T>
              <T variant="display" color={colors.onPrimary} style={{ fontSize: 34 }}>
                {formatEuro(c.balanceCents)}
              </T>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <T variant="label" color={colors.onPrimary}>
                  Einnahmen {formatEuro(c.incomeCents ?? 0)}
                </T>
                <T variant="label" color={colors.onPrimary}>
                  Ausgaben {formatEuro(c.expenseCents ?? 0)}
                </T>
              </View>
            </Card>
          ) : null}

          {c.permissions.readCash ? (
            <Button
              label="Kassenbericht exportieren (Excel)"
              icon="download-outline"
              variant="outline"
              onPress={() =>
                void api<{ url: string }>(`/teams/${id}/cash/report-link`).then(({ url }) =>
                  Linking.openURL(url),
                )
              }
            />
          ) : null}

          {c.permissions.manageCash ? (
            <Button
              label="Buchung erfassen"
              icon="add-circle-outline"
              onPress={() => router.push(`/teams/${id}/cash-new`)}
            />
          ) : null}

          {c.personal.map((p) => (
            <Section
              key={p.personId}
              title={c.personal.length > 1 ? `Konto ${p.name}` : 'Mein Konto'}
            >
              <Card style={{ gap: 10 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <T variant="label">Saldo</T>
                  {p.balanceCents < 0 ? (
                    <Chip tone="action" label={`Offen: ${formatEuro(-p.balanceCents)}`} />
                  ) : (
                    <Chip tone="success" icon="checkmark" label="Ausgeglichen" />
                  )}
                </View>
                {p.entries.length === 0 ? (
                  <Empty icon="receipt-outline" text="Keine Buchungen." />
                ) : null}
                {p.entries.map((e, i) => (
                  <EntryRow key={e.id} entry={e} first={i === 0} showPerson={false} />
                ))}
              </Card>
            </Section>
          ))}

          {c.members ? (
            <Section title="Offene Beträge">
              <Card>
                {open.length === 0 ? (
                  <Empty icon="checkmark-circle-outline" text="Alle Konten sind ausgeglichen." />
                ) : null}
                {open.map((m, i) => (
                  <ListRow
                    key={m.personId}
                    first={i === 0}
                    title={m.name}
                    trailing={<Chip tone="action" label={formatEuro(-m.balanceCents)} />}
                  />
                ))}
              </Card>
            </Section>
          ) : null}

          {c.entries ? (
            <Section title="Letzte Buchungen">
              <Card>
                {c.entries.length === 0 ? (
                  <Empty icon="receipt-outline" text="Noch keine Buchungen." />
                ) : null}
                {c.entries.slice(0, 30).map((e, i) => (
                  <EntryRow key={e.id} entry={e} first={i === 0} showPerson />
                ))}
              </Card>
            </Section>
          ) : null}

          {c.balanceCents === null ? (
            <Card>
              <ListRow
                first
                leading={<IconTile name="lock-closed-outline" tone="archived" />}
                title="Kassenstand nicht sichtbar"
                subtitle="Den sehen nur Kassenverantwortliche und das Trainerteam."
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
