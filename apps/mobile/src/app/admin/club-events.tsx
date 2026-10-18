import { Cell, DataTable } from '@/components/data-table';
import { useIsDesktop } from '@/lib/layout';
import type { EventPlanning } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { dateFormat, t } from '@/lib/i18n';

const TYPE = {
  club_event: 'Veranstaltung',
  meeting: 'Versammlung',
  work_assignment: 'Arbeitseinsatz',
};
const when = dateFormat({
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default function ClubEventsPlanningScreen() {
  const desktop = useIsDesktop();
  const { api } = useSignedIn();
  const planning = useQuery({
    queryKey: ['admin', 'club-events'],
    queryFn: () => api<EventPlanning>('/admin/club-events'),
  });
  if (planning.isPending) return <Loading />;
  if (planning.error)
    return <ErrorNotice error={planning.error} onRetry={() => planning.refetch()} />;
  const p = planning.data;
  return (
    <Screen edges={[]} refreshing={planning.isRefetching} onRefresh={() => planning.refetch()}>
      <Button
        label="Veranstaltung planen"
        icon="add"
        onPress={() => router.push('/admin/club-event-new')}
      />
      <Section title="Geplant">
        {desktop && p.upcoming.length > 0 ? (
          <DataTable
            rows={p.upcoming}
            rowKey={(e) => e.id}
            exportName="veranstaltungen"
            defaultSort={{ key: 'when', dir: 'asc' }}
            onRowPress={(e) => router.push(`/events/${e.id}`)}
            columns={[
              {
                key: 'when',
                label: 'Wann',
                width: 190,
                sort: (x, y) => x.startsAt.localeCompare(y.startsAt),
                csv: (r) => r.startsAt,
                render: (r) => <Cell muted>{`${when.format(new Date(r.startsAt))} Uhr`}</Cell>,
              },
              {
                key: 'title',
                label: 'Veranstaltung',
                flex: 3,
                sort: (x, y) => x.title.localeCompare(y.title),
                csv: (r) => r.title,
                render: (r) => (
                  <Cell>
                    {r.status === 'cancelled' ? `${r.title} (${t('Abgesagt')})` : r.title}
                  </Cell>
                ),
              },
              {
                key: 'type',
                label: 'Art',
                width: 150,
                csv: (r) => TYPE[r.type],
                render: (r) => <Cell muted>{TYPE[r.type]}</Cell>,
              },
              {
                key: 'place',
                label: 'Ort',
                flex: 2,
                csv: (r) => r.location ?? '',
                render: (r) => <Cell muted>{r.location ?? ''}</Cell>,
              },
              {
                key: 'scope',
                label: 'Für',
                flex: 2,
                csv: (r) => r.scopeLabel,
                render: (r) => <Cell muted>{r.scopeLabel}</Cell>,
              },
              {
                key: 'helpers',
                label: 'Helfer',
                width: 150,
                render: (r) => {
                  const missing = r.shifts.reduce(
                    (a, x) => a + Math.max(0, x.capacity - x.filled),
                    0,
                  );
                  return (
                    <Cell>
                      {r.shifts.length ? (missing ? t(`${missing} fehlen`) : t('komplett')) : ''}
                    </Cell>
                  );
                },
              },
            ]}
          />
        ) : (
          <Card>
            {p.upcoming.length === 0 ? (
              <Empty
                icon="calendar-outline"
                text="Noch keine Veranstaltungen geplant."
                action={{
                  label: 'Veranstaltung anlegen',
                  onPress: () => router.push('/admin/club-event-new'),
                }}
              />
            ) : null}
            {p.upcoming.map((e, i) => {
              const open = e.shifts.reduce((a, x) => a + Math.max(0, x.capacity - x.filled), 0);
              return (
                <ListRow
                  key={e.id}
                  first={i === 0}
                  onPress={() => router.push(`/events/${e.id}`)}
                  title={e.title}
                  subtitle={
                    <View style={{ gap: 4 }}>
                      <T variant="caption">
                        {`${TYPE[e.type]} · ${when.format(new Date(e.startsAt))} Uhr${e.location ? ` · ${e.location}` : ''}`}
                      </T>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <Chip tone="neutral" label={e.scopeLabel} />
                        {e.status === 'cancelled' ? <Chip tone="urgent" label="Abgesagt" /> : null}
                        {e.shifts.length ? (
                          <Chip
                            tone={open ? 'action' : 'success'}
                            label={open ? `${open} Helfer fehlen` : 'Helfer komplett'}
                          />
                        ) : null}
                      </View>
                    </View>
                  }
                />
              );
            })}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
