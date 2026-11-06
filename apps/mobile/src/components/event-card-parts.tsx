/**
 * Bausteine der Terminkarte, Variante D (Paket DESIGN-HELL-TERMINKARTE-HERO, Vorlage `TerminkarteHero.html`):
 * Kopf (Datumskachel in der Farbe der Terminart, Marke, Titel, Mannschaft, „Treffen · Treffpunkt“), Chip zum Stand der
 * eigenen Antwort, Verteilungsbalken und Zählerleiste (✓ ? ✕ als Antwortknöpfe, vierter Knopf öffnet die Teilnehmerliste).
 * Jeder Baustein hat eine Variante „auf Hero“ (dunkle, leicht transparente Flächen): so nutzen Terminkarte,
 * Start-Plakat, „Als nächstes“ und Termin-Detail dieselben Teile.
 */
import { eventTypeColor } from '@clubroof/design-tokens';
import type { AttendanceCounts, AttendanceStatus, EventSummary, MyResponse } from '@clubroof/core';
import { Ionicons } from '@/components/icon';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/app-text';
import { formatAnswerBy, formatDateTile, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { GrowRow } from '@/lib/motion';
import { useTheme } from '@/lib/theme';
import type { ThemeColors } from '@clubroof/design-tokens';
import { T, withAlpha } from './ui';
import type { AnswerState } from './event-answer';

type Answer = 'yes' | 'maybe' | 'no';

/** Farben der Karte: auf der hellen/dunklen Kartenfläche oder auf dem Hero. */
export function useCardPalette(onHero?: boolean) {
  const { colors } = useTheme();
  if (onHero) {
    return {
      fg: colors.hero.onHero,
      fg2: withAlpha(colors.hero.onHero, 0.9),
      line: colors.hero.glassBorder,
      glass: colors.hero.glass,
      glassStrong: colors.hero.glassStrong,
      track: colors.hero.track,
      num: { yes: colors.hero.yes, maybe: colors.hero.maybe, no: colors.hero.no } as Record<
        Answer,
        string
      >,
      fill: { yes: '#FFFFFF', maybe: '#FFFFFF', no: '#FFFFFF' } as Record<Answer, string>,
      onFill: { yes: colors.hero.to, maybe: colors.hero.to, no: colors.hero.to } as Record<
        Answer,
        string
      >,
      pending: colors.hero.track,
    };
  }
  return {
    fg: colors.onSurface,
    fg2: colors.onSurfaceMuted,
    line: colors.anstoss.fieldBorder,
    glass: colors.surface,
    glassStrong: colors.anstoss.overlay,
    track: colors.border,
    num: {
      yes: colors.status.success.onContainer,
      maybe: colors.status.action.onContainer,
      no: colors.status.urgent.onContainer,
    } as Record<Answer, string>,
    fill: {
      yes: colors.status.success.solid,
      maybe: colors.status.action.solid,
      no: colors.status.urgent.solid,
    } as Record<Answer, string>,
    onFill: {
      yes: colors.status.success.onSolid,
      maybe: colors.status.action.onSolid,
      no: colors.status.urgent.onSolid,
    } as Record<Answer, string>,
    pending: colors.border,
  };
}

/** Farbe der Terminart (hell/dunkel) – Datumskachel und Marke. */
export function useTypeColor(type: EventSummary['type']) {
  const { scheme } = useTheme();
  return eventTypeColor(type, scheme);
}

/** Datumskachel: Wochentag, Tag, darunter der Beginn; Fläche in der Farbe der Terminart (auf Hero: dunkles Glas). */
export function TypeDateTile({
  event,
  muted,
  onHero,
}: {
  event: Pick<EventSummary, 'type' | 'startsAt'>;
  muted?: boolean;
  onHero?: boolean;
}) {
  const { colors } = useTheme();
  const color = useTypeColor(event.type);
  const { weekday, day } = formatDateTile(event.startsAt);
  const bg = onHero ? colors.hero.glassStrong : muted ? colors.surfaceVariant : color;
  const fg = muted && !onHero ? colors.anstoss.textTertiary : '#FFFFFF';
  return (
    <View
      accessible={false}
      style={{
        width: 56,
        borderRadius: 14,
        paddingTop: 6,
        paddingBottom: 5,
        alignItems: 'center',
        backgroundColor: bg,
        ...(onHero ? { borderWidth: 1, borderColor: colors.hero.glassBorder } : null),
      }}
    >
      <Text
        style={{
          fontSize: 10.5,
          lineHeight: 13,
          fontWeight: '700',
          color: fg,
          textTransform: 'uppercase',
        }}
      >
        {weekday.replace('.', '')}
      </Text>
      <T variant="figure" color={fg} style={{ fontSize: 25, lineHeight: 26 }}>
        {day}
      </T>
      <View
        style={{
          marginTop: 3,
          paddingTop: 3,
          width: '78%',
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.45)',
        }}
      >
        <Text verbatim style={{ fontSize: 11.5, fontWeight: '700', color: fg }}>
          {formatTime(event.startsAt)}
        </Text>
      </View>
    </View>
  );
}

