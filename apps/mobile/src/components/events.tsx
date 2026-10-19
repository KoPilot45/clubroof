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
import { hapticSelect } from '@/lib/haptics';
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
  T,
  Sheet,
  SwipeRow,
  TextField,
  withAlpha,
  type IconName,
} from './ui';
import { useToast } from '@/lib/toast';
import { AttendanceBar } from './attendance-bar';
import {
  AnswerKnobs,
  AnswerLine,
  NotReleasedHint,
  ParticipantPanel,
  answerState,
  useAnswerFlow,
  type AnswerState,
} from './event-answer';
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
          <T variant="caption" color={colors.onPrimary} style={{ fontWeight: '800', fontSize: 12 }}>
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
            <T variant="caption" color={on} style={{ fontWeight: '800', fontSize: 12 }}>
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

/** Eine Person (ich oder ein Kind) bei einem Termin: Zustand, Statuszeile und Antwortknöpfe. */
function AnswerUnit({
  event,
  r,
  past,
  children,
}: {
  event: EventSummary;
  r: MyResponse;
  past: boolean;
  children: (u: {
    state: AnswerState;
    line: React.ReactNode;
    knobs: React.ReactNode;
    sheet: React.ReactNode;
  }) => React.ReactNode;
}) {
  const outbox = useOutbox();
  const queued = queuedFor(outbox, event.id, r.personId);
  const flow = useAnswerFlow(event, r);
  const shown = queued ? { ...r, status: queued.status } : r;
  const state = answerState(event, shown, { past, queued: !!queued });
  return children({
    state,
    line: <AnswerLine state={state} />,
    sheet: flow.sheet,
    knobs: state.knobs ? (
      <AnswerKnobs
        value={shown.status}
        needsAnswer={state.needsAnswer}
        locked={state.locked || flow.pending}
        allowMaybe={event.responseRules?.allowMaybe ?? true}
        onAnswer={flow.answer}
      />
    ) : null,
  });
}

/**
 * Gemeinsame Terminkarte (Paket TERMIN-ANTWORT-UND-TEILNEHMER): Datumsblock, Titel, „Mannschaft · Uhrzeit · Ort“,
 * Statuszeile als Text, drei Antwortknöpfe, Summenzeile mit Balken und Pfeil, aufklappbare Teilnehmerliste.
 * Tippen auf Titel oder freie Fläche öffnet den Termin, ein Antwortknopf führt nur die Antwort aus, der Pfeil klappt nur auf.
 * Abgesagte Termine sind durchgestrichen mit Grund; vergangene zeigen Ergebnis bzw. Anwesenheit statt Knöpfen.
 */
