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
  formatDateTile,
  formatLongDate,
  formatRemaining,
  formatTime,
} from '@/lib/format';
import {
  ATTENDANCE_LABELS,
  DECLINE_REASONS,
  EVENT_TYPE_LABELS,
  MATCH_KIND_LABELS,
  MAYBE_REASONS,
} from '@/lib/labels';
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

/** Blickfang „Als Nächstes“ (Termine): der nächste Termin auf dem Verlauf der Vereinsfarbe. */
export function FeaturedEventCard({ event }: { event: EventSummary }) {
  const { colors } = useTheme();
  const on = colors.hero.onHero;
  const mine = event.myResponses[0];
  const tile = formatDateTile(event.startsAt);
  return (
    <HeroCard onPress={() => router.push(`/events/${event.id}`)} accessibilityLabel={event.title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ alignItems: 'center', minWidth: 64 }}>
          <T variant="caption" color={on}>
            {`${tile.weekday} ${tile.day}.`}
          </T>
          <T variant="figure" color={on} style={{ fontSize: 34, lineHeight: 40 }}>
            {formatTime(event.startsAt)}
          </T>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T
            variant="headline"
            color={on}
            numberOfLines={2}
            style={{ fontSize: 20, lineHeight: 24 }}
          >
            {event.title}
          </T>
          {event.location ? (
            <T variant="caption" color={on} numberOfLines={1}>
              {event.location}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: on,
              }}
            >
              <T variant="caption" color={colors.hero.from} style={{ fontWeight: '700' }}>
                {event.team ? event.team.badge : 'Verein'}
              </T>
            </View>
            {mine ? (
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                }}
              >
                <T variant="caption" color={on} style={{ fontWeight: '700' }}>
                  {event.myResponses.length > 1 || mine.relation === 'child'
                    ? `${mine.relation === 'self' ? 'Ich' : mine.firstName}: ${ATTENDANCE_LABELS[mine.status]}`
                    : mine.status === 'pending'
                      ? 'Zusage offen'
                      : ATTENDANCE_LABELS[mine.status]}
                </T>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={on} />
      </View>
    </HeroCard>
  );
}

/**
 * Terminzeile: Datumskachel, Titel, Untertitel und Status bzw. runde Zusage ✓ / Absage ✕.
 * Abgesagte Termine sind durchgestrichen mit Chip „Abgesagt“ und Grund.
 */
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
  const mine = event.myResponses[0];
  const multi = event.myResponses.length > 1 || mine?.relation === 'child';
  const outbox = useOutbox();
  const queued = mine ? queuedFor(outbox, event.id, mine.personId) : undefined;
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
  return (
    <ListRow
      first={first}
      onPress={openable ? () => router.push(`/events/${event.id}`) : undefined}
      leading={<DateTile {...formatDateTile(event.startsAt)} muted={cancelled} />}
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
        ) : mine.status === 'pending' && mine.canRespond ? (
          <RoundRespond event={event} personId={mine.personId} />
        ) : (
          <AttendanceChip status={mine.status} />
        )
      }
    />
  );
}

/**
 * Grund für „Absagen“ oder „Unsicher“: Auswahl und freier Hinweis – freiwillig, nur fürs Trainerteam.
 * Eigener Zustand, damit Auswahl und Hinweis beim Schließen verworfen werden.
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
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  return (
    <View style={{ gap: 10 }}>
      <ChoiceChips
        label={status === 'maybe' ? 'Warum bist du unsicher?' : 'Warum kannst du nicht?'}
        options={(status === 'maybe' ? MAYBE_REASONS : DECLINE_REASONS).map((d) => ({
          value: d,
          label: d,
        }))}
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
        <Button style={{ flex: 1 }} label="Abbrechen" variant="outline" onPress={onCancel} />
        <Button
          style={{ flex: 1 }}
          label={status === 'maybe' ? 'Unsicher senden' : 'Absage senden'}
          variant={status === 'maybe' ? 'action' : 'danger'}
          loading={loading}
          onPress={() => onSubmit([reason, note.trim()].filter(Boolean).join(' – ') || undefined)}
        />
      </View>
    </View>
  );
}

/** Zwei runde Knöpfe (44): ✓ sagt sofort zu, ✕ öffnet den Termin, dort wird der Grund abgefragt. */
function RoundRespond({ event, personId }: { event: EventSummary; personId: string }) {
  const { colors, sizes } = useTheme();
  const respond = useRespond(event.id, event.title);
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
        disabled={respond.isPending}
        onPress={() =>
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
          )
        }
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
export function ResponseControls({
  event,
  tone = 'surface',
}: {
  event: EventSummary;
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

  const outline = tone === 'hero' ? ('heroOutline' as const) : ('outline' as const);
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
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                style={{ flex: 1 }}
                label={eff(r) === 'yes' ? 'Zugesagt' : 'Zusagen'}
                icon={
                  tone === 'hero' ? 'checkmark' : eff(r) === 'yes' ? 'checkmark-circle' : undefined
                }
                hideLabel={tone === 'hero'}
                size={tone === 'hero' ? 'sm' : 'md'}
                variant={
                  eff(r) === 'yes' || eff(r) === 'pending'
                    ? tone === 'hero'
                      ? 'hero'
                      : 'primary'
                    : outline
                }
                loading={busy(r, 'yes')}
                onPress={() => send(r, 'yes')}
              />
              <Button
                style={{ flex: 1 }}
                label="Unsicher"
                icon={tone === 'hero' ? 'help' : eff(r) === 'maybe' ? 'help-circle' : undefined}
                hideLabel={tone === 'hero'}
                size={tone === 'hero' ? 'sm' : 'md'}
                variant={eff(r) === 'maybe' ? (tone === 'hero' ? 'hero' : 'action') : outline}
                onPress={() => {
                  setPending({ personId: r.personId, status: 'maybe' });
                }}
              />
              <Button
                style={{ flex: 1 }}
                label={eff(r) === 'no' ? 'Abgesagt' : 'Absagen'}
                icon={tone === 'hero' ? 'close' : eff(r) === 'no' ? 'close-circle' : undefined}
                hideLabel={tone === 'hero'}
                size={tone === 'hero' ? 'sm' : 'md'}
                variant={eff(r) === 'no' ? (tone === 'hero' ? 'hero' : 'danger') : outline}
                onPress={() => {
                  setPending({ personId: r.personId, status: 'no' });
                }}
              />
            </View>
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
