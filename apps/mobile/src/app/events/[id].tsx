import type { EventDetail, Participant } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AttendanceChip, ResponseControls } from '@/components/events';
import {
  Card,
  Chip,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { formatLongDate, formatRemaining, formatTime } from '@/lib/format';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const ORDER: Participant['status'][] = ['yes', 'maybe', 'pending', 'no'];

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['event', id],
    queryFn: () => api<EventDetail>(`/events/${id}`),
  });
  const e = query.data;

  return (
    <Screen edges={[]} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      {query.isPending ? <Loading /> : null}
      {query.error ? (
        <ErrorNotice message={query.error.message} onRetry={() => query.refetch()} />
      ) : null}
      {e ? (
        <>
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {e.team ? <TeamBadge badge={e.team.badge} /> : <Chip tone="info" label="Verein" />}
              <Chip tone="neutral" label={EVENT_TYPE_LABELS[e.type]} />
              {e.status === 'cancelled' ? (
                <Chip tone="urgent" icon="close-circle" label="Abgesagt" />
              ) : null}
            </View>
            <T variant="title">{e.title}</T>
            {e.match?.goalsFor != null && e.match.goalsAgainst != null ? (
              <T variant="display" color={colors.primaryText}>
                {e.match.isHome
                  ? `${e.match.goalsFor} : ${e.match.goalsAgainst}`
                  : `${e.match.goalsAgainst} : ${e.match.goalsFor}`}
              </T>
            ) : null}
            {e.cancelledReason ? (
              <T color={colors.status.urgent.onContainer}>{e.cancelledReason}</T>
            ) : null}
            {e.description ? <T color={colors.onSurfaceMuted}>{e.description}</T> : null}
          </Card>

          <Card>
            <ListRow
              first
              leading={<IconTile name="calendar-outline" />}
              title={formatLongDate(e.startsAt)}
              subtitle={`${formatTime(e.startsAt)}${e.endsAt ? ` – ${formatTime(e.endsAt)}` : ''} Uhr`}
            />
            {e.meetingAt ? (
              <ListRow
                leading={<IconTile name="people-outline" />}
                title={`Treffpunkt ${formatTime(e.meetingAt)} Uhr`}
                subtitle={e.meetingPoint ?? undefined}
              />
            ) : null}
            {e.location ? (
              <ListRow
                leading={<IconTile name="location-outline" />}
                title={e.location}
                subtitle={e.match?.competition ?? undefined}
              />
            ) : null}
            {e.contactPerson ? (
              <ListRow
                leading={<IconTile name="person-outline" />}
                title={e.contactPerson.name}
                subtitle="Ansprechperson"
              />
            ) : null}
          </Card>

          {e.myResponses.length > 0 ? (
            <Card style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <T variant="heading">Meine Rückmeldung</T>
                {e.deadline && new Date(e.deadline) > new Date() ? (
                  <Chip
                    tone="action"
                    icon="hourglass-outline"
                    label={`Frist: ${formatRemaining(e.deadline)}`}
                  />
                ) : null}
              </View>
              <ResponseControls event={e} />
            </Card>
          ) : null}

          <Section title={`Teilnehmer (${e.counts.yes} zugesagt)`}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {(
                  [
                    ['Zugesagt', e.counts.yes],
                    ['Unsicher', e.counts.maybe],
                    ['Offen', e.counts.pending],
                    ['Abgesagt', e.counts.no],
                  ] as const
                ).map(([label, n]) => (
                  <View key={label} style={{ alignItems: 'center' }}>
                    <T variant="title" color={colors.primaryText}>
                      {n}
                    </T>
                    <T variant="caption">{label}</T>
                  </View>
                ))}
              </View>
              {[...e.participants]
                .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
                .map((p, i) => (
                  <ListRow
                    key={p.personId}
                    first={i === 0}
                    title={p.name}
                    subtitle={
                      [
                        p.role === 'coach'
                          ? 'Trainer'
                          : p.role === 'guest_player'
                            ? `Gastspieler aus ${p.guestFromTeam}`
                            : null,
                        p.reason,
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                    trailing={<AttendanceChip status={p.status} />}
                  />
                ))}
            </Card>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
