import type { AttendanceStatus, EventSummary, MyResponse } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { RequestError } from '@/lib/api';
import {
  clubInitials,
  countdown,
  formatDateTile,
  formatDay,
  formatLongDate,
  formatRemaining,
  formatTime,
} from '@/lib/format';
import {
  ATTENDANCE_LABELS,
  DECLINE_REASONS,
  EVENT_TYPE_LABELS,
  MATCH_KIND_LABELS,
} from '@/lib/labels';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { PressScale } from '@/lib/motion';
import { useTeamColor } from '@/lib/team-colors';
import { Text } from '@/components/app-text';
import { enqueueResponse, queuedFor, useOutbox } from '@/lib/outbox';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Crest,
  DateTile,
  HeroCard,
  ListRow,
  T,
  Sheet,
  SwipeRow,
  TeamBadge,
  TextField,
  withAlpha,
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

/** Blickfang „Als Nächstes“ (Termine): der nächste Termin als Hero, Uhrzeit groß. */
export function FeaturedEventCard({ event }: { event: EventSummary }) {
  const { colors } = useTheme();
  const on = colors.hero.onHero;
  const mine = event.myResponses[0];
  const multi = event.myResponses.length > 1 || mine?.relation === 'child';
  const c = countdown(event.startsAt);
  const left =
    c.days >= 1
      ? c.days === 1
        ? 'In 1 Tag'
        : `In ${c.days} Tagen`
      : c.hours >= 1
        ? `In ${c.hours} Std.`
        : `In ${Math.max(1, c.minutes)} Min.`;
  return (
    <HeroCard onPress={() => router.push(`/events/${event.id}`)} accessibilityLabel={event.title}>
      <T variant="overline" color={on}>
        {[t('Als Nächstes'), t(left)].join(' · ')}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <T variant="figure" color={on} style={{ fontSize: 72, lineHeight: 72 }}>
          {formatTime(event.startsAt)}
        </T>
        <T variant="headline" color={on} numberOfLines={2} style={{ fontSize: 28, flexShrink: 1 }}>
          {event.title}
        </T>
      </View>
      <T color="rgba(255,255,255,0.85)" style={{ fontSize: 13.5 }}>
        {[formatDay(event.startsAt), event.location].filter(Boolean).join(' · ')}
      </T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: colors.primary,
          }}
        >
          <T
            variant="caption"
            color={colors.onPrimary}
            style={{ fontWeight: '800', fontSize: 11.5 }}
          >
            {[event.team ? event.team.badge : 'Verein', multi && mine ? mine.firstName : null]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </View>
        {mine ? (
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              backgroundColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <T variant="caption" color={on} style={{ fontWeight: '800', fontSize: 11.5 }}>
              {mine.status === 'pending' ? 'Zusage offen' : ATTENDANCE_LABELS[mine.status]}
            </T>
          </View>
        ) : null}
      </View>
    </HeroCard>
  );
}

/**
 * Terminzeile: Datumskachel, Titel, Untertitel und Status bzw. runde Zusage ✓ / Absage ✕.
 * Abgesagte Termine sind durchgestrichen mit Chip „Abgesagt“ und Grund.
 */
