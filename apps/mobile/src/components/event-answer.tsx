/**
 * Antwort und Teilnehmer an jeder Terminkarte (Paket TERMIN-ANTWORT-UND-TEILNEHMER, Entwurf `ZusageTeilnehmer.html`):
 *  - `AnswerKnobs`: drei runde Knöpfe Zusage ✓ · Vielleicht ? · Absage ✕ (38 px, Tippfläche 44 px) bzw. breit mit Wort
 *  - `answerLine`: die Statuszeile als Text („✓ Du: Zugesagt“, „● Antwort bis morgen 12:00“, „🔒 … Frist abgelaufen“)
 *  - `useAnswerFlow`: Zusage und Vielleicht speichern mit einem Tipp (Bestätigung mit Rückgängig), Absage fragt über das
 *    gemeinsame Formular (`ReasonForm`) nach
 *  - `ParticipantPanel`: aufgeklappte Teilnehmerliste im Fluss (Gruppen, höchstens 4 Namen, Kader-Pop-up)
 */
import type {
  AttendanceStatus,
  EventDetail,
  EventSummary,
  MyResponse,
  Participant,
} from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/app-text';
import { formatAnswerBy } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { useToast } from '@/lib/toast';
import { ReasonForm, declineMessage, useRespond } from './events';
import { SquadSheet } from './squad-sheet';
import { Avatar, Button, ErrorNotice, Loading, Sheet, T, withAlpha } from './ui';

type Answer = 'yes' | 'maybe' | 'no';
const ANSWERS: Answer[] = ['yes', 'maybe', 'no'];
const WORD: Record<Answer, string> = { yes: 'Zusage', maybe: 'Vielleicht', no: 'Absage' };

/** Farben je Antwort: Fläche und Symbol (gewählt) sowie Text/Rand (nicht gewählt). */
function useAnswerColors() {
  const { colors } = useTheme();
  return {
    fill: {
      yes: colors.status.success.solid,
      maybe: colors.status.action.solid,
      no: colors.status.urgent.solid,
    } as Record<Answer, string>,
    on: {
      yes: colors.status.success.onSolid,
      maybe: colors.status.action.onSolid,
      no: colors.status.urgent.onSolid,
    } as Record<Answer, string>,
    text: {
      yes: colors.status.success.onContainer,
      maybe: colors.status.action.onContainer,
      no: colors.status.urgent.onContainer,
      pending: colors.status.action.onContainer,
    },
  };
}

/**
 * Drei Antwortknöpfe. `value`: gewählte Antwort; `needsAnswer`: offen mit Frist (orange Ränder); `locked`: gesperrt
 * (50 %, die gewählte bleibt voll). `wide`: Pillen mit Symbol und Wort (Home-Plakat, Desktop).
 */
