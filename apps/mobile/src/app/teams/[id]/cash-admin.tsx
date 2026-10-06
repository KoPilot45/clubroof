import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { ActionError, paymentLabel, useCash, useCashAction } from '@/components/cash';
import {
  Button,
  Card,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { formatAgo, formatEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

/** Kassenverwaltung für Kassenwart und Trainerteam: alle Funktionen als Kacheln. */
export default function CashAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const cash = useCash(id);
  const decide = useCashAction(id);
  const [reminded, setReminded] = useState<number | null>(null);
  const remind = useMutation({
    mutationFn: () =>
      api<{ sent: number }>(`/teams/${id}/cash/reminders`, { method: 'POST', body: {} }),
    onSuccess: (r) => setReminded(r.sent),
  });
  if (cash.isPending) return <Loading />;
  if (cash.error) return <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} />;
  const c = cash.data;
  const full = c.permissions.manageCash;
  const go = (path: string) => () => router.push(`/teams/${id}/${path}` as never);
  const open = (c.members ?? []).filter((m) => m.balanceCents < 0);
  const pending = c.paymentNotices.filter((n) => n.status === 'pending');

  const tiles: TileItem[] = [
    ...(full
      ? [
          {
            key: 'booking',
            label: 'Einnahme / Ausgabe',
            icon: 'swap-vertical' as const,
            onPress: go('cash-new'),
          },
          {
            key: 'payments',
            label: 'Einzahlungen',
            icon: 'cash' as const,
            hint: 'auch mehrere auf einmal',
            onPress: go('cash-payments'),
          },
        ]
      : []),
    ...(c.config.fines && c.permissions.manageFines
      ? [
          {
            key: 'fine',
            label: 'Strafe vergeben',
            icon: 'hand-left' as const,
            onPress: go('cash-new?kind=fine'),
          },
        ]
      : []),
    ...(full && c.config.drinks
      ? [
          {
            key: 'drinks',
            label: 'Getränke-Strichliste',
            icon: 'beer' as const,
            onPress: go('cash-drinks'),
          },
        ]
      : []),
    ...(full
      ? [
          {
            key: 'levy',
            label: 'Umlage',
            icon: 'people' as const,
            hint: 'Kosten aufteilen',
            onPress: go('cash-levy'),
          },
          {
            key: 'fees',
            label: 'Beiträge',
            icon: 'repeat' as const,
            hint: c.fees.length ? `${c.fees.length} aktiv` : 'regelmäßig fordern',
            onPress: go('cash-fees'),
          },
          {
            key: 'entries',
            label: 'Buchungen & Storno',
            icon: 'receipt' as const,
            onPress: go('cash-entries'),
          },
          {
            key: 'treasurers',
            label: 'Kassenwart',
            icon: 'person-add' as const,
            hint: c.treasurers[0]?.name ?? 'bestimmen',
            onPress: go('cash-treasurers'),
          },
          {
            key: 'settings',
            label: 'Bezahlinfos & Einstellungen',
            icon: 'settings' as const,
            onPress: go('cash-settings'),
          },
          {
            key: 'closings',
            label: 'Kassenprüfung',
            icon: 'shield-checkmark' as const,
            hint: c.closings[0]
              ? `zuletzt ${c.closings[0].closedOn.split('-').reverse().join('.')}`
              : undefined,
            onPress: go('cash-closings'),
          },
        ]
      : []),
    ...(c.config.fines
      ? [{ key: 'catalog', label: 'Strafenkatalog', icon: 'list' as const, onPress: go('fines') }]
      : []),
  ];

  return (
    <Screen edges={[]} refreshing={cash.isRefetching} onRefresh={() => cash.refetch()}>
      <TileGrid items={tiles} />

      {full && pending.length ? (
        <Section title={`Zahlungsmeldungen (${pending.length})`}>
          <Card>
            {pending.map((n, i) => (
              <View key={n.id} style={{ gap: 8, paddingBottom: 10 }}>
                <ListRow
                  first={i === 0}
                  title={`${n.name}: ${formatEuro(n.amountCents)}`}
                  subtitle={[paymentLabel(n.paymentMethod), formatAgo(n.createdAt), n.note]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    label="Eingegangen"
                    icon="checkmark"
                    size="sm"
                    variant="tonal"
                    loading={decide.isPending && decide.variables?.path.includes(n.id)}
                    onPress={() =>
                      decide.mutate({
                        path: `/cash/payment-notices/${n.id}/confirm`,
                        method: 'POST',
                      })
                    }
                  />
                  <Button
                    label="Nicht gefunden"
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      decide.mutate({
                        path: `/cash/payment-notices/${n.id}/reject`,
                        method: 'POST',
                      })
                    }
                  />
                </View>
              </View>
            ))}
            <ActionError error={decide.error} />
          </Card>
        </Section>
      ) : null}

      {full ? (
        <Section title="Offene Beträge">
          <Card style={{ gap: 10 }}>
            <T variant="label">
              {open.length
                ? `${open.length} ${open.length === 1 ? 'Person' : 'Personen'} · zusammen ${formatEuro(open.reduce((a, m) => a - m.balanceCents, 0))}`
                : 'Alle Konten sind ausgeglichen.'}
            </T>
            {open.length ? (
              <Button
                label="Alle an offene Beträge erinnern"
                icon="notifications-outline"
                variant="outline"
                size="sm"
                style={{ alignSelf: 'flex-start' }}
                loading={remind.isPending}
                onPress={() => remind.mutate()}
              />
            ) : null}
            {reminded !== null ? (
              <Chip
                tone="success"
                icon="checkmark"
                label={
                  reminded
                    ? `${reminded} ${reminded === 1 ? 'Erinnerung' : 'Erinnerungen'} verschickt`
                    : 'Heute schon erinnert'
                }
              />
            ) : null}
            <T variant="caption">
              {c.settings.autoReminder
                ? 'Automatische Erinnerung am Monatsersten ist an.'
                : 'Automatische Erinnerung lässt sich unter „Bezahlinfos & Einstellungen“ einschalten.'}
            </T>
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
