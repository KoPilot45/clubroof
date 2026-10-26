import type { ClubSchedule, ClubScheduleMatch, OrgUnitKind } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@/components/icon';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import {
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { formatDay, formatTime } from '@/lib/format';
import { MATCH_KIND_LABELS } from '@/lib/labels';
import { dateFormat, t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const FILTERS: { kind: OrgUnitKind; label: string }[] = [
  { kind: 'seniors', label: 'Senioren' },
  { kind: 'youth', label: 'Jugend' },
];

const range = dateFormat({ day: 'numeric', month: 'short', timeZone: 'UTC' });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (iso: string, days: number) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Kalenderwoche nach ISO 8601 */
function isoWeek(iso: string): number {
  const d = utc(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((d.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7,
    )
  );
}

/** Wochen-Spielplan des Vereins (Paket WS): alle Spiele pro Woche, nach Tagen, Filter Senioren/Jugend. */
export default function ClubScheduleScreen() {
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState<OrgUnitKind | null>(null);

  // Basiswoche: heutige Woche (vom Server), dann ±offset Wochen
  const base = useQuery({
    queryKey: ['club-schedule', 'base'],
    queryFn: () => api<ClubSchedule>('/club/schedule'),
  });
  const week = base.data ? addDays(base.data.weekStart, offset * 7) : null;
  const schedule = useQuery({
    queryKey: ['club-schedule', week],
    queryFn: () => api<ClubSchedule>(`/club/schedule?week=${week}`),
    enabled: !!week,
    placeholderData: (prev) => prev,
  });
  // Nachbarwochen vorladen, damit das Wischen sofort zeigt
  useQuery({
    queryKey: ['club-schedule', week ? addDays(week, 7) : null],
    queryFn: () => api<ClubSchedule>(`/club/schedule?week=${addDays(week!, 7)}`),
    enabled: !!week,
  });
  useQuery({
    queryKey: ['club-schedule', week ? addDays(week, -7) : null],
    queryFn: () => api<ClubSchedule>(`/club/schedule?week=${addDays(week!, -7)}`),
    enabled: !!week,
  });

  // Wischen: nach links = nächste Woche
  const step = useRef((_d: number) => {});
  step.current = (d) => setOffset((o) => o + d);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -50) step.current(1);
          else if (g.dx > 50) step.current(-1);
        },
      }),
    [],
  );

  const s = schedule.data;
  const matchesOf = (list: ClubScheduleMatch[]) => list.filter((m) => !kind || m.unitKind === kind);
  const days = (s?.days ?? [])
    .map((d) => ({ ...d, matches: matchesOf(d.matches) }))
    .filter((d) => d.matches.length > 0);
  const free = (s?.free ?? []).filter((x) => !kind || x.unitKind === kind);
  const filters = FILTERS.filter((f) => base.data?.kinds.includes(f.kind));
  const label = s
    ? t(
        `KW ${isoWeek(s.weekStart)} · ${range.format(utc(s.weekStart))} – ${range.format(utc(s.weekEnd))}`,
      )
    : '';
  const relative =
    offset === 0
      ? t('Diese Woche')
      : offset === 1
        ? t('Nächste Woche')
        : offset === -1
          ? t('Letzte Woche')
          : null;

  const arrow = (icon: 'chevron-back' | 'chevron-forward', delta: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => setOffset((o) => o + delta)}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceVariant,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.onSurface} />
    </Pressable>
  );

  return (
    <Screen edges={[]} refreshing={schedule.isRefetching} onRefresh={() => schedule.refetch()}>
      {base.error ? <ErrorNotice error={base.error} onRetry={() => base.refetch()} /> : null}
      {base.isPending ? <Loading /> : null}
      {s ? (
        <View {...pan.panHandlers} style={{ gap: 14 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            {arrow('chevron-back', -1, t('Vorherige Woche'))}
            <View style={{ alignItems: 'center', gap: 2, flexShrink: 1 }}>
              <T variant="label" style={{ fontWeight: '700' }} accessibilityRole="header">
                {label}
              </T>
              {relative ? <T variant="caption">{relative}</T> : null}
            </View>
            {arrow('chevron-forward', 1, t('Nächste Woche'))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} aria-hidden>
            {[-2, -1, 0, 1, 2].map((d) => (
              <View
                key={d}
                style={{
                  width: d === 0 ? 20 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: d === 0 ? colors.primary : colors.border,
                  opacity: Math.abs(d) === 2 ? 0.5 : 1,
                }}
              />
            ))}
          </View>

          {filters.length > 0 ? (
            <ChoiceChips
              label="Anzeigen"
              options={[
                { value: 'all', label: 'Alle' },
                ...filters.map((f) => ({ value: f.kind, label: f.label })),
              ]}
              selected={[kind ?? 'all']}
              onToggle={(v) => setKind(v === 'all' ? null : (v as OrgUnitKind))}
            />
          ) : null}

          {days.length === 0 ? (
            <Card>
              <Empty
                icon="football-outline"
                text="Keine Spiele in dieser Woche"
                hint="Wische oder tippe auf die Pfeile, um andere Wochen zu sehen."
              />
            </Card>
          ) : null}
          {days.map((d) => (
            <Section key={d.date} title={formatDay(`${d.date}T12:00:00Z`)}>
              <View style={{ gap: 10 }}>
                {d.matches.map((m) => (
                  <MatchRow key={m.event.id} match={m} club={s} />
                ))}
              </View>
            </Section>
          ))}
          {free.length > 0 ? (
            <Card style={{ borderRadius: radii.xl }}>
              <T variant="caption">{t(`Spielfrei: ${free.map((x) => x.badge).join(', ')}`)}</T>
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function MatchRow({ match, club }: { match: ClubScheduleMatch; club: ClubSchedule }) {
  void club;
  const { colors } = useTheme();
  const e = match.event;
  const m = e.match!;
  const played = m.goalsFor !== null && m.goalsAgainst !== null;
  const outcome = !played
    ? null
    : m.goalsFor! > m.goalsAgainst!
      ? ('success' as const)
      : m.goalsFor! < m.goalsAgainst!
        ? ('urgent' as const)
        : ('archived' as const);
  const meeting = e.meetingAt
    ? [t(`Treffen ${formatTime(e.meetingAt)}`), e.meetingPoint].filter(Boolean).join(' · ')
    : e.meetingPoint;
  return (
    <Card style={{ gap: 8 }}>
      <Pressable
        accessibilityRole={match.canOpen ? 'button' : undefined}
        accessibilityLabel={e.title}
        disabled={!match.canOpen}
        onPress={() => router.push(`/events/${e.id}`)}
        style={{ gap: 8 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <T variant="label" style={{ fontWeight: '700' }}>
            {formatTime(e.startsAt)}
          </T>
          {e.team ? <Chip tone="primary" label={e.team.name} /> : null}
          <Chip tone="neutral" label={m.isHome ? 'Heimspiel' : 'Auswärts'} />
          <Chip tone="neutral" label={MATCH_KIND_LABELS[m.kind]} />
          {e.status === 'cancelled' ? (
            <Chip tone="urgent" icon="close-circle" label="Termin abgesagt" />
          ) : null}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <T variant="label" style={{ flex: 1, color: colors.onSurface }} verbatim>
            {m.opponentName}
          </T>
          {outcome ? <Chip tone={outcome} label={`${m.goalsFor}:${m.goalsAgainst}`} /> : null}
        </View>
        <T variant="caption">{[e.location, meeting].filter(Boolean).join(' · ')}</T>
      </Pressable>
    </Card>
  );
}
