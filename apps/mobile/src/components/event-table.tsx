/**
 * Terminliste am Desktop als Tabelle (Paket TERMIN-ANTWORT-UND-TEILNEHMER, Entwurf „Desktop: Terminliste als Tabelle“):
 * Datum · Termin · Mannschaft · Meine Antwort (Chips mit Symbol und Wort) · Teilnehmer (Balken, Zahlen, „Teilnehmer ⌄“).
 * Aufklappen zeigt unter der Zeile über die volle Breite vier Gruppen nebeneinander (kein zweiter Scrollbereich).
 * Tastatur: Pfeil auf/ab wechselt die Zeile, Leertaste klappt auf, 1/2/3 oder Z/V/A setzen die Antwort der Fokuszeile.
 */
import type { EventDetail, EventSummary, Participant } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatDateTile, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { queuedFor, useOutbox } from '@/lib/outbox';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { AnswerKnobs, answerState, useAnswerFlow } from './event-answer';
import { EventRow } from './events';
import { SquadSheet } from './squad-sheet';
import { Avatar, Loading, T } from './ui';
import { useIsDesktop } from '@/lib/layout';

/** Terminliste: Tabelle am Desktop, gemeinsame Karten sonst. */
export function EventList({ events }: { events: EventSummary[] }) {
  const desktop = useIsDesktop();
  if (desktop) return <EventTable events={events} />;
  return (
    <View style={{ gap: 10 }}>
      {events.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
    </View>
  );
}

const COLS = { date: 150, team: 90, answer: 330, people: 250 };

function EventTable({ events }: { events: EventSummary[] }) {
  const { colors } = useTheme();
  const rows = useRef<Record<string, { focus: () => void } | null>>({});
  const focusAt = (i: number) => {
    const target = events[i];
    if (target) rows.current[target.id]?.focus();
  };
  const head = (label: string, style: object) => (
    <T variant="section" style={{ fontSize: 10.5, ...style }}>
      {label}
    </T>
  );
  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.anstoss.cardBorder,
        backgroundColor: colors.anstoss.card,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        {head(t('Datum'), { width: COLS.date })}
        {head(t('Termin'), { flex: 1 })}
        {head(t('Mannschaft'), { width: COLS.team })}
        {head(t('Meine Antwort'), { width: COLS.answer })}
        {head(t('Teilnehmer'), { width: COLS.people })}
      </View>
      {events.map((e, i) => (
        <TableRow
          key={e.id}
          event={e}
          register={(r) => (rows.current[e.id] = r)}
          onPrev={() => focusAt(i - 1)}
          onNext={() => focusAt(i + 1)}
        />
      ))}
    </View>
  );
}