export function EventRow({
  event,
  openable = true,
}: {
  event: EventSummary;
  /** (veraltet, ohne Wirkung: Abstand regelt die umgebende Liste) */
  first?: boolean;
  /** Fremde Mannschaftstermine im Vereinskalender lassen sich nur ansehen, nicht öffnen */
  openable?: boolean;
}) {
  const { colors } = useTheme();
  const { me } = useSignedIn();
  const cancelled = event.status === 'cancelled';
  const teamColor = useTeamColor(event.team?.id);
  const [expanded, setExpanded] = useState(false);
  const responses = event.myResponses;
  const mine = responses[0];
  // mehrere eigene Personen bei demselben Termin: je Person eine Zeile; ein Kind allein: Etikett über dem Titel
  const multi = responses.length > 1;
  const childLabel =
    responses.length === 1 && mine?.relation === 'child'
      ? [mine.firstName, event.team?.badge].filter(Boolean).join(' · ')
      : null;
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
  const canCorrect =
    !!event.team &&
    (me.canAdminister ||
      me.teams.some(
        (t) =>
          t.id === event.team!.id &&
          t.functions.some((f) => f === 'coach' || f === 'assistant_coach'),
      ));
  const place = event.location ?? EVENT_TYPE_LABELS[event.type];
  const text = cancelled
    ? event.cancelledReason
      ? `Grund: ${event.cancelledReason}`
      : formatTime(event.startsAt)
    : [
        event.team?.badge ?? t('Verein'),
        formatTime(event.startsAt),
        place,
        event.match ? MATCH_KIND_LABELS[event.match.kind] : null,
      ]
        .filter(Boolean)
        .join(' · ');
  const result = past && !cancelled ? pastChip(event) : null;
  // Termine ohne Antwortmodell (z. B. Vereinstermine ohne Anmeldung): keine Summenzeile
  const hasModel =
    !!mine || (event.counts !== null && Object.values(event.counts).some((n) => n > 0));
  const showSummary = !cancelled && event.counts !== null && hasModel;
  const hiddenList = !cancelled && event.counts === null && !!event.team && !!mine && !canCorrect;

  const head = (extra: React.ReactNode, line: React.ReactNode, sheet: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        accessibilityRole={openable ? 'button' : undefined}
        accessibilityLabel={`${event.title}, ${text}`}
        disabled={!openable}
        onPress={() => router.push(`/events/${event.id}`)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}
      >
        <DateTile
          {...formatDateTile(event.startsAt)}
          muted={cancelled}
          color={teamColor ?? undefined}
        />
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          {childLabel ? (
            <View
              style={{
                alignSelf: 'flex-start',
                borderRadius: 8,
                paddingHorizontal: 7,
                paddingVertical: 1,
                backgroundColor: withAlpha(colors.status.info.solid, 0.18),
              }}
            >
              <T
                variant="caption"
                color={colors.status.info.onContainer}
                verbatim
                style={{ fontSize: 10.5, fontWeight: '800' }}
              >
                {childLabel}
              </T>
            </View>
          ) : null}
          <T
            variant="title"
            numberOfLines={2}
            style={{
              fontSize: 15,
              lineHeight: 19,
              ...(cancelled ? { textDecorationLine: 'line-through' as const } : null),
            }}
            verbatim
          >
            {event.title}
          </T>
          <T variant="caption" numberOfLines={cancelled ? 2 : 1} verbatim>
            {text}
          </T>
          {line}
        </View>
      </Pressable>
      {extra}
      {sheet}
    </View>
  );

  const card = (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.anstoss.cardBorder,
        backgroundColor: colors.anstoss.card,
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 10,
        opacity: cancelled ? 0.85 : 1,
      }}
    >
      {cancelled ? (
        head(<Chip tone="urgent" icon="close-circle" label="Termin abgesagt" />, null, null)
      ) : mine && !multi ? (
        <AnswerUnit event={event} r={mine} past={past}>
          {(u) => head(u.knobs ?? result, u.line, u.sheet)}
        </AnswerUnit>
      ) : (
        head(result, null, null)
      )}
      {!cancelled && multi
        ? responses.map((r) => (
            <AnswerUnit key={r.personId} event={event} r={r} past={past}>
              {(u) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T
                      variant="caption"
                      color={colors.status.info.onContainer}
                      verbatim
                      style={{ fontSize: 10.5, fontWeight: '800' }}
                    >
                      {[r.relation === 'self' ? t('Ich') : r.firstName, event.team?.badge]
                        .filter(Boolean)
                        .join(' · ')}
                    </T>
                    {u.line}
                  </View>
                  {u.knobs}
                  {u.sheet}
                </View>
              )}
            </AnswerUnit>
          ))
        : null}
      {showSummary ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <AttendanceBar counts={event.counts!} compact />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(expanded ? 'Teilnehmer ausblenden' : 'Teilnehmer anzeigen')}
            accessibilityState={{ expanded }}
            hitSlop={8}
            onPress={() => setExpanded(!expanded)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.anstoss.overlay,
            }}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.onSurface}
            />
          </Pressable>
        </View>
      ) : null}
      {hiddenList ? <NotReleasedHint /> : null}
      {showSummary ? (
        <ParticipantPanel event={event} open={expanded} canCorrect={canCorrect} />
      ) : null}
    </View>
  );
  return swipeable ? (
    <SwipeRow label="Zusagen" icon="checkmark" onAction={quick.yes}>
      {card}
    </SwipeRow>
  ) : (
    card
  );
}

/**
 * Grund für „Absagen“ oder „Unsicher“ (Paket PO). Absage: Auswahl und freier Hinweis, freiwillig; „Absage senden“
 * rot gefüllt, „Abbrechen“ grau, der gewählte Grund rot mit Häkchen. Unsicher: nur eine verpflichtende Begründung
 * (Textfeld mit Zähler, gelb umrandet), „Unsicher senden“ orange und erst mit Text aktiv. Eigener Zustand, damit
 * Auswahl und Text beim Schließen verworfen werden.
 */
