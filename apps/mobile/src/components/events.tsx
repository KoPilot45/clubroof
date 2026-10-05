import type { AttendanceStatus, EventSummary, MyResponse } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RequestError } from '@/lib/api';
import {
  clubInitials,
  countdown,
  formatDay,
  formatLongDate,
  formatRemaining,
  formatTime,
} from '@/lib/format';
import { ATTENDANCE_LABELS, DECLINE_REASONS, EVENT_TYPE_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Crest,
  ListRow,
  T,
  TeamBadge,
  TextField,
  type IconName,
} from './ui';

const STATUS_TONE: Record<AttendanceStatus, 'success' | 'urgent' | 'action' | 'archived'> = {
  yes: 'success',
  no: 'urgent',
  maybe: 'action',
  pending: 'archived',
};

export function eventIcon(event: Pick<EventSummary, 'type'>): IconName {
  switch (event.type) {
    case 'training':
      return 'fitness-outline';
    case 'match':
      return 'football-outline';
    case 'tournament':
      return 'trophy-outline';
    case 'meeting':
      return 'people-outline';
    case 'work_assignment':
      return 'construct-outline';
    default:
      return 'calendar-outline';
  }
}

export function AttendanceChip({ status }: { status: AttendanceStatus }) {
  return <Chip tone={STATUS_TONE[status]} label={ATTENDANCE_LABELS[status]} />;
}

/** Zeile in einer Terminliste. */
export function EventRow({ event, first }: { event: EventSummary; first?: boolean }) {
  const { colors } = useTheme();
  const mine = event.myResponses[0];
  const cancelled = event.status === 'cancelled';
  return (
    <ListRow
      first={first}
      onPress={() => router.push(`/events/${event.id}`)}
      leading={
        <View style={{ width: 52 }}>
          <T variant="caption">{formatDay(event.startsAt)}</T>
          <T variant="label" style={{ fontWeight: '800' }}>
            {formatTime(event.startsAt)}
          </T>
        </View>
      }
      title={event.title}
      subtitle={
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {event.team ? (
            <TeamBadge badge={event.team.badge} />
          ) : (
            <Chip tone="info" label="Verein" />
          )}
          {cancelled ? (
            <Chip tone="urgent" icon="close-circle" label="Abgesagt" />
          ) : (
            <T variant="caption">{EVENT_TYPE_LABELS[event.type]}</T>
          )}
        </View>
      }
      trailing={
        cancelled ? null : mine ? (
          <AttendanceChip status={mine.status} />
        ) : (
          <Ionicons name={eventIcon(event)} size={18} color={colors.onSurfaceMuted} />
        )
      }
    />
  );
}

export function useRespond(eventId: string) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personId: string; status: 'yes' | 'no' | 'maybe'; reason?: string }) =>
      api<EventSummary>(`/events/${eventId}/responses/${input.personId}`, {
        method: 'PUT',
        body: { status: input.status, reason: input.reason ?? null },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
}

/** Zu-/Absage für jede Person (ich selbst und ggf. meine Kinder). Absagen fragen nach dem Grund. */
export function ResponseControls({ event }: { event: EventSummary }) {
  const respond = useRespond(event.id);
  const [error, setError] = useState<string | null>(null);
  /** Person, für die gerade ein Absagegrund gewählt wird */
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  if (event.myResponses.length === 0) return null;

  const send = (r: MyResponse, status: 'yes' | 'no', declineReason?: string) => {
    setError(null);
    respond.mutate(
      { personId: r.personId, status, reason: declineReason },
      {
        onSuccess: () => {
          setDeclining(null);
          setReason(null);
          setNote('');
        },
        onError: (e) =>
          setError(
            e instanceof RequestError
              ? e.message
              : 'Die Rückmeldung konnte nicht gespeichert werden.',
          ),
      },
    );
  };

  const busy = (r: MyResponse, status: 'yes' | 'no') =>
    respond.isPending &&
    respond.variables?.personId === r.personId &&
    respond.variables.status === status;

  return (
    <View style={{ gap: 12 }}>
      {event.myResponses.map((r) => (
        <View key={r.personId} style={{ gap: 8 }}>
          {event.myResponses.length > 1 || r.relation === 'child' ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <T variant="label">{r.relation === 'self' ? 'Ich' : r.firstName}</T>
              <AttendanceChip status={r.status} />
            </View>
          ) : null}
          {r.status === 'no' && r.reason ? <T variant="caption">Grund: {r.reason}</T> : null}

          {!r.canRespond ? (
            <T variant="caption">
              {event.status === 'cancelled'
                ? 'Der Termin wurde abgesagt.'
                : 'Rückmeldung nicht mehr möglich. Bei Änderungen wende dich an dein Trainerteam.'}
            </T>
          ) : declining === r.personId ? (
            <View style={{ gap: 10 }}>
              <ChoiceChips
                label="Warum kannst du nicht?"
                options={DECLINE_REASONS.map((d) => ({ value: d, label: d }))}
                selected={reason ? [reason] : []}
                onToggle={(v) => setReason(v === reason ? null : v)}
              />
              <TextField
                label="Hinweis für das Trainerteam (optional)"
                value={note}
                onChangeText={setNote}
                maxLength={120}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  style={{ flex: 1 }}
                  label="Abbrechen"
                  variant="outline"
                  onPress={() => setDeclining(null)}
                />
                <Button
                  style={{ flex: 1 }}
                  label="Absage senden"
                  variant="danger"
                  loading={busy(r, 'no')}
                  onPress={() =>
                    send(r, 'no', [reason, note.trim()].filter(Boolean).join(' – ') || undefined)
                  }
                />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                style={{ flex: 1 }}
                label={r.status === 'yes' ? 'Zugesagt' : 'Zusagen'}
                icon={r.status === 'yes' ? 'checkmark-circle' : undefined}
                variant={r.status === 'yes' || r.status === 'pending' ? 'primary' : 'outline'}
                loading={busy(r, 'yes')}
                onPress={() => send(r, 'yes')}
              />
              <Button
                style={{ flex: 1 }}
                label={r.status === 'no' ? 'Abgesagt' : 'Absagen'}
                icon={r.status === 'no' ? 'close-circle' : undefined}
                variant={r.status === 'no' ? 'danger' : 'outline'}
                onPress={() => {
                  setReason(null);
                  setNote('');
                  setDeclining(r.personId);
                }}
              />
            </View>
          )}
        </View>
      ))}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
    </View>
  );
}

