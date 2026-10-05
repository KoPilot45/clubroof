import type { EventDetail, Participant } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AttendanceChip, ResponseControls, useRespond } from '@/components/events';
import { ShiftRow } from '@/components/helpers';
import { RequestError } from '@/lib/api';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
  TextField,
} from '@/components/ui';
import { formatLongDate, formatRemaining, formatTime } from '@/lib/format';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const ORDER: Participant['status'][] = ['yes', 'maybe', 'pending', 'no'];

const CANCEL_REASONS = ['Platz gesperrt', 'Wetter', 'Zu wenige Zusagen', 'Trainer verhindert'];

/** Trainer korrigiert die Rückmeldung eines Spielers (z. B. nach Fristablauf). */
function ParticipantRow({
  participant: p,
  eventId,
  first,
  canOverride,
}: {
  participant: Participant;
  eventId: string;
  first: boolean;
  canOverride: boolean;
}) {
  const [open, setOpen] = useState(false);
  const respond = useRespond(eventId);
  const subtitle =
    [
      p.role === 'coach'
        ? 'Trainer'
        : p.role === 'guest_player'
          ? `Gastspieler aus ${p.guestFromTeam}`
          : null,
      p.reason,
    ]
      .filter(Boolean)
      .join(' · ') || undefined;
  const set = (status: 'yes' | 'no' | 'maybe') =>
    respond.mutate(
      {
        personId: p.personId,
        status,
        reason: status === 'no' ? 'Vom Trainerteam eingetragen' : undefined,
      },
      { onSuccess: () => setOpen(false) },
    );
  return (
    <View>
      <ListRow
        first={first}
        title={p.name}
        subtitle={subtitle}
        trailing={<AttendanceChip status={p.status} />}
        onPress={canOverride ? () => setOpen((v) => !v) : undefined}
      />
      {open ? (
        <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 10 }}>
          <Button
            style={{ flex: 1 }}
            label="Zusage"
            variant="outline"
            onPress={() => set('yes')}
            loading={respond.isPending && respond.variables?.status === 'yes'}
          />
          <Button
            style={{ flex: 1 }}
            label="Unsicher"
            variant="outline"
            onPress={() => set('maybe')}
            loading={respond.isPending && respond.variables?.status === 'maybe'}
          />
          <Button
            style={{ flex: 1 }}
            label="Absage"
            variant="danger"
            onPress={() => set('no')}
            loading={respond.isPending && respond.variables?.status === 'no'}
          />
        </View>
      ) : null}
    </View>
  );
}

/** „Ich nehme teil“ für Vereinsveranstaltungen. */
function AttendanceCard({
  eventId,
  attendance,
  open,
}: {
  eventId: string;
  attendance: { attending: boolean; count: number };
  open: boolean;
}) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: () =>
      api(`/events/${eventId}/attendance`, { method: attendance.attending ? 'DELETE' : 'PUT' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
  });
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="heading">Teilnahme</T>
        <Chip
          tone="info"
          icon="people"
          label={`${attendance.count} ${attendance.count === 1 ? 'Person' : 'Personen'} dabei`}
        />
      </View>
      {open ? (
        <Button
          label={attendance.attending ? 'Ich bin dabei' : 'Ich nehme teil'}
          icon={attendance.attending ? 'checkmark-circle' : 'add-circle-outline'}
          variant={attendance.attending ? 'primary' : 'outline'}
          loading={toggle.isPending}
          onPress={() => toggle.mutate()}
        />
      ) : null}
      {open && attendance.attending ? (
        <T variant="caption">Nochmal tippen, um die Teilnahme zurückzunehmen.</T>
      ) : null}
    </Card>
  );
}

/** Termin absagen – die Mannschaft wird sofort benachrichtigt. */
function CoachActions({ event }: { event: EventDetail }) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancel = useMutation({
    mutationFn: () =>
      api<EventDetail>(`/events/${event.id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: (data) => {
      queryClient.setQueryData(['event', event.id], data);
      for (const key of ['events', 'home', 'team'])
        void queryClient.invalidateQueries({ queryKey: [key] });
      setOpen(false);
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Der Termin konnte nicht abgesagt werden.'),
  });
  return (
    <Card style={{ gap: 10 }}>
      <T variant="heading">Termin verwalten</T>
      <T variant="caption">Tippe auf einen Spieler, um seine Rückmeldung zu korrigieren.</T>
      {open ? (
        <>
          <ChoiceChips
            label="Grund der Absage"
            options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
            selected={CANCEL_REASONS.includes(reason) ? [reason] : []}
            onToggle={setReason}
          />
          <TextField
            label="Oder eigener Grund"
            value={reason}
            onChangeText={setReason}
            maxLength={200}
          />
          {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              style={{ flex: 1 }}
              label="Zurück"
              variant="outline"
              onPress={() => setOpen(false)}
            />
            <Button
              style={{ flex: 1 }}
              label="Absagen und informieren"
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={cancel.isPending}
              onPress={() => cancel.mutate()}
            />
          </View>
        </>
      ) : (
        <Button
          label="Termin absagen"
          variant="danger"
          icon="close-circle-outline"
          onPress={() => setOpen(true)}
        />
      )}
    </Card>
  );
}

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

          {e.program.length > 0 ? (
            <Section title="Programm">
              <Card>
                {e.program.map((item, i) => (
                  <View
                    key={item.time + item.title}
                    style={{
                      flexDirection: 'row',
                      gap: 14,
                      paddingVertical: 8,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <T
                      variant="label"
                      color={colors.primaryText}
                      style={{ width: 48, fontWeight: '800' }}
                    >
                      {item.time}
                    </T>
                    <T style={{ flex: 1 }}>{item.title}</T>
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}

          {e.attendance ? (
            <AttendanceCard
              eventId={e.id}
              attendance={e.attendance}
              open={e.status === 'scheduled' && new Date(e.startsAt) > new Date()}
            />
          ) : null}

          {e.shifts.length > 0 ? (
            <Section title="Helfer gesucht">
              <Card>
                {e.shifts.map((shift, i) => (
                  <ShiftRow key={shift.id} shift={shift} first={i === 0} />
                ))}
              </Card>
            </Section>
          ) : null}

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

          {e.canManage && e.status === 'scheduled' && new Date(e.startsAt) > new Date() ? (
            <CoachActions event={e} />
          ) : null}

          {e.team ? (
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
                    <ParticipantRow
                      key={p.personId}
                      participant={p}
                      eventId={e.id}
                      first={i === 0}
                      canOverride={e.canOverride && p.role !== 'coach' && e.status === 'scheduled'}
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