function TableRow({
  event,
  register,
  onPrev,
  onNext,
}: {
  event: EventSummary;
  register: (r: { focus: () => void } | null) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const cancelled = event.status === 'cancelled';
  const past = new Date(event.startsAt).getTime() < Date.now();
  const r = event.myResponses.find((x) => x.role !== 'coach') ?? event.myResponses[0];
  const outbox = useOutbox();
  const queued = r ? queuedFor(outbox, event.id, r.personId) : undefined;
  const flow = useAnswerFlow(
    event,
    r ?? {
      personId: '',
      firstName: '',
      relation: 'self',
      role: 'player',
      status: 'pending',
      reason: null,
      canRespond: false,
      automatic: false,
      absent: false,
    },
  );
  const state = r
    ? answerState(event, queued ? { ...r, status: queued.status } : r, { past, queued: !!queued })
    : null;
  const tile = formatDateTile(event.startsAt);
  const counts = event.counts;
  const hasModel = !!r || (counts !== null && Object.values(counts).some((n) => n > 0));

  const onKey = (e: { key: string; target?: unknown; preventDefault?: () => void }) => {
    const el = e.target as { tagName?: string } | undefined;
    if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (key === 'arrowdown') {
      e.preventDefault?.();
      onNext();
    } else if (key === 'arrowup') {
      e.preventDefault?.();
      onPrev();
    } else if (key === ' ' && counts) {
      e.preventDefault?.();
      setOpen((v) => !v);
    } else if (state?.knobs && !state.locked) {
      const map: Record<string, 'yes' | 'maybe' | 'no'> = {
        '1': 'yes',
        z: 'yes',
        '2': 'maybe',
        v: 'maybe',
        '3': 'no',
        a: 'no',
      };
      if (map[key]) flow.answer(map[key]!);
    }
  };

  const total = counts ? counts.yes + counts.maybe + counts.no + counts.pending : 0;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      <Pressable
        ref={(node) => register(node as unknown as { focus: () => void } | null)}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${formatTime(event.startsAt)}`}
        onPress={() => router.push(`/events/${event.id}`)}
        {...({ onKeyDown: onKey } as object)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          opacity: cancelled ? 0.7 : 1,
        }}
      >
        <T verbatim style={{ width: COLS.date, fontSize: 13.5 }}>
          {`${tile.weekday.replace('.', '')} ${tile.day}. · ${formatTime(event.startsAt)}`}
        </T>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T
            verbatim
            numberOfLines={1}
            style={{
              fontWeight: '800',
              fontSize: 14,
              ...(cancelled ? { textDecorationLine: 'line-through' as const } : null),
            }}
          >
            {event.title}
          </T>
          <T variant="caption" verbatim numberOfLines={1}>
            {cancelled ? (event.cancelledReason ?? t('Termin abgesagt')) : (event.location ?? '')}
          </T>
        </View>
        <T verbatim style={{ width: COLS.team, fontSize: 13.5 }}>
          {event.team?.badge ?? t('Verein')}
        </T>
        <View style={{ width: COLS.answer }}>
          {cancelled ? (
            <T variant="caption">{t('Termin abgesagt')}</T>
          ) : state ? (
            state.knobs ? (
              <AnswerKnobs
                wide
                dense
                value={queued ? queued.status : (r?.status ?? 'pending')}
                needsAnswer={state.needsAnswer}
                locked={state.locked || flow.pending}
                allowMaybe={event.responseRules?.allowMaybe ?? true}
                onAnswer={flow.answer}
              />
            ) : (
              <T variant="caption" verbatim style={{ fontWeight: '800' }}>
                {state.line}
              </T>
            )
          ) : null}
        </View>
        <View style={{ width: COLS.people, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {counts && hasModel && !cancelled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={t(open ? 'Teilnehmer ausblenden' : 'Teilnehmer anzeigen')}
              onPress={() => setOpen(!open)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
            >
              <View
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  overflow: 'hidden',
                  flexDirection: 'row',
                  backgroundColor: colors.border,
                }}
              >
                {total > 0 ? (
                  <>
                    <View
                      style={{ flex: counts.yes, backgroundColor: colors.status.success.solid }}
                    />
                    <View
                      style={{ flex: counts.maybe, backgroundColor: colors.status.action.solid }}
                    />
                    <View
                      style={{ flex: counts.no, backgroundColor: colors.status.urgent.solid }}
                    />
                    <View style={{ flex: counts.pending }} />
                  </>
                ) : null}
              </View>
              <T variant="caption" verbatim style={{ fontSize: 12 }}>
                {`${counts.yes} · ${counts.maybe} · ${counts.no} · ${counts.pending}`}
              </T>
              <T variant="caption" color={colors.primaryText} style={{ fontWeight: '800' }}>
                {t('Teilnehmer')}
              </T>
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.primaryText}
              />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
      {flow.sheet}
      {open && counts ? <ExpandedGroups event={event} /> : null}
    </View>
  );
}

/** Vier Gruppen nebeneinander über die volle Breite (Abwesend unter den Absagen). */
function ExpandedGroups({ event }: { event: EventSummary }) {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const [all, setAll] = useState(false);
  const query = useQuery({
    queryKey: ['event', event.id],
    queryFn: () => api<EventDetail>(`/events/${event.id}`),
  });
  const e = query.data;
  const mineIds = new Set(event.myResponses.map((m) => m.personId));
  const byJersey = (a: Participant, b: Participant) =>
    (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name, 'de');
  const cols: { key: 'yes' | 'maybe' | 'pending' | 'no'; title: string; color: string }[] = [
    { key: 'yes', title: 'Zusagen', color: colors.status.success.solid },
    { key: 'maybe', title: 'Vielleicht', color: colors.status.action.solid },
    { key: 'pending', title: 'Offen', color: colors.anstoss.textTertiary },
    { key: 'no', title: 'Absagen', color: colors.status.urgent.solid },
  ];
  const column = (title: string, color: string, list: Participant[], note?: string) => (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <T variant="section" style={{ fontSize: 11 }}>{`${t(title)} · ${list.length}`}</T>
        {note ? (
          <T variant="caption" style={{ fontSize: 11 }}>
            {note}
          </T>
        ) : null}
      </View>
      {[
        ...list.filter((p) => mineIds.has(p.personId)),
        ...list.filter((p) => !mineIds.has(p.personId)),
      ]
        .slice(0, 4)
        .map((p) => (
          <View
            key={p.personId}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }}
          >
            <Avatar name={p.name} size={26} uri={p.avatarUrl} />
            <T
              verbatim
              style={{
                fontSize: 13.5,
                fontWeight: mineIds.has(p.personId) ? '800' : '600',
                flexShrink: 1,
              }}
            >
              {p.name}
            </T>
            {mineIds.has(p.personId) ? (
              <T variant="caption" color={colors.primaryText} style={{ fontWeight: '800' }}>
                ({t('du')})
              </T>
            ) : null}
            <View style={{ flex: 1 }} />
            <T variant="caption" verbatim numberOfLines={1}>
              {p.reason ?? (p.jerseyNumber !== null ? `#${p.jerseyNumber}` : '')}
            </T>
          </View>
        ))}
      {list.length > 4 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('Alle anzeigen')} (${list.length})`}
          onPress={() => setAll(true)}
          style={{ minHeight: 32, justifyContent: 'center' }}
        >
          <T variant="caption" color={colors.primaryText} style={{ fontWeight: '800' }}>
            {`${t('Alle anzeigen')} (${list.length}) ›`}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 8,
        backgroundColor: colors.anstoss.overlay,
      }}
    >
      {query.isPending ? <Loading /> : null}
      {e && e.participants.length === 0 && !query.isPending ? (
        <T variant="caption">{`🔒 ${t('Die Teilnehmer sieht nur das Trainerteam.')}`}</T>
      ) : null}
      {e && e.participants.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
          {cols.map((c) => {
            const list = e.participants
              .filter((p) => !p.absent && p.status === c.key)
              .sort(byJersey);
            const absent =
              c.key === 'no' ? e.participants.filter((p) => p.absent).sort(byJersey) : [];
            return (
              <View key={c.key} style={{ flex: 1, gap: 10 }}>
                {column(c.title, c.color, list)}
                {absent.length > 0
                  ? column(
                      'Abwesend',
                      colors.status.info.solid,
                      absent,
                      `(${t('in Absagen enthalten')})`,
                    )
                  : null}
              </View>
            );
          })}
        </View>
      ) : null}
      <SquadSheet eventId={event.id} visible={all} onClose={() => setAll(false)} />
    </View>
  );
}