/** Marke der Terminart („SPIEL“): Fläche in der Terminfarbe, auf dem Hero als weißer Umriss. */
export function TypeMark({ type, onHero }: { type: EventSummary['type']; onHero?: boolean }) {
  const color = useTypeColor(type);
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
        backgroundColor: onHero ? 'transparent' : color,
        ...(onHero ? { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' } : null),
      }}
    >
      <Text
        style={{
          fontSize: 10,
          lineHeight: 14,
          fontWeight: '700',
          letterSpacing: 0.5,
          color: '#FFFFFF',
          textTransform: 'uppercase',
        }}
      >
        {t(EVENT_TYPE_LABELS[type])}
      </Text>
    </View>
  );
}

/** „Treffen 12:15 · Treffpunkt“; fehlt eins von beidem, steht der Ort. */
export function meetLine(
  event: Pick<EventSummary, 'meetingAt' | 'meetingPoint' | 'location'>,
): string | null {
  if (event.meetingAt && event.meetingPoint)
    return `${t('Treffen')} ${formatTime(event.meetingAt)} · ${event.meetingPoint}`;
  return event.location ?? event.meetingPoint ?? null;
}

/** Zeile unter dem Titel: Mannschaftspunkt mit Kürzel (bei Eltern der Name des Kindes davor) und Treffen/Ort. */
export function EventMeta({
  event,
  childName,
  teamColor,
  onHero,
  lines = 1,
}: {
  event: EventSummary;
  childName?: string | null;
  teamColor?: string | null;
  onHero?: boolean;
  lines?: number;
}) {
  const { colors } = useTheme();
  const p = useCardPalette(onHero);
  const where = meetLine(event);
  const badge = event.team?.badge ?? t('Verein');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: onHero ? '#FFFFFF' : (teamColor ?? colors.primary),
        }}
      />
      <T variant="caption" color={p.fg} verbatim style={{ fontSize: 11.5, fontWeight: '700' }}>
        {[childName, badge].filter(Boolean).join(' · ')}
      </T>
      {where ? (
        <T
          variant="caption"
          color={p.fg2}
          verbatim
          numberOfLines={lines}
          style={{ fontSize: 11.5, flexShrink: 1 }}
        >
          {`· ${where}`}
        </T>
      ) : null}
    </View>
  );
}

/** Wortlaut des Chips zum Stand der eigenen Antwort. */
export function answerChipText(
  event: EventSummary,
  r: MyResponse,
  state: AnswerState,
): { text: string; kind: 'yes' | 'maybe' | 'no' | 'warn' | 'expired' | 'muted'; icon?: 'timer' } {
  const who = r.relation === 'child' ? r.firstName : null;
  const named = (you: string, other: (n: string) => string) => (who ? other(who) : you);
  if (event.status === 'cancelled') return { text: t('Termin abgesagt'), kind: 'no' };
  if (r.role === 'coach') return { text: t('Automatisch eingeplant'), kind: 'muted' };
  if (state.tone === 'muted') return { text: state.line, kind: 'muted' };
  if (r.status === 'pending') {
    if (state.locked)
      return { text: t('Zeit zum Zu-/Absagen abgelaufen'), kind: 'expired', icon: 'timer' };
    return {
      text: event.deadline ? formatAnswerBy(event.deadline) : t('Antwort offen'),
      kind: 'warn',
    };
  }
  if (r.absent) return { text: named(t('Du: Abwesend ✕'), (n) => t(`${n}: Abwesend ✕`)), kind: 'no' };
  const auto = r.automatic;
  if (r.status === 'yes')
    return auto
      ? { text: named(t('Du: Zugesagt (automatisch)'), (n) => t(`${n}: Zugesagt (automatisch)`)), kind: 'yes' }
      : { text: named(t('Du: Zugesagt ✓'), (n) => t(`${n}: Zugesagt ✓`)), kind: 'yes' };
  if (r.status === 'maybe')
    return { text: named(t('Du: Vielleicht ?'), (n) => t(`${n}: Vielleicht ?`)), kind: 'maybe' };
  return { text: named(t('Du: Abgesagt ✕'), (n) => t(`${n}: Abgesagt ✕`)), kind: 'no' };
}

