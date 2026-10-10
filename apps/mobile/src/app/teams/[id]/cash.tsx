import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';
import { EntryRow, paymentLabel, useCash } from '@/components/cash';
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
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Saldo als Fläche: offen = Aktionsfarbe, Guthaben = Erfolgsfarbe, ausgeglichen = neutral. */
function SaldoBlock({ balanceCents }: { balanceCents: number }) {
  const { colors, radii } = useTheme();
  const tone =
    balanceCents < 0 ? colors.status.action : balanceCents > 0 ? colors.status.success : null;
  const fg = tone?.onContainer ?? colors.onSurface;
  return (
    <View
      style={{
        flex: 1,
        gap: 2,
        padding: 14,
        borderRadius: radii.lg,
        backgroundColor: tone?.container ?? colors.surfaceVariant,
      }}
    >
      <T variant="overline" color={fg}>
        Saldo
      </T>
      <T variant="figure" color={fg} style={{ fontSize: 32 }}>
        {formatEuro(balanceCents)}
      </T>
      <T variant="label" color={fg}>
        {balanceCents < 0 ? 'Offen' : balanceCents > 0 ? 'Guthaben' : 'Ausgeglichen'}
      </T>
    </View>
  );
}

export default function CashScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const cash = useCash(id);
  const c = cash.data;
  const open = (c?.members ?? []).filter((m) => m.balanceCents < 0);
  const manage = !!c && (c.permissions.manageCash || c.permissions.manageFines);
  const report = (format: 'csv' | 'pdf') =>
    void api<{ url: string }>(`/teams/${id}/cash/report-link?format=${format}`).then(({ url }) =>
      Linking.openURL(url),
    );

  const tiles: TileItem[] = c
    ? [
        ...(manage
          ? [
              {
                key: 'admin',
                label: 'Kassenverwaltung',
                icon: 'briefcase' as const,
                badge: c.paymentNotices.filter((n) => n.status === 'pending').length || undefined,
                onPress: () => router.push(`/teams/${id}/cash-admin`),
              },
            ]
          : []),
        ...(c.balanceCents !== null
          ? [
              {
                key: 'stats',
                label: 'Statistik',
                icon: 'bar-chart' as const,
                onPress: () => router.push(`/teams/${id}/cash-stats`),
              },
              {
                key: 'entries',
                label: 'Alle Buchungen',
                icon: 'receipt' as const,
                onPress: () => router.push(`/teams/${id}/cash-entries`),
              },
            ]
          : []),
        ...(c.config.fines
          ? [
              {
                key: 'catalog',
                label: 'Strafenkatalog',
                icon: 'list' as const,
                hint: `${c.fineCatalog.length} Strafen`,
                onPress: () => router.push(`/teams/${id}/fines`),
              },
            ]
          : []),
        ...(c.balanceCents !== null
          ? [
              {
                key: 'excel',
                label: 'Bericht (Excel)',
                icon: 'grid' as const,
                onPress: () => report('csv'),
              },
              {
                key: 'pdf',
                label: 'Bericht (PDF)',
                icon: 'document' as const,
                onPress: () => report('pdf'),
              },
            ]
          : []),
      ]
    : [];

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
              <T variant="figure" color={colors.onPrimary} style={{ fontSize: 44 }}>
                {formatEuro(c.balanceCents)}
              </T>
              <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                <T variant="label" color={colors.onPrimary}>
                  Einnahmen {formatEuro(c.incomeCents ?? 0)}
                </T>
                <T variant="label" color={colors.onPrimary}>
                  Ausgaben {formatEuro(c.expenseCents ?? 0)}
                </T>
              </View>
              {c.treasurers.length ? (
                <T variant="caption" color={colors.onPrimary}>
                  Kassenwart: {c.treasurers.map((t) => t.name).join(', ')}
                </T>
              ) : null}
            </Card>
          ) : null}

          <TileGrid items={tiles} />

          {c.personal.map((p) => {
            const notices = c.paymentNotices.filter(
              (n) => n.personId === p.personId && n.status === 'pending',
            );
            return (
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
                    <SaldoBlock balanceCents={p.balanceCents} />
                  </View>
                  {notices.map((n) => (
                    <Chip
                      key={n.id}
                      tone="info"
                      icon="time-outline"
                      label={`Gemeldet: ${formatEuro(n.amountCents)} (${paymentLabel(n.paymentMethod)}) – wartet auf Bestätigung`}
                    />
                  ))}
                  {p.balanceCents < 0 ? (
                    <Button
                      label="Bezahlen / Zahlung melden"
                      icon="card-outline"
                      variant="tonal"
                      size="sm"
                      style={{ alignSelf: 'flex-start' }}
                      onPress={() =>
                        router.push(
                          `/teams/${id}/cash-pay?personId=${p.personId}&amount=${-p.balanceCents}`,
                        )
                      }
                    />
                  ) : null}
                  {p.entries.length === 0 ? (
                    <Empty icon="receipt-outline" text="Keine Buchungen." />
                  ) : null}
                  {p.entries.slice(0, 10).map((e, i) => (
                    <EntryRow key={e.id} entry={e} first={i === 0} showPerson={false} />
                  ))}
                </Card>
              </Section>
            );
          })}

          {c.members ? (
            <Section title="Offene Beträge in der Mannschaft">
              <Card>
                {open.length === 0 ? (
                  <Empty icon="checkmark-circle-outline" text="Alle Konten sind ausgeglichen." />
                ) : null}
                {open.map((m, i) => (
                  <ListRow
                    key={m.personId}
                    first={i === 0}
                    title={m.name}
                    subtitle={c.permissions.manageCash ? 'Antippen: als bezahlt buchen' : undefined}
                    onPress={
                      c.permissions.manageCash
                        ? () =>
                            router.push(
                              `/teams/${id}/cash-payments?personId=${m.personId}&amount=${-m.balanceCents}`,
                            )
                        : undefined
                    }
                    trailing={<Chip tone="action" label={formatEuro(-m.balanceCents)} />}
                  />
                ))}
              </Card>
            </Section>
          ) : null}

          {c.entries ? (
            <Section
              title="Letzte Buchungen"
              action="Alle anzeigen"
              onAction={() => router.push(`/teams/${id}/cash-entries`)}
            >
              <Card>
                {c.entries.length === 0 ? (
                  <Empty icon="receipt-outline" text="Noch keine Buchungen." />
                ) : null}
                {c.entries.slice(0, 8).map((e, i) => (
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
                subtitle="Den sieht nur die Mannschaft selbst."
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