/** Ergebnis (Spiele) bzw. erfasste Anwesenheit (Training) eines vergangenen Termins als Chip. */
function pastChip(event: EventSummary) {
  const m = event.match;
  if (m && m.goalsFor !== null && m.goalsAgainst !== null) {
    const tone =
      m.goalsFor > m.goalsAgainst ? 'success' : m.goalsFor < m.goalsAgainst ? 'urgent' : 'neutral';
    const word =
      m.goalsFor > m.goalsAgainst ? 'Sieg' : m.goalsFor < m.goalsAgainst ? 'Niederlage' : 'Remis';
    return <Chip tone={tone} label={`${m.goalsFor}:${m.goalsAgainst} · ${t(word)}`} />;
  }
  if (event.presence) {
    return (
      <Chip
        tone="success"
        icon="checkmark"
        label={t(`${event.presence.present} von ${event.presence.total} da`)}
      />
    );
  }
  return null;
}

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
  const cancelled = event.status === 'cancelled';
  const teamColor = useTeamColor(event.team?.id);
  const mine = event.myResponses[0];
  const multi = event.myResponses.length > 1 || mine?.relation === 'child';
  const outbox = useOutbox();
  const queued = mine ? queuedFor(outbox, event.id, mine.personId) : undefined;
  const quick = useQuickYes(event, mine?.personId ?? '');
  // Vergangene Termine: Ergebnis bzw. Anwesenheit statt Zu-/Absage (Paket VT)
  const past = new Date(event.startsAt).getTime() < Date.now();
  const swipeable =
    !past &&
    !cancelled &&
    !!mine &&
    !multi &&
    !queued &&
    mine.status === 'pending' &&
    mine.canRespond;
  const text = cancelled
    ? event.cancelledReason
      ? `Grund: ${event.cancelledReason}`
      : formatTime(event.startsAt)
    : [
        formatTime(event.startsAt),
        EVENT_TYPE_LABELS[event.type],
        event.match ? MATCH_KIND_LABELS[event.match.kind] : null,
      ]
        .filter(Boolean)
        .join(' · ');
  const row = (
    <ListRow
      first={first}
      onPress={openable ? () => router.push(`/events/${event.id}`) : undefined}
      leading={
        <DateTile
          {...formatDateTile(event.startsAt)}
          muted={cancelled}
          color={teamColor ?? undefined}
        />
      }
      title={event.title}
      strike={cancelled}
      subtitle={
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {event.team ? (
            <TeamBadge badge={event.team.badge} />
          ) : (
            <Chip tone="info" label="Verein" />
          )}
          <T variant="caption" style={{ flexShrink: 1 }}>
            {text}
          </T>
        </View>
      }
      trailing={
        cancelled ? (
          <Chip tone="urgent" icon="close-circle" label="Abgesagt" />
        ) : past && pastChip(event) ? (
          pastChip(event)
        ) : !mine ? null : queued && !multi ? (
          <Chip tone="info" icon="cloud-upload-outline" label="Wird gesendet" />
        ) : !mine ? null : multi ? (
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
        ) : mine.status === 'pending' && mine.canRespond && !past ? (
          <RoundRespond event={event} personId={mine.personId} />
        ) : (
          <AttendanceChip status={mine.status} />
        )
      }
    />
  );
  return swipeable ? (
    <SwipeRow label="Zusagen" icon="checkmark" onAction={quick.yes}>
      {row}
    </SwipeRow>
  ) : (
    row
  );
}

/**
 * Grund für „Absagen“ oder „Unsicher“ (Paket PO). Absage: Auswahl und freier Hinweis, freiwillig; „Absage senden“
 * rot gefüllt, „Abbrechen“ grau, der gewählte Grund rot mit Häkchen. Unsicher: nur eine verpflichtende Begründung
 * (Textfeld mit Zähler, gelb umrandet), „Unsicher senden“ orange und erst mit Text aktiv. Eigener Zustand, damit
 * Auswahl und Text beim Schließen verworfen werden.
 */
