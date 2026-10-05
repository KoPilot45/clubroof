import type { ExchangeOverview, PlayerDemand } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { formatDay, formatTime, formatShortDate, plural } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

function DemandCard({ demand }: { demand: PlayerDemand }) {
  const open = demand.count - demand.filled;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/exchange/${demand.id}`)}
        style={{ gap: 6 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TeamBadge badge={demand.team.badge} />
          <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {demand.event.title}
          </T>
        </View>
        <T variant="caption">
          {formatDay(demand.event.startsAt)}, {formatTime(demand.event.startsAt)} Uhr
          {demand.event.location ? ` · ${demand.event.location}` : ''}
        </T>
        <T variant="body">
          {plural(demand.count, 'Spieler', 'Spieler')} gesucht
          {demand.positions.length ? ` (${demand.positions.join(', ')})` : ''}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {demand.status === 'fulfilled' ? (
            <Chip tone="success" icon="checkmark-circle" label="Gedeckt" />
          ) : (
            <Chip tone="action" label={`Noch ${open} offen`} />
          )}
          {demand.mine ? <Chip tone="neutral" label="Meine Mannschaft" /> : null}
          {demand.canNominate && demand.status === 'open' ? (
            <Chip tone="primary" icon="person-add" label="Du kannst Spieler abstellen" />
          ) : null}
        </View>
      </Pressable>
    </Card>
  );
}

export default function ExchangeScreen() {
  const { api } = useSignedIn();
  const overview = useQuery({
    queryKey: ['exchange'],
    queryFn: () => api<ExchangeOverview>('/exchange'),
  });
  const o = overview.data;
  const open = (o?.demands ?? []).filter((d) => d.status === 'open');
  const done = (o?.demands ?? []).filter((d) => d.status !== 'open');
  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <T variant="caption">
        Mannschaften melden Spielerbedarf oder bieten Spieler an. Abgestellt wird immer durch den
        Trainer der abgebenden Mannschaft – andere sehen nur, wie viele Spieler verfügbar sind.
      </T>
      {overview.isPending ? <Loading /> : null}
      {overview.error ? (
        <ErrorNotice message={overview.error.message} onRetry={() => overview.refetch()} />
      ) : null}
      {o ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              label="Bedarf melden"
              icon="add-circle"
              onPress={() => router.push('/exchange/new-demand')}
              style={{ flex: 1 }}
            />
            <Button
              label="Spieler anbieten"
              variant="outline"
              icon="hand-right"
              onPress={() => router.push('/exchange/new-offer')}
              style={{ flex: 1 }}
            />
          </View>
          <Section title={`Offener Bedarf (${open.length})`}>
            {open.length === 0 ? (
              <Empty icon="checkmark-done-outline" text="Aktuell sucht niemand Spieler." />
            ) : null}
            {open.map((d) => (
              <DemandCard key={d.id} demand={d} />
            ))}
          </Section>
          <Section title="Angebote">
            {o.offers.length === 0 ? (
              <Empty icon="hand-right-outline" text="Keine Angebote." />
            ) : (
              <Card style={{ gap: 10 }}>
                {o.offers.map((offer) => (
                  <View
                    key={offer.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <TeamBadge badge={offer.team.badge} />
                    <View style={{ flex: 1 }}>
                      <T variant="body">
                        {plural(offer.count, 'Spieler', 'Spieler')} am {formatShortDate(offer.day)}
                      </T>
                      {offer.note ? <T variant="caption">{offer.note}</T> : null}
                    </View>
                    {offer.mine ? <Chip tone="neutral" label="Mein Angebot" /> : null}
                  </View>
                ))}
              </Card>
            )}
          </Section>
          {done.length ? (
            <Section title="Bereits gedeckt">
              {done.map((d) => (
                <DemandCard key={d.id} demand={d} />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