/** Chip zum Stand der eigenen Antwort (Wort und Zeichen, nie nur Farbe). */
export function AnswerChip({
  event,
  r,
  state,
  onHero,
}: {
  event: EventSummary;
  r: MyResponse;
  state: AnswerState;
  onHero?: boolean;
}) {
  const { colors } = useTheme();
  const c = answerChipText(event, r, state);
  const s = colors.status;
  let bg: string;
  let fg: string;
  let border: string | undefined;
  if (onHero) {
    bg = colors.hero.glass;
    fg = colors.hero.onHero;
    border = colors.hero.glassBorder;
    if (c.kind === 'warn') {
      bg = '#FFE7BF';
      fg = '#7A3E00';
      border = undefined;
    } else if (c.kind === 'expired') {
      bg = '#FFD9D5';
      fg = '#8C1C13';
      border = undefined;
    }
  } else {
    const pick = {
      yes: s.success,
      maybe: s.action,
      no: s.urgent,
      warn: s.action,
      expired: s.urgent,
      muted: null,
    }[c.kind];
    bg = pick ? pick.container : colors.surfaceVariant;
    fg = pick ? pick.onContainer : colors.onSurfaceMuted;
  }
  return (
    <View
      accessible
      accessibilityLabel={c.text}
      style={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 3,
        backgroundColor: bg,
        ...(border ? { borderWidth: 1, borderColor: border } : null),
      }}
    >
      {c.icon ? <Ionicons name="timer-outline" size={13} color={fg} /> : null}
      <Text verbatim style={{ flexShrink: 1, fontSize: 11, fontWeight: '700', color: fg }}>
        {c.text}
      </Text>
    </View>
  );
}

/** Rahmenfarbe der Karte nach dem Stand der eigenen Antwort (null: Standardrahmen). */
export function frameFor(
  colors: ThemeColors,
  event: EventSummary,
  r: MyResponse | undefined,
  state: AnswerState | null,
): { color: string; width: number } | null {
  if (!r || !state || event.status === 'cancelled' || r.role === 'coach') return null;
  if (state.tone === 'muted') return null;
  if (r.status === 'pending')
    return state.locked
      ? { color: colors.status.urgent.solid, width: 1.5 }
      : { color: colors.status.action.solid, width: 2 };
  const s = colors.status;
  return {
    color: (r.status === 'yes' ? s.success : r.status === 'maybe' ? s.action : s.urgent).solid,
    width: 1.5,
  };
}

/** Schlanke Verteilung der Antworten (6 px): Zusage, Vielleicht, Absage, offen – ohne Legende. */
export function DistBar({ counts, onHero }: { counts: AttendanceCounts; onHero?: boolean }) {
  const p = useCardPalette(onHero);
  const parts = [
    { key: 'yes', n: counts.yes, color: p.num.yes },
    { key: 'maybe', n: counts.maybe, color: p.num.maybe },
    { key: 'no', n: counts.no, color: p.num.no },
    { key: 'pending', n: counts.pending, color: p.pending },
  ];
  // Balken in kräftiger Farbe (auf hellem Grund die Statusflächen, nicht die dunklen Textfarben)
  const { colors } = useTheme();
  const bar: Record<string, string> = onHero
    ? { yes: p.num.yes, maybe: p.num.maybe, no: p.num.no, pending: p.pending }
    : {
        yes: colors.status.success.solid,
        maybe: colors.status.action.solid,
        no: colors.status.urgent.solid,
        pending: p.pending,
      };
  const total = parts.reduce((a, x) => a + x.n, 0);
  return (
    <View
      aria-hidden
      style={{
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        backgroundColor: onHero ? colors.hero.glass : colors.surfaceVariant,
      }}
    >
      <GrowRow style={{ flexDirection: 'row', height: '100%', gap: 2 }}>
        {total > 0
          ? parts
              .filter((x) => x.n > 0)
              .map((x) => <View key={x.key} style={{ flex: x.n, backgroundColor: bar[x.key] }} />)
          : null}
      </GrowRow>
    </View>
  );
}

