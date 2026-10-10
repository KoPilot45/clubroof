import type { EventAttendance, EventDetail, Participant } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, View } from 'react-native';
import { AnswerButtons, AttendanceChip, ResponseControls, useRespond } from '@/components/events';
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
  Sheet,
  T,
  TeamBadge,
  TextField,
} from '@/components/ui';
import { formatLongDate, formatRemaining, formatTime } from '@/lib/format';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { CarpoolSection } from '@/components/carpool';
import { MatchSection } from '@/components/match';
import { TrainingPlanSection } from '@/components/training-plan';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';
import { Scoreboard } from '@/components/scoreboard';

const ORDER: Participant['status'][] = ['yes', 'maybe', 'pending', 'no'];
const GROUP_LABELS: Record<Participant['status'], string> = {
  yes: 'Zugesagt',
  maybe: 'Unsicher',
  pending: 'Offen',
  no: 'Abgesagt',
};

/**
 * Teilnehmer nach Rückmeldung gruppiert. Oben die Zahlen als Schalter; lange Zusagelisten
 * starten eingeklappt, damit Offene und Absagen sofort sichtbar sind.
 */
function ParticipantGroups({
  participants,
  render,
}: {
  participants: Participant[];
  render: (p: Participant, index: number) => React.ReactNode;
}) {
  const { colors, radii } = useTheme();
  const groups = ORDER.map((status) => ({
    status,
    people: participants.filter((p) => p.status === status),
  }));
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.status, g.status !== 'yes' || g.people.length <= 8])),
  );
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {groups.map((g) => {
          const active = open[g.status];
          return (
            <Pressable
              key={g.status}
              accessibilityRole="button"
              accessibilityState={{ expanded: active }}
              accessibilityLabel={t(`${GROUP_LABELS[g.status]}: ${g.people.length}`)}
              onPress={() => setOpen({ ...open, [g.status]: !active })}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 6,
                borderRadius: radii.md,
                backgroundColor: active ? colors.primaryContainer : 'transparent',
              }}
            >
              <T variant="title" color={colors.primaryText}>
                {g.people.length}
              </T>
              <T variant="caption">{GROUP_LABELS[g.status]}</T>
            </Pressable>
          );
        })}
      </View>
      {groups
        .filter((g) => g.people.length > 0)
        .map((g) => (
          <View key={g.status}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open[g.status] }}
              onPress={() => setOpen({ ...open, [g.status]: !open[g.status] })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 44,
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <T variant="overline">{`${GROUP_LABELS[g.status]} (${g.people.length})`}</T>
              <Ionicons
                name={open[g.status] ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.onSurfaceMuted}
              />
            </Pressable>
            {open[g.status] ? g.people.map((p, i) => render(p, i)) : null}
          </View>
        ))}
    </View>
  );
}

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
        trailing={
          p.attended === null ? (
            <AttendanceChip status={p.status} />
          ) : p.attended ? (
            <Chip tone="success" icon="checkmark" label="War da" />
          ) : (
            <Chip tone="archived" label="Gefehlt" />
          )
        }
        onPress={canOverride && p.attended === null ? () => setOpen((v) => !v) : undefined}
      />
      {open ? (
        <View style={{ paddingBottom: 10 }}>
          <AnswerButtons
            status={null}
            busy={
              respond.isPending
                ? respond.variables?.status === 'pending'
                  ? null
                  : (respond.variables?.status ?? null)
                : null
            }
            onYes={() => set('yes')}
            onMaybe={() => set('maybe')}
            onNo={() => set('no')}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Anwesenheit nach dem Termin: Das Trainerteam hakt ab, wer wirklich da war (vorausgewählt sind
 * die Zusagen). Danach zählt die Anwesenheit für die Trainingsquote.
 */
function AttendanceCheckCard({ event: e }: { event: EventDetail }) {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const check = e.attendanceCheck!;
  const players = e.participants.filter((p) => p.role !== 'coach');
  const [editing, setEditing] = useState(false);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const save = useMutation({
    mutationFn: () =>
      api<EventDetail>(`/events/${e.id}/attendance-check`, {
        method: 'PUT',
        body: { present: [...present] },
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(['event', e.id], detail);
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      setEditing(false);
    },
  });
  const start = () => {
    setPresent(
      new Set(
        players
          .filter((p) => (p.attended === null ? p.status === 'yes' : p.attended))
          .map((p) => p.personId),
      ),
    );
    setEditing(true);
  };
  const attended = players.filter((p) => p.attended).length;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="section">Anwesenheit</T>
        {check.recordedAt ? (
          <Chip tone="success" icon="checkmark" label={`${attended} von ${players.length} da`} />
        ) : (
          <Chip tone="action" label="Noch nicht erfasst" />
        )}
      </View>
      {!editing ? (
        <>
          <T variant="caption">
            {check.recordedAt
              ? 'Für die Trainingsquote zählt, wer wirklich da war.'
              : 'Hake nach dem Termin ab, wer wirklich da war. Bis dahin zählen die Zusagen.'}
          </T>
          {check.canRecord ? (
            <Button
              label={check.recordedAt ? 'Anwesenheit ändern' : 'Anwesenheit erfassen'}
              icon="checkbox-outline"
              variant={check.recordedAt ? 'outline' : 'tonal'}
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              onPress={start}
            />
          ) : null}
        </>
      ) : (
        <>
          {players.map((p, i) => {
            const on = present.has(p.personId);
            return (
              <Pressable
                key={p.personId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  const next = new Set(present);
                  if (on) next.delete(p.personId);
                  else next.add(p.personId);
                  setPresent(next);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 44,
                  paddingVertical: 8,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={on ? colors.primaryText : colors.onSurfaceMuted}
                />
                <T variant="label" style={{ flex: 1 }}>
                  {p.name}
                </T>
                <AttendanceChip status={p.status} />
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              style={{ flex: 1 }}
              label="Abbrechen"
              variant="outline"
              onPress={() => setEditing(false)}
            />
            <Button
              style={{ flex: 1 }}
              label={`Speichern (${present.size})`}
              loading={save.isPending}
              onPress={() => save.mutate()}
            />
          </View>
          {save.error ? (
            <Chip tone="urgent" icon="alert-circle" label={save.error.message} />
          ) : null}
        </>
      )}
    </Card>
  );
}

/** „Ich nehme teil“ für Vereinsveranstaltungen. */
function AttendanceCard({
  eventId,
  attendance,
  open,
}: {
  eventId: string;
  attendance: EventAttendance;
  open: boolean;
}) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const answer = useMutation({
    mutationFn: (status: 'yes' | 'no' | 'maybe') =>
      api<EventAttendance>(`/events/${eventId}/attendance`, { method: 'PUT', body: { status } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
  const reset = useMutation({
    mutationFn: () => api<EventAttendance>(`/events/${eventId}/attendance`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
  });
  const busy = (status: 'yes' | 'no' | 'maybe') => answer.isPending && answer.variables === status;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="section">Teilnahme</T>
        <Chip
          tone="info"
          icon="people"
          label={`${attendance.count} ${attendance.count === 1 ? 'Zusage' : 'Zusagen'}`}
        />
      </View>
      {attendance.maybe > 0 ? (
        <T variant="caption">
          {attendance.maybe} {attendance.maybe === 1 ? 'Person ist' : 'Personen sind'} noch
          unsicher.
        </T>
      ) : null}
      {open ? (
        <AnswerButtons
          status={attendance.status}
          busy={(['yes', 'maybe', 'no'] as const).find((k) => busy(k)) ?? null}
          onYes={() => answer.mutate('yes')}
          onMaybe={() => answer.mutate('maybe')}
          onNo={() => answer.mutate('no')}
        />
      ) : null}
      {open && attendance.status ? (
        <Button
          label="Rückmeldung zurücknehmen"
          variant="outline"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          loading={reset.isPending}
          onPress={() => reset.mutate()}
        />
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
      <T variant="section">Termin verwalten</T>
      <T variant="caption">Tippe auf einen Spieler, um seine Rückmeldung zu korrigieren.</T>
      <Button
        label="Termin bearbeiten"
        variant="outline"
        icon="create-outline"
        onPress={() => router.push(`/event-edit/${event.id}`)}
      />
      <Button
        label="Termin absagen"
        variant="danger"
        icon="close-circle-outline"
        onPress={() => setOpen(true)}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Termin absagen?">
        <T variant="caption">Die Mannschaft wird sofort benachrichtigt. Bitte nenne einen Grund.</T>
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
            label="Abbrechen"
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
      </Sheet>
    </Card>
  );
}

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['event', id],
    queryFn: () => api<EventDetail>(`/events/${id}`),
  });
  const e = query.data;

  return (
    <Screen edges={[]} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      {query.isPending ? <Loading /> : null}
      {query.error ? <ErrorNotice error={query.error} onRetry={() => query.refetch()} /> : null}
      {e ? (
        <>
          {e.match ? <Scoreboard event={e} clubShortName={me.club.shortName} /> : null}
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {e.team ? <TeamBadge badge={e.team.badge} /> : <Chip tone="info" label="Verein" />}
              <Chip tone="neutral" label={EVENT_TYPE_LABELS[e.type]} />
              {e.status === 'cancelled' ? (
                <Chip tone="urgent" icon="close-circle" label="Abgesagt" />
              ) : null}
            </View>
            <T variant="title">{e.title}</T>
            {e.cancelledReason ? (
              <T color={colors.status.urgent.onContainer}>{e.cancelledReason}</T>
            ) : null}
            {e.description ? <T color={colors.onSurfaceMuted}>{e.description}</T> : null}
          </Card>

          {e.lastChange && e.status === 'scheduled' ? (
            <Card style={{ gap: 6 }}>
              <Chip tone="action" icon="swap-horizontal" label="Zuletzt geändert" />
              {e.lastChange.items.map((c) => (
                <T key={c.label} variant="caption">
                  <T variant="label">{c.label}: </T>
                  {c.from ?? '–'} → {c.to ?? '–'}
                </T>
              ))}
            </Card>
          ) : null}

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
                trailing={
                  e.routeUrl ? (
                    <Button
                      label="Route"
                      icon="navigate-outline"
                      size="sm"
                      variant="tonal"
                      onPress={() => void Linking.openURL(e.routeUrl!)}
                    />
                  ) : undefined
                }
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
                <T variant="section">Meine Rückmeldung</T>
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

          {e.type === 'match' && e.team ? <MatchSection event={e} /> : null}
          <TrainingPlanSection event={e} />

          {e.carpool ? <CarpoolSection event={e} /> : null}

          {e.attendanceCheck && (e.attendanceCheck.canRecord || e.attendanceCheck.recordedAt) ? (
            <AttendanceCheckCard event={e} />
          ) : null}

          {e.team ? (
            <Section title="Teilnehmer">
              <Card style={{ gap: 10 }}>
                <ParticipantGroups
                  participants={e.participants}
                  render={(p, i) => (
                    <ParticipantRow
                      key={p.personId}
                      participant={p}
                      eventId={e.id}
                      first={i === 0}
                      canOverride={e.canOverride && p.role !== 'coach' && e.status === 'scheduled'}
                    />
                  )}
                />
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