function ReasonForm({
  status,
  loading,
  onCancel,
  onSubmit,
}: {
  status: 'no' | 'maybe';
  loading: boolean;
  onCancel: () => void;
  onSubmit: (reason: string | undefined) => void;
}) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  if (status === 'maybe')
    return (
      <View style={{ gap: 12 }}>
        <TextField
          label="Warum bist du unsicher?"
          value={note}
          onChangeText={setNote}
          maxLength={120}
          multiline
          accent={colors.status.action.solid}
          hint="Bitte kurz begründen"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} label="Abbrechen" variant="neutral" onPress={onCancel} />
          <Button
            style={{ flex: 1 }}
            label="Unsicher senden"
            variant="actionSolid"
            disabled={note.trim().length === 0}
            loading={loading}
            onPress={() => onSubmit(note.trim())}
          />
        </View>
      </View>
    );
  return (
    <View style={{ gap: 10 }}>
      <ChoiceChips
        label="Warum kannst du nicht?"
        options={DECLINE_REASONS.map((d) => ({ value: d, label: d }))}
        selected={reason ? [reason] : []}
        onToggle={(v) => setReason(v === reason ? null : v)}
        tone="urgent"
        check
      />
      <TextField
        label="Hinweis für das Trainerteam (optional)"
        value={note}
        onChangeText={setNote}
        maxLength={120}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} label="Abbrechen" variant="neutral" onPress={onCancel} />
        <Button
          style={{ flex: 1 }}
          label="Absage senden"
          variant="dangerSolid"
          loading={loading}
          onPress={() => onSubmit([reason, note.trim()].filter(Boolean).join(' – ') || undefined)}
        />
      </View>
    </View>
  );
}

/** Sofortige Zusage mit Rückmeldung (Toast, bei fehlender Verbindung gemerkt) – für ✓ und Wischen. */
function useQuickYes(event: EventSummary, personId: string) {
  const respond = useRespond(event.id, event.title);
  const toast = useToast();
  return {
    pending: respond.isPending,
    yes: () =>
      respond.mutate(
        { personId, status: 'yes' },
        {
          onSuccess: (data) =>
            toast(
              data === 'queued'
                ? { message: 'Gespeichert – wird gesendet, sobald du wieder online bist' }
                : {
                    message: 'Zugesagt',
                    actionLabel: 'Rückgängig',
                    onAction: () => respond.mutate({ personId, status: 'pending' }),
                  },
            ),
        },
      ),
  };
}

/** Zwei runde Knöpfe (44): ✓ sagt sofort zu, ✕ öffnet den Termin, dort wird der Grund abgefragt. */
function RoundRespond({ event, personId }: { event: EventSummary; personId: string }) {
  const { colors, sizes } = useTheme();
  const respond = useRespond(event.id, event.title);
  const quick = useQuickYes(event, personId);
  const toast = useToast();
  const [declining, setDeclining] = useState(false);
  const size = sizes.touchTarget;
  const round = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zusagen"
        disabled={quick.pending}
        onPress={quick.yes}
        style={{ ...round, backgroundColor: colors.status.success.container }}
      >
        <Ionicons name="checkmark" size={22} color={colors.status.success.onContainer} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Absagen"
        onPress={() => setDeclining(true)}
        style={{ ...round, backgroundColor: colors.status.urgent.container }}
      >
        <Ionicons name="close" size={22} color={colors.status.urgent.onContainer} />
      </Pressable>
      <Sheet visible={declining} onClose={() => setDeclining(false)} title="Absagen">
        <T variant="label">{event.title}</T>
        <ReasonForm
          status="no"
          loading={respond.isPending}
          onCancel={() => setDeclining(false)}
          onSubmit={(reason) =>
            respond.mutate(
              { personId, status: 'no', reason },
              {
                onSuccess: (data) => {
                  setDeclining(false);
                  toast(
                    data === 'queued'
                      ? { message: 'Gespeichert – wird gesendet, sobald du wieder online bist' }
                      : {
                          message: 'Abgesagt',
                          actionLabel: 'Rückgängig',
                          onAction: () => respond.mutate({ personId, status: 'pending' }),
                        },
                  );
                },
              },
            )
          }
        />
      </Sheet>
    </View>
  );
}

/**
 * Zu-/Absage senden. Mit `queueTitle` (eigene Rückmeldung und die der Kinder) wird sie bei fehlender Verbindung
 * gemerkt und später gesendet (`'queued'`); Eingriffe des Trainerteams für andere Personen werden nie gemerkt.
 */