const WORD: Record<Answer, string> = { yes: 'Zusage', maybe: 'Vielleicht', no: 'Absage' };

/**
 * Zählerleiste: ✓ n | ? n | ✕ n | Personen-Symbol „n offen ›“. Mit `onAnswer` sind ✓ ? ✕ Antwortknöpfe (die eigene
 * Antwort ist gefüllt); ohne sind es Anzeigen. `locked`: gesperrt und gedimmt (Frist abgelaufen). Der vierte Knopf
 * öffnet die Teilnehmerliste.
 */
export function CounterBar({
  counts,
  value,
  onAnswer,
  locked,
  allowMaybe = true,
  onOpenList,
  onHero,
}: {
  counts: AttendanceCounts;
  /** eigene Antwort (gefüllt) */
  value?: AttendanceStatus;
  onAnswer?: (a: Answer) => void;
  locked?: boolean;
  allowMaybe?: boolean;
  onOpenList: () => void;
  onHero?: boolean;
}) {
  const { colors } = useTheme();
  const p = useCardPalette(onHero);
  const list: Answer[] = allowMaybe ? ['yes', 'maybe', 'no'] : ['yes', 'no'];
  const border = onHero ? colors.hero.glassBorder : colors.anstoss.fieldBorder;
  const cellBg = onHero ? colors.hero.glass : colors.surface;
  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: border,
        overflow: 'hidden',
        backgroundColor: cellBg,
      }}
    >
      {list.map((a) => {
        const selected = value === a;
        const interactive = !!onAnswer;
        const n = counts[a];
        const label = `${t(WORD[a])}, ${n}`;
        const content = (
          <>
            {a === 'yes' ? (
              <Ionicons name="checkmark" size={16} color={selected ? p.onFill[a] : p.num[a]} />
            ) : a === 'no' ? (
              <Ionicons name="close" size={16} color={selected ? p.onFill[a] : p.num[a]} />
            ) : (
              <Text
                verbatim
                style={{ fontSize: 15, fontWeight: '800', color: selected ? p.onFill[a] : p.num[a] }}
              >
                ?
              </Text>
            )}
            <T
              variant="figure"
              verbatim
              color={selected ? p.onFill[a] : p.num[a]}
              style={{ fontSize: 15, lineHeight: 18 }}
            >
              {n}
            </T>
          </>
        );
        const style = {
          flex: 1,
          minHeight: 44,
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          gap: 5,
          borderRightWidth: 1,
          borderRightColor: border,
          backgroundColor: selected ? p.fill[a] : cellBg,
          opacity: locked && !selected ? 0.5 : 1,
        };
        return interactive ? (
          <Pressable
            key={a}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled: !!locked }}
            disabled={locked}
            onPress={() => onAnswer(a)}
            style={style}
          >
            {content}
          </Pressable>
        ) : (
          <View key={a} accessible accessibilityLabel={label} style={style}>
            {content}
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('Teilnehmerliste')}, ${t(`${counts.pending} offen`)}`}
        onPress={onOpenList}
        style={{
          flex: 1.55,
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          backgroundColor: onHero ? colors.hero.glassStrong : colors.surfaceVariant,
        }}
      >
        <Ionicons name="people-outline" size={16} color={onHero ? p.fg : colors.primaryText} />
        <Text
          verbatim
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: onHero ? p.fg : colors.primaryText,
          }}
        >
          {t(`${counts.pending} offen`)}
        </Text>
        <Ionicons name="chevron-forward" size={13} color={p.fg2} />
      </Pressable>
    </View>
  );
}