export function ReasonForm({
  status,
  loading,
  onCancel,
  onSubmit,
  required = false,
  error = null,
}: {
  status: 'no' | 'maybe';
  /** Ablehnung des Servers: erscheint hier im Formular, Eingaben bleiben erhalten */
  error?: string | null;
  /** Die Mannschaft verlangt bei einer Absage einen Grund (Paket E2) */
  required?: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (reason: string | undefined) => void;
}) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  // Pflichtangaben werden vor dem Senden abgefangen und am Formular erklärt (nie nur ein stummer Knopf)
  const [missing, setMissing] = useState<string | null>(null);
  const problem = missing ?? error;
  const problemChip = problem ? (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Chip tone="urgent" icon="alert-circle" label={problem} />
    </View>
  ) : null;
  if (status === 'maybe')
    return (
      <View style={{ gap: 12 }}>
        <TextField
          label="Warum bist du unsicher?"
          value={note}
          onChangeText={(v) => {
            setNote(v);
            setMissing(null);
          }}
          maxLength={120}
          multiline
          accent={colors.status.action.solid}
          hint="Bitte kurz begründen"
        />
        {problemChip}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} label="Abbrechen" variant="neutral" onPress={onCancel} />
          <Button
            style={{ flex: 1 }}
            label="Unsicher senden"
            variant="actionSolid"
            loading={loading}
            onPress={() =>
              note.trim().length === 0
                ? setMissing('Bitte schreibe kurz, warum du unsicher bist.')
                : onSubmit(note.trim())
            }
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
        onToggle={(v) => {
          setReason(v === reason ? null : v);
          setMissing(null);
        }}
        tone="urgent"
        check
      />
      <TextField
        label={required ? 'Hinweis für das Trainerteam' : 'Hinweis für das Trainerteam (optional)'}
        value={note}
        onChangeText={(v) => {
          setNote(v);
          setMissing(null);
        }}
        maxLength={120}
        hint={required ? 'Wähle einen Grund oder schreibe einen kurzen Hinweis.' : undefined}
      />
      {problemChip}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} label="Abbrechen" variant="neutral" onPress={onCancel} />
        <Button
          style={{ flex: 1 }}
          label="Absage senden"
          variant="dangerSolid"
          loading={loading}
          onPress={() => {
            if (required && !reason && note.trim().length === 0)
              return setMissing('Wähle einen Grund oder schreibe einen kurzen Hinweis.');
            onSubmit([reason, note.trim()].filter(Boolean).join(' – ') || undefined);
          }}
        />
      </View>
    </View>
  );
}

export const declineMessage = (e: unknown) =>
  e instanceof RequestError ? e.message : 'Die Rückmeldung konnte nicht gespeichert werden.';

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
                    message: 'Teilnahme bestätigt',
                    actionLabel: 'Rückgängig',
                    onAction: () => respond.mutate({ personId, status: 'pending' }),
                  },
            ),
        },
      ),
  };
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
  allowMaybe = true,
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
  /** false: „Unsicher“ entfällt (Einstellung der Mannschaft, Paket E2) */
  allowMaybe?: boolean;
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
        onPress={() => {
          hapticSelect();
          onPress();
        }}
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
          status === 'yes' ? 'Nimmt teil' : 'Zusagen',
          colors.primary,
          colors.onPrimary,
          onYes,
        )}
        {allowMaybe
          ? seg(
              'maybe',
              status === 'maybe' ? 'Unsicher gemeldet' : 'Unsicher',
              colors.status.action.solid,
              colors.status.action.onSolid,
              onMaybe,
            )
          : null}
        {seg(
          'no',
          status === 'no' ? 'Nimmt nicht teil' : 'Absagen',
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
        status === 'yes' ? 'Nimmt teil' : 'Zusagen',
        'checkmark',
        colors.primary,
        colors.onPrimary,
        withAlpha(colors.primary, 0.16),
        colors.primaryText,
        onYes,
      )}
      {allowMaybe
        ? pill(
            'maybe',
            status === 'maybe' ? 'Unsicher gemeldet' : 'Unsicher',
            'help',
            colors.status.action.solid,
            colors.status.action.onSolid,
            withAlpha(colors.status.action.solid, 0.16),
            colors.status.action.onContainer,
            onMaybe,
          )
        : null}
      {pill(
        'no',
        status === 'no' ? 'Nimmt nicht teil' : 'Absagen',
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
  const toast = useToast();
  if (event.myResponses.length === 0) return null;

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
            status === 'yes'
              ? 'Teilnahme bestätigt'
              : status === 'maybe'
                ? 'Unsicher'
                : 'Nimmt nicht teil',
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
        required={event.responseRules?.declineReasonRequired}
        error={error}
        onCancel={() => setPending(null)}
        onSubmit={(text) => send(r, pending.status, text)}
      />
    );

  return (
    <View style={{ gap: 12 }}>
      {event.myResponses.map((r) => (
        <View key={r.personId} style={{ gap: 8 }}>
          {event.myResponses.length > 1 || r.relation === 'child' || !r.canRespond ? (
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
            <View style={{ gap: 6 }}>
              {event.status === 'cancelled' ? null : (
                <View style={{ flexDirection: 'row' }}>
                  <Chip tone="neutral" icon="lock-closed" label="Frist abgelaufen" />
                </View>
              )}
              <T variant="caption" color={tone === 'hero' ? colors.hero.onHero : undefined}>
                {event.status === 'cancelled'
                  ? 'Der Termin wurde abgesagt.'
                  : event.deadline
                    ? t(
                        `Die Frist ist am ${formatDay(event.deadline)}, ${formatTime(event.deadline)} Uhr abgelaufen. Bei Änderungen wende dich an dein Trainerteam.`,
                      )
                    : 'Rückmeldung nicht mehr möglich. Bei Änderungen wende dich an dein Trainerteam.'}
              </T>
            </View>
          ) : pending?.personId === r.personId && tone !== 'hero' ? (
            reasonPanel(r)
          ) : (
            <AnswerButtons
              tone={tone}
              variant={variant}
              allowMaybe={event.responseRules?.allowMaybe ?? true}
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
      {error && !pending ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
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