export function useRespond(eventId: string, queueTitle?: string) {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  return useMutation({
    // Auch ohne Verbindung ausführen: Der Netzfehler wird unten abgefangen und die Antwort gemerkt
    networkMode: 'always',
    mutationFn: async (input: {
      personId: string;
      status: 'yes' | 'no' | 'maybe' | 'pending';
      reason?: string;
    }): Promise<EventSummary | 'queued'> => {
      try {
        return await api<EventSummary>(`/events/${eventId}/responses/${input.personId}`, {
          method: 'PUT',
          body: { status: input.status, reason: input.reason ?? null },
        });
      } catch (e) {
        if (queueTitle && e instanceof RequestError && e.status === 0) {
          enqueueResponse({
            eventId,
            personId: input.personId,
            status: input.status,
            reason: input.reason ?? null,
            userId: me.user.id,
            title: queueTitle,
          });
          return 'queued';
        }
        throw e;
      }
    },
    onError: hapticError,
    onSuccess: () => {
      hapticSuccess();
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
}

/**
 * Zu-, Unsicher- und Absage-Knöpfe als Symbole (Haken, Fragezeichen, X): keine Beschriftung, die umbrechen
 * könnte; Beschriftung für Screenreader. Die gewählte Antwort ist gefüllt, die übrigen umrandet.
 */
export function AnswerButtons({
  status,
  onYes,
  onMaybe,
  onNo,
  busy = null,
  variant = 'pills',
}: {
  status: 'yes' | 'no' | 'maybe' | 'pending' | null;
  onYes: () => void;
  onMaybe: () => void;
  onNo: () => void;
  /** Antwort, die gerade gesendet wird (Ladeanzeige) */
  busy?: 'yes' | 'maybe' | 'no' | null;
  tone?: 'surface' | 'hero';
  /** pills: drei Pillen (Home); segment: ein Umschalter in einem Behälter (Detailseiten) */
  variant?: 'pills' | 'segment';
}) {
  const { colors } = useTheme();
  const answered = status === 'yes' || status === 'maybe' || status === 'no';
  // Drei Pillen (Anstoß): Zusagen in der Vereinsfarbe, Unsicher in Bernstein, Absagen in Rot –
  // jeweils mit Beschriftung. Nach der Antwort bleibt nur die gewählte Pille gefüllt.
  const pill = (
    key: 'yes' | 'maybe' | 'no',
    label: string,
    icon: IconName,
    fill: string,
    onFill: string,
    tint: string,
    onTint: string,
    onPress: () => void,
  ) => {
    const chosen = status === key;
    const dim = answered && !chosen;
    return (
      <PressScale
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected: chosen, busy: busy === key }}
        accessibilityLabel={t(label)}
        disabled={busy !== null}
        onPress={onPress}
        style={{
          flex: 1,
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          paddingHorizontal: 8,
          borderRadius: 26,
          backgroundColor: chosen || (!answered && key === 'yes') ? fill : tint,
          opacity: dim ? 0.6 : 1,
        }}
      >
        {busy === key ? (
          <ActivityIndicator color={chosen || (!answered && key === 'yes') ? onFill : onTint} />
        ) : (
          <>
            <Ionicons
              name={icon}
              size={19}
              color={chosen || (!answered && key === 'yes') ? onFill : onTint}
            />
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: '800',
                color: chosen || (!answered && key === 'yes') ? onFill : onTint,
              }}
            >
              {label}
            </Text>
          </>
        )}
      </PressScale>
    );
  };
  if (variant === 'segment') {
    const seg = (
      key: 'yes' | 'maybe' | 'no',
      label: string,
      fill: string,
      onFill: string,
      onPress: () => void,
    ) => {
      const chosen = status === key;
      return (
        <PressScale
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected: chosen, busy: busy === key }}
          accessibilityLabel={t(label)}
          disabled={busy !== null}
          onPress={onPress}
          style={{
            flex: 1,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            paddingVertical: 11,
            backgroundColor: chosen ? fill : 'transparent',
          }}
        >
          {busy === key ? (
            <ActivityIndicator color={onFill} />
          ) : (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13.5,
                fontWeight: '700',
                color: chosen ? onFill : colors.onSurface,
              }}
            >
              {label}
            </Text>
          )}
        </PressScale>
      );
    };
    return (
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          padding: 4,
          borderRadius: 16,
          backgroundColor: colors.anstoss.overlay,
        }}
      >
        {seg(
          'yes',
          status === 'yes' ? 'Zugesagt' : 'Zusagen',
          colors.primary,
          colors.onPrimary,
          onYes,
        )}
        {seg(
          'maybe',
          status === 'maybe' ? 'Unsicher gemeldet' : 'Unsicher',
          colors.status.action.solid,
          colors.status.action.onSolid,
          onMaybe,
        )}
        {seg(
          'no',
          status === 'no' ? 'Abgesagt' : 'Absagen',
          colors.status.urgent.solid,
          colors.status.urgent.onSolid,
          onNo,
        )}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {pill(
        'yes',
        status === 'yes' ? 'Zugesagt' : 'Zusagen',
        'checkmark',
        colors.primary,
        colors.onPrimary,
        withAlpha(colors.primary, 0.16),
        colors.primaryText,
        onYes,
      )}
      {pill(
        'maybe',
        status === 'maybe' ? 'Unsicher gemeldet' : 'Unsicher',
        'help',
        colors.status.action.solid,
        colors.status.action.onSolid,
        withAlpha(colors.status.action.solid, 0.16),
        colors.status.action.onContainer,
        onMaybe,
      )}
      {pill(
        'no',
        status === 'no' ? 'Abgesagt' : 'Absagen',
        'close',
        colors.status.urgent.solid,
        colors.status.urgent.onSolid,
        withAlpha(colors.status.urgent.solid, 0.16),
        colors.status.urgent.onContainer,
        onNo,
      )}
    </View>
  );
}

