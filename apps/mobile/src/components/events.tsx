import type { AttendanceStatus, EventSummary, MyResponse } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { RequestError } from '@/lib/api';
import {
  clubInitials,
  countdown,
  formatDay,
  formatLongDate,
  formatRemaining,
  formatTime,
} from '@/lib/format';
import { ATTENDANCE_LABELS, DECLINE_REASONS, EVENT_TYPE_LABELS, MAYBE_REASONS } from '@/lib/labels';
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
import { useToast } from '@/lib/toast';
import { t } from '@/lib/i18n';

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
export function EventRow({
  event,
  first,
  openable = true,
}: {
  event: EventSummary;
  first?: boolean;
  /** Fremde Mannschaftstermine im Vereinskalender lassen sich nur ansehen, nicht öffnen */
  openable?: boolean;
}) {
  const { colors } = useTheme();
  const mine = event.myResponses[0];
  const cancelled = event.status === 'cancelled';
  return (
    <ListRow
      first={first}
      onPress={openable ? () => router.push(`/events/${event.id}`) : undefined}
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
          event.myResponses.length > 1 || mine.relation === 'child' ? (
            // Eltern: je Person ein Status mit Vornamen („Mia: Unsicher“)
            <View style={{ gap: 4, alignItems: 'flex-end' }}>
              {event.myResponses.map((r) => (
                <Chip
                  key={r.personId}
                  tone={STATUS_TONE[r.status]}
                  label={`${r.relation === 'self' ? 'Ich' : r.firstName}: ${ATTENDANCE_LABELS[r.status]}`}
                />
              ))}
            </View>
          ) : (
            <AttendanceChip status={mine.status} />
          )
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
    mutationFn: (input: {
      personId: string;
      status: 'yes' | 'no' | 'maybe' | 'pending';
      reason?: string;
    }) =>
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

/**
 * Zu-/Absage für jede Person (ich selbst und ggf. meine Kinder). Absagen und „Unsicher“ fragen
 * nach dem Grund – er ist freiwillig und für das Trainerteam bestimmt.
 */
export function ResponseControls({ event }: { event: EventSummary }) {
  const respond = useRespond(event.id);
  const [error, setError] = useState<string | null>(null);
  /** Person und Antwort, für die gerade ein Grund gewählt wird */
  const [pending, setPending] = useState<{ personId: string; status: 'no' | 'maybe' } | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  if (event.myResponses.length === 0) return null;

  const toast = useToast();
  const send = (r: MyResponse, status: 'yes' | 'no' | 'maybe', declineReason?: string) => {
    setError(null);
    const previous = r.status;
    respond.mutate(
      { personId: r.personId, status, reason: declineReason },
      {
        onSuccess: () => {
          setPending(null);
          setReason(null);
          setNote('');
          const label = t(
            status === 'yes' ? 'Zugesagt' : status === 'maybe' ? 'Unsicher' : 'Abgesagt',
          );
          toast({
            message:
              event.myResponses.length > 1 || r.relation === 'child'
                ? `${r.firstName}: ${label}`
                : label,
            actionLabel: 'Rückgängig',
            onAction: () =>
              respond.mutate({
                personId: r.personId,
                status: previous === 'pending' ? 'pending' : previous,
              }),
          });
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

  const busy = (r: MyResponse, status: 'yes' | 'no' | 'maybe') =>
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
          {(r.status === 'no' || r.status === 'maybe') && r.reason ? (
            <T variant="caption">Grund: {r.reason}</T>
          ) : null}

          {!r.canRespond ? (
            <T variant="caption">
              {event.status === 'cancelled'
                ? 'Der Termin wurde abgesagt.'
                : 'Rückmeldung nicht mehr möglich. Bei Änderungen wende dich an dein Trainerteam.'}
            </T>
          ) : pending?.personId === r.personId ? (
            <View style={{ gap: 10 }}>
              <ChoiceChips
                label={
                  pending.status === 'maybe' ? 'Warum bist du unsicher?' : 'Warum kannst du nicht?'
                }
                options={(pending.status === 'maybe' ? MAYBE_REASONS : DECLINE_REASONS).map(
                  (d) => ({
                    value: d,
                    label: d,
                  }),
                )}
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
                  onPress={() => setPending(null)}
                />
                <Button
                  style={{ flex: 1 }}
                  label={pending.status === 'maybe' ? 'Unsicher senden' : 'Absage senden'}
                  variant={pending.status === 'maybe' ? 'action' : 'danger'}
                  loading={busy(r, pending.status)}
                  onPress={() =>
                    send(
                      r,
                      pending.status,
                      [reason, note.trim()].filter(Boolean).join(' – ') || undefined,
                    )
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
                style={{ flex: 0.8 }}
                label="Unsicher"
                icon={r.status === 'maybe' ? 'help-circle' : undefined}
                variant={r.status === 'maybe' ? 'action' : 'outline'}
                onPress={() => {
                  setReason(null);
                  setNote('');
                  setPending({ personId: r.personId, status: 'maybe' });
                }}
              />
              <Button
                style={{ flex: 1 }}
                label={r.status === 'no' ? 'Abgesagt' : 'Absagen'}
                icon={r.status === 'no' ? 'close-circle' : undefined}
                variant={r.status === 'no' ? 'danger' : 'outline'}
                onPress={() => {
                  setReason(null);
                  setNote('');
                  setPending({ personId: r.personId, status: 'no' });
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
      <T variant="figure" color={colors.primaryText} style={{ fontSize: 24 }}>
        {String(value).padStart(2, '0')}
      </T>
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
              <T variant="section" style={{ textAlign: 'center', fontSize: 16 }}>
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
              <T variant="section" style={{ textAlign: 'center', fontSize: 16 }}>
                {opponent}
              </T>
            </View>
          </View>
        ) : (
          <T variant="section" style={{ textAlign: 'center', fontSize: 20 }}>
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