function CountdownBox({ value, unit }: { value: number; unit: string }) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={{
        minWidth: 54,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceVariant,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: '800',
          color: colors.primaryText,
          fontVariant: ['tabular-nums'],
        }}
      >
        {String(value).padStart(2, '0')}
      </Text>
      <T variant="caption">{unit}</T>
    </View>
  );
}

/** Große Karte „Nächstes Spiel“ mit Countdown und Zu-/Absage (Home, Mappe S. 3). */
export function NextMatchCard({
  event,
  clubShortName,
}: {
  event: EventSummary;
  clubShortName: string;
}) {
  const { colors } = useTheme();
  const left = countdown(event.startsAt);
  const isHome = event.match?.isHome ?? event.title.includes('unserer Anlage');
  const opponent = event.match?.opponentName ?? null;
  const ourName = `${clubShortName}${event.team ? ` ${event.team.badge}` : ''}`;

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="overline">
          {event.type === 'tournament' ? 'Nächstes Spielfest' : 'Nächstes Spiel'}
          {event.team ? ` · ${event.team.badge}` : ''}
        </T>
        <Chip tone="primary" label={isHome ? 'Heimspiel' : 'Auswärts'} />
      </View>

      <Pressable onPress={() => router.push(`/events/${event.id}`)} accessibilityRole="button">
        {opponent ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}
          >
            <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <Crest initials={clubInitials(clubShortName)} size={42} />
              <T variant="label" style={{ textAlign: 'center', fontWeight: '700' }}>
                {ourName}
              </T>
            </View>
            <T variant="heading" color={colors.onSurfaceMuted}>
              vs.
            </T>
            <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: colors.surfaceVariant,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="shield-outline" size={20} color={colors.onSurfaceMuted} />
              </View>
              <T variant="label" style={{ textAlign: 'center', fontWeight: '700' }}>
                {opponent}
              </T>
            </View>
          </View>
        ) : (
          <T variant="title" style={{ textAlign: 'center' }}>
            {event.title}
          </T>
        )}
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        <CountdownBox value={left.days} unit="Tage" />
        <CountdownBox value={left.hours} unit="Std." />
        <CountdownBox value={left.minutes} unit="Min." />
      </View>
      <T variant="caption" style={{ textAlign: 'center' }}>
        {formatLongDate(event.startsAt)} · {formatTime(event.startsAt)} Uhr
        {event.location ? ` · ${event.location}` : ''}
      </T>
      {event.deadline && new Date(event.deadline) > new Date() ? (
        <View style={{ alignItems: 'center' }}>
          <Chip
            tone="action"
            icon="hourglass-outline"
            label={`Absagefrist: ${formatRemaining(event.deadline)}`}
          />
        </View>
      ) : null}
      <ResponseControls event={event} />
    </Card>
  );
}