/**
 * Zu-/Absage für jede Person (ich selbst und ggf. meine Kinder). Absagen und „Unsicher“ fragen
 * nach dem Grund – er ist freiwillig und für das Trainerteam bestimmt.
 */
export function ResponseControls({
  event,
  tone = 'surface',
  variant = 'pills',
}: {
  event: EventSummary;
  variant?: 'pills' | 'segment';
  /** hero: Schaltflächen auf der Blickfangkarte; der Grund wird in einem Blatt von unten abgefragt */
  tone?: 'surface' | 'hero';
}) {
  const { colors } = useTheme();
  const respond = useRespond(event.id, event.title);
  const outbox = useOutbox();
  /** Antwort, die schon eingereiht ist, gilt sofort als Anzeige */
  const eff = (r: MyResponse) => queuedFor(outbox, event.id, r.personId)?.status ?? r.status;
  const waiting = event.myResponses.some((r) => queuedFor(outbox, event.id, r.personId));
  const [error, setError] = useState<string | null>(null);
  /** Person und Antwort, für die gerade ein Grund gewählt wird */
  const [pending, setPending] = useState<{ personId: string; status: 'no' | 'maybe' } | null>(null);
  if (event.myResponses.length === 0) return null;

  const toast = useToast();
  const send = (r: MyResponse, status: 'yes' | 'no' | 'maybe', declineReason?: string) => {
    setError(null);
    const previous = eff(r);
    respond.mutate(
      { personId: r.personId, status, reason: declineReason },
      {
        onSuccess: (data) => {
          setPending(null);
          if (data === 'queued') {
            toast({ message: 'Gespeichert – wird gesendet, sobald du wieder online bist' });
            return;
          }
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

  const reasonPanel = (r: MyResponse) =>
    pending && (
      <ReasonForm
        status={pending.status}
        loading={busy(r, pending.status)}
        onCancel={() => setPending(null)}
        onSubmit={(text) => send(r, pending.status, text)}
      />
    );

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
              <AttendanceChip status={eff(r)} />
            </View>
          ) : null}
          {(eff(r) === 'no' || eff(r) === 'maybe') && r.reason ? (
            <T variant="caption" color={tone === 'hero' ? colors.hero.onHero : undefined}>
              Grund: {r.reason}
            </T>
          ) : null}

          {!r.canRespond ? (
            <T variant="caption" color={tone === 'hero' ? colors.hero.onHero : undefined}>
              {event.status === 'cancelled'
                ? 'Der Termin wurde abgesagt.'
                : 'Rückmeldung nicht mehr möglich. Bei Änderungen wende dich an dein Trainerteam.'}
            </T>
          ) : pending?.personId === r.personId && tone !== 'hero' ? (
            reasonPanel(r)
          ) : (
            <AnswerButtons
              tone={tone}
              variant={variant}
              status={eff(r)}
              busy={
                respond.isPending && respond.variables?.personId === r.personId
                  ? respond.variables.status === 'pending'
                    ? null
                    : respond.variables.status
                  : null
              }
              onYes={() => send(r, 'yes')}
              onMaybe={() => setPending({ personId: r.personId, status: 'maybe' })}
              onNo={() => setPending({ personId: r.personId, status: 'no' })}
            />
          )}
        </View>
      ))}
      {waiting ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons
            name="cloud-upload-outline"
            size={18}
            color={tone === 'hero' ? colors.hero.onHero : colors.onSurfaceMuted}
          />
          <T
            variant="caption"
            color={tone === 'hero' ? colors.hero.onHero : undefined}
            style={{ flex: 1 }}
          >
            Deine Rückmeldung wird gesendet, sobald du wieder online bist.
          </T>
        </View>
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {tone === 'hero' ? (
        <Sheet
          visible={!!pending}
          onClose={() => setPending(null)}
          title={pending?.status === 'maybe' ? 'Unsicher melden' : 'Absagen'}
        >
          {pending
            ? reasonPanel(event.myResponses.find((r) => r.personId === pending.personId)!)
            : null}
        </Sheet>
      ) : null}
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

  const on = colors.onPrimary;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Blickfang des Bildschirms: Spiel, Gegner und Countdown auf der Vereinsfarbe */}
      <View style={{ gap: 12, padding: 16, backgroundColor: colors.primary }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <T variant="overline" color={on}>
            {event.type === 'tournament' ? 'Nächstes Spielfest' : 'Nächstes Spiel'}
            {event.team ? ` · ${event.team.badge}` : ''}
          </T>
          <Chip tone="neutral" label={isHome ? 'Heimspiel' : 'Auswärts'} />
        </View>

        <Pressable onPress={() => router.push(`/events/${event.id}`)} accessibilityRole="button">
          {opponent ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}
            >
              <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                <View
                  style={{
                    padding: 5,
                    borderRadius: 24,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Crest initials={clubInitials(clubShortName)} size={36} />
                </View>
                <T variant="section" color={on} style={{ textAlign: 'center', fontSize: 16 }}>
                  {ourName}
                </T>
              </View>
              <T variant="heading" color={on}>
                vs.
              </T>
              <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="shield-outline" size={22} color={colors.onSurfaceMuted} />
                </View>
                <T variant="section" color={on} style={{ textAlign: 'center', fontSize: 16 }}>
                  {opponent}
                </T>
              </View>
            </View>
          ) : (
            <T variant="section" color={on} style={{ textAlign: 'center', fontSize: 20 }}>
              {event.title}
            </T>
          )}
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          <CountdownBox value={left.days} unit="Tage" />
          <CountdownBox value={left.hours} unit="Std." />
          <CountdownBox value={left.minutes} unit="Min." />
        </View>
        <T variant="caption" color={on} style={{ textAlign: 'center' }}>
          {formatLongDate(event.startsAt)} · {formatTime(event.startsAt)} Uhr
          {event.location ? ` · ${event.location}` : ''}
        </T>
      </View>

      <View style={{ gap: 12, padding: 16 }}>
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
      </View>
    </Card>
  );
}