export function AnswerKnobs({
  value,
  needsAnswer,
  locked,
  allowMaybe = true,
  wide,
  onPlate,
  onAnswer,
}: {
  value: AttendanceStatus;
  needsAnswer: boolean;
  locked: boolean;
  allowMaybe?: boolean;
  wide?: boolean;
  /** auf dem Plakat: halbtransparent dunkel mit weißem Rand */
  onPlate?: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  const { colors } = useTheme();
  const c = useAnswerColors();
  const list = ANSWERS.filter((a) => a !== 'maybe' || allowMaybe);
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', gap: wide ? 8 : 7, flexShrink: 0 }}
    >
      {list.map((a) => {
        const selected = value === a;
        const rim = onPlate
          ? withAlpha(colors.hero.onHero, 0.85)
          : needsAnswer
            ? colors.status.action.solid
            : colors.border;
        const ink = selected
          ? c.on[a]
          : onPlate
            ? colors.hero.onHero
            : needsAnswer
              ? colors.status.action.solid
              : colors.onSurface;
        return (
          <Pressable
            key={a}
            accessibilityRole="radio"
            accessibilityLabel={t(WORD[a])}
            accessibilityState={{ selected, disabled: locked }}
            disabled={locked}
            hitSlop={wide ? 0 : 3}
            onPress={() => onAnswer(a)}
            style={{
              ...(wide
                ? {
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 22,
                    flexDirection: 'row' as const,
                    paddingHorizontal: 10,
                  }
                : { width: 38, height: 38, borderRadius: 19 }),
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              borderWidth: selected ? 0 : 1.5,
              borderColor: rim,
              backgroundColor: selected
                ? c.fill[a]
                : onPlate
                  ? withAlpha(colors.hero.to, 0.55)
                  : 'transparent',
              opacity: locked && !selected ? 0.5 : 1,
            }}
          >
            {a === 'yes' ? (
              <Ionicons name="checkmark" size={wide ? 15 : 19} color={ink} />
            ) : a === 'no' ? (
              <Ionicons name="close" size={wide ? 15 : 19} color={ink} />
            ) : (
              <Text verbatim style={{ fontSize: wide ? 14 : 17, fontWeight: '800', color: ink }}>
                ?
              </Text>
            )}
            {wide ? (
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: ink }}>{WORD[a]}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export type AnswerState = {
  /** Text der Statuszeile; Zustand steht nie nur als Farbe */
  line: string;
  tone: 'warn' | 'yes' | 'maybe' | 'no' | 'muted';
  knobs: boolean;
  needsAnswer: boolean;
  locked: boolean;
  /** kurzer Hinweis unter der Statuszeile (Frist abgelaufen) */
  hint: string | null;
};

const STATUS_WORD: Record<AttendanceStatus, string> = {
  yes: 'Zugesagt',
  maybe: 'Unsicher',
  no: 'Abgesagt',
  pending: 'Offen',
};

/** Zustand der Antwort einer Person bei einem Termin: Statuszeile, Knöpfe, Sperre. */
export function answerState(
  event: EventSummary,
  r: MyResponse,
  opts: { past: boolean; queued: boolean },
): AnswerState {
  const base = { knobs: true, needsAnswer: false, locked: false, hint: null as string | null };
  if (event.status === 'cancelled')
    return { ...base, knobs: false, line: t('Termin abgesagt'), tone: 'no' };
  if (opts.past) {
    const word =
      r.status === 'yes'
        ? 'Du warst: zugesagt'
        : r.status === 'no'
          ? 'Du warst: abgesagt'
          : r.status === 'maybe'
            ? 'Du warst: unsicher'
            : 'Du hast nicht geantwortet';
    return { ...base, knobs: false, line: t(word), tone: 'muted' };
  }
  if (opts.queued) return { ...base, locked: true, line: t('Wird gesendet'), tone: 'muted' };
  if (r.role === 'coach')
    return { ...base, knobs: false, line: `✎ ${t('Du: Trainer (automatisch)')}`, tone: 'yes' };
  const locked = !r.canRespond;
  if (r.status === 'pending') {
    if (locked)
      return {
        ...base,
        locked,
        line: `🔒 ${t('Keine Antwort')}, ${t('Frist abgelaufen')}`,
        tone: 'warn',
        hint: t('Antwortfrist ist abgelaufen. Dein Trainerteam kann noch ändern.'),
      };
    return {
      ...base,
      needsAnswer: true,
      line: `● ${event.deadline ? formatAnswerBy(event.deadline) : t('Antwort offen')}`,
      tone: 'warn',
    };
  }
  const tone = r.status === 'yes' ? 'yes' : r.status === 'maybe' ? 'maybe' : 'no';
  if (locked)
    return {
      ...base,
      locked,
      line: `🔒 ${t(STATUS_WORD[r.status])} · ${t('Frist abgelaufen')}`,
      tone,
      hint: t('Antwortfrist ist abgelaufen. Dein Trainerteam kann noch ändern.'),
    };
  if (r.absent) return { ...base, line: `✕ ${t('Abwesend (automatisch)')}`, tone: 'no' };
  const mark = r.status === 'yes' ? '✓' : r.status === 'maybe' ? '?' : '✕';
  if (r.automatic)
    return {
      ...base,
      line: `${mark} ${t('Du')}: ${t(STATUS_WORD[r.status])} (${t('automatisch')})`,
      tone,
    };
  return { ...base, line: `${mark} ${t('Du')}: ${t(STATUS_WORD[r.status])}`, tone };
}

/** Statuszeile (11,5 px, fett) in der Farbe des Zustands. */
export function AnswerLine({ state }: { state: AnswerState }) {
  const { colors } = useTheme();
  const c = useAnswerColors();
  const color =
    state.tone === 'warn'
      ? c.text.pending
      : state.tone === 'muted'
        ? colors.onSurfaceMuted
        : c.text[state.tone];
  return (
    <View style={{ gap: 2 }}>
      <T variant="caption" color={color} verbatim style={{ fontSize: 11.5, fontWeight: '800' }}>
        {state.line}
      </T>
      {state.hint ? (
        <T variant="caption" style={{ fontSize: 11 }}>
          {state.hint}
        </T>
      ) : null}
    </View>
  );
}

/**
 * Antwort geben: Zusage und Vielleicht mit einem Tipp (Bestätigung „Teilnahme bestätigt: Zusage für Max.“ mit Rückgängig),
 * Absage öffnet das Fenster „Absage für Max“ mit demselben Formular wie die Terminseite. `sheet` irgendwo rendern.
 */
export function useAnswerFlow(event: EventSummary, r: MyResponse) {
  const respond = useRespond(event.id, event.title);
  const toast = useToast();
  const [declining, setDeclining] = useState(false);
  const name = r.relation === 'self' ? t('dich') : r.firstName;
  const title = r.relation === 'self' ? t('Absage') : t(`Absage für ${r.firstName}`);
  const save = (status: Answer, reason?: string) => {
    const previous = r.status;
    respond.mutate(
      { personId: r.personId, status, reason },
      {
        onSuccess: (data) => {
          setDeclining(false);
          toast(
            data === 'queued'
              ? { message: 'Gespeichert – wird gesendet, sobald du wieder online bist' }
              : {
                  message: t(`Teilnahme bestätigt: ${t(WORD[status])} für ${name}.`),
                  actionLabel: 'Rückgängig',
                  onAction: () =>
                    respond.mutate({
                      personId: r.personId,
                      status: previous === 'pending' ? 'pending' : previous,
                    }),
                },
          );
        },
      },
    );
  };
  const answer = (a: Answer) => {
    if (a === 'no') {
      respond.reset();
      setDeclining(true);
    } else save(a);
  };
  const sheet = (
    <Sheet
      visible={declining}
      onClose={() => {
        respond.reset();
        setDeclining(false);
      }}
      title={title}
    >
      <T variant="caption" verbatim>
        {event.title}
      </T>
      <ReasonForm
        status="no"
        required={event.responseRules?.declineReasonRequired}
        error={respond.error ? declineMessage(respond.error) : null}
        loading={respond.isPending}
        onCancel={() => {
          respond.reset();
          setDeclining(false);
        }}
        onSubmit={(reason) => save('no', reason)}
      />
    </Sheet>
  );
  return { answer, sheet, pending: respond.isPending };
}

// ── Teilnehmerliste ─────────────────────────────────────────────────────────

type GroupKey = 'yes' | 'maybe' | 'pending' | 'no' | 'absent';
const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'yes', title: 'Zusagen' },
  { key: 'maybe', title: 'Vielleicht' },
  { key: 'pending', title: 'Offen' },
  { key: 'no', title: 'Absagen' },
  { key: 'absent', title: 'Abwesend' },
];
const MAX_NAMES = 4;

const groupOf = (p: Participant): GroupKey => (p.absent ? 'absent' : p.status);
const byJersey = (a: Participant, b: Participant) =>
  (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name, 'de');

/** Eigene Zeile zuerst, dann nach Rückennummer – so bleibt „du“ auch in langen Gruppen sichtbar. */
function ordered(list: Participant[], mineIds: Set<string>) {
  return [
    ...list.filter((p) => mineIds.has(p.personId)).sort(byJersey),
    ...list.filter((p) => !mineIds.has(p.personId)).sort(byJersey),
  ];
}

/**
 * Aufgeklappte Teilnehmerliste im Fluss (kein eigener Scrollbereich). Geladen wird erst beim Aufklappen
 * (Zwischenspeicher `['event', id]`, wird nach einer Antwort aktualisiert). Gründe und Abwesenheiten liefert der Server
 * nur an Berechtigte; das Trainerteam tippt eine Person an und korrigiert ihre Antwort.
 */
export function ParticipantPanel({
  event,
  open,
  canCorrect,
}: {
  event: EventSummary;
  open: boolean;
  canCorrect: boolean;
}) {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const [all, setAll] = useState(false);
  const [correcting, setCorrecting] = useState<Participant | null>(null);
  const query = useQuery({
    queryKey: ['event', event.id],
    queryFn: () => api<EventDetail>(`/events/${event.id}`),
    enabled: open,
  });
  if (!open) return null;
  const e = query.data;
  const mineIds = new Set(event.myResponses.map((m) => m.personId));
  const dot: Record<GroupKey, string> = {
    yes: colors.status.success.solid,
    maybe: colors.status.action.solid,
    pending: colors.anstoss.textTertiary,
    no: colors.status.urgent.solid,
    absent: colors.status.info.solid,
  };
  return (
    <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
      {query.isPending ? <Loading /> : null}
      {query.error ? <ErrorNotice error={query.error} onRetry={() => query.refetch()} /> : null}
      {e && e.participants.length === 0 && !query.isPending ? (
        <T variant="caption">{`🔒 ${t('Die Teilnehmer sieht nur das Trainerteam.')}`}</T>
      ) : null}
      {e
        ? GROUPS.map((g) => {
            const list = ordered(
              e.participants.filter((p) => groupOf(p) === g.key),
              mineIds,
            );
            if (list.length === 0) return null;
            const shown = list.slice(0, MAX_NAMES);
            return (
              <View key={g.key} style={{ gap: 2, marginTop: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot[g.key] }}
                  />
                  <T variant="section" style={{ fontSize: 11 }}>
                    {`${t(g.title)} · ${list.length}`}
                  </T>
                  {g.key === 'absent' ? (
                    <T variant="caption" style={{ fontSize: 11 }}>
                      {`(${t('in Absagen enthalten')})`}
                    </T>
                  ) : null}
                </View>
                {shown.map((p) => (
                  <ParticipantLine
                    key={p.personId}
                    p={p}
                    mine={mineIds.has(p.personId)}
                    onPress={canCorrect ? () => setCorrecting(p) : undefined}
                  />
                ))}
                {list.length > MAX_NAMES ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t('Alle anzeigen')} (${list.length})`}
                    onPress={() => setAll(true)}
                    style={{ minHeight: 36, justifyContent: 'center' }}
                  >
                    <T
                      variant="caption"
                      color={colors.primaryText}
                      style={{ fontWeight: '800', fontSize: 12.5 }}
                    >
                      {`${t('Alle anzeigen')} (${list.length}) ›`}
                    </T>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        : null}
      <SquadSheet eventId={event.id} visible={all} onClose={() => setAll(false)} />
      <CorrectionSheet
        eventId={event.id}
        title={event.title}
        person={correcting}
        onClose={() => setCorrecting(null)}
      />
    </View>
  );
}

function ParticipantLine({
  p,
  mine,
  onPress,
}: {
  p: Participant;
  mine: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const detail = [p.reason, p.absence ? t('Abwesend') : null].filter(Boolean).join(' · ');
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38 }}>
      <Avatar name={p.name} size={28} uri={p.avatarUrl} />
      <T style={{ fontSize: 13.5, fontWeight: mine ? '800' : '600', flexShrink: 1 }} verbatim>
        {p.name}
      </T>
      {mine ? (
        <T variant="caption" color={colors.primaryText} style={{ fontWeight: '800' }}>
          ({t('du')})
        </T>
      ) : null}
      <View style={{ flex: 1 }} />
      {detail ? (
        <T
          variant="caption"
          numberOfLines={1}
          verbatim
          style={{ flexShrink: 1, textAlign: 'right' }}
        >
          {detail}
        </T>
      ) : p.jerseyNumber !== null ? (
        <T variant="caption" verbatim>{`#${p.jerseyNumber}`}</T>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${t('Antwort ändern')}`}
      onPress={onPress}
    >
      {body}
    </Pressable>
  );
}

/** Trainerteam: Antwort einer Person korrigieren (auch nach Fristende, Rechte prüft der Server). */
function CorrectionSheet({
  eventId,
  title,
  person,
  onClose,
}: {
  eventId: string;
  title: string;
  person: Participant | null;
  onClose: () => void;
}) {
  const respond = useRespond(eventId);
  const [error, setError] = useState<string | null>(null);
  const set = (status: AttendanceStatus) => {
    if (!person) return;
    setError(null);
    respond.mutate(
      { personId: person.personId, status },
      {
        onSuccess: onClose,
        onError: (e) => setError(e instanceof Error ? e.message : t('Das hat nicht geklappt.')),
      },
    );
  };
  const rows: { status: AttendanceStatus; label: string }[] = [
    { status: 'yes', label: 'Zusage' },
    { status: 'maybe', label: 'Vielleicht' },
    { status: 'no', label: 'Absage' },
    { status: 'pending', label: 'Offen' },
  ];
  return (
    <Sheet
      visible={!!person}
      onClose={onClose}
      title={person ? t(`Antwort für ${person.name}`) : ''}
    >
      <T variant="caption" verbatim>
        {title}
      </T>
      {rows.map((r) => (
        <Button
          key={r.status}
          label={r.label}
          variant={person?.status === r.status ? 'primary' : 'outline'}
          loading={respond.isPending}
          onPress={() => set(r.status)}
        />
      ))}
      {error ? <T variant="caption">{error}</T> : null}
    </Sheet>
  );
}

/** Hinweis statt Zahlen und Liste, wenn die Mannschaft die Teilnehmer nicht freigibt. */
export function NotReleasedHint() {
  return <T variant="caption">{`🔒 ${t('Die Teilnehmer sieht nur das Trainerteam.')}`}</T>;
}
