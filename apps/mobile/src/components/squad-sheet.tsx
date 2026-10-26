import type { AttendanceCounts, EventDetail, Participant } from '@clubroof/core';
import { Ionicons } from '@/components/icon';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { t } from '@/lib/i18n';
import { formatDay, formatShortDate } from '@/lib/format';
import { ABSENCE_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { AttendanceBar } from './attendance-bar';
import { Avatar, Button, Chip, ErrorNotice, Loading, Sheet, T } from './ui';

type GroupKey = 'yes' | 'maybe' | 'pending' | 'no' | 'absent';
const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'yes', title: 'Zusagen' },
  { key: 'maybe', title: 'Unsicher' },
  { key: 'pending', title: 'Offen' },
  { key: 'no', title: 'Absagen' },
  { key: 'absent', title: 'Abwesend' },
];

const groupOf = (p: Participant): GroupKey => (p.absent ? 'absent' : p.status);

/** Trainer zuerst, dann nach Rückennummer, ohne Nummer alphabetisch. */
function sortGroup(list: Participant[]): Participant[] {
  return [...list].sort((a, b) => {
    const coach = Number(b.role === 'coach') - Number(a.role === 'coach');
    if (coach) return coach;
    if (a.jerseyNumber !== null && b.jerseyNumber !== null) return a.jerseyNumber - b.jerseyNumber;
    if (a.jerseyNumber !== null) return -1;
    if (b.jerseyNumber !== null) return 1;
    return a.name.localeCompare(b.name, 'de');
  });
}

function Row({
  p,
  first,
  mine,
  past,
  dot,
}: {
  p: Participant;
  first: boolean;
  mine: 'self' | 'child' | null;
  past: boolean;
  dot: string;
}) {
  const { colors } = useTheme();
  const detail = [
    p.reason ? `„${p.reason}“` : null,
    p.absence
      ? `${t(ABSENCE_LABELS[p.absence.kind])} · ${t(`bis ${formatShortDate(p.absence.endsOn)}`)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View
      accessible
      accessibilityLabel={[
        p.name,
        mine === 'self' ? t('Du') : mine === 'child' ? t('Dein Kind') : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: mine ? 8 : 0,
        borderTopWidth: first || mine ? 0 : 1,
        borderTopColor: colors.border,
        borderRadius: mine ? 14 : 0,
        borderWidth: mine ? 1.5 : 0,
        borderColor: mine ? colors.primary : undefined,
        backgroundColor: mine ? colors.primaryContainer : undefined,
        marginVertical: mine ? 2 : 0,
      }}
    >
      <Avatar name={p.name} size={34} uri={p.avatarUrl} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <T style={{ fontSize: 13.5, fontWeight: '700' }} verbatim>
            {p.name}
          </T>
          {mine ? (
            <T variant="caption" color={colors.primaryText} style={{ fontWeight: '800' }}>
              {mine === 'self' ? 'Du' : 'Dein Kind'}
            </T>
          ) : null}
          {p.role === 'coach' ? <Chip tone="neutral" label="Trainer" /> : null}
          {p.role === 'guest_player' && p.guestFromTeam ? (
            <Chip tone="info" label={t(`Gast · ${p.guestFromTeam}`)} />
          ) : null}
          {past && p.status === 'yes' && p.attended !== null ? (
            <Chip tone={p.attended ? 'success' : 'urgent'} label={p.attended ? 'da' : 'fehlte'} />
          ) : null}
        </View>
        {detail ? (
          <T variant="caption" numberOfLines={2} verbatim>
            {detail}
          </T>
        ) : null}
      </View>
      {p.jerseyNumber !== null ? (
        <T variant="headline" color={colors.onSurfaceMuted} style={{ fontSize: 18 }} verbatim>
          {`#${p.jerseyNumber}`}
        </T>
      ) : (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      )}
    </View>
  );
}

/**
 * Kader-Pop-up (Paket KP): die vollständige Kaderliste eines Termins in einem Fenster von unten – Zusagen, Unsicher,
 * Offen, Absagen und ganz unten Abwesend. Die Teilnehmer kommen über den Termin-Detail-Aufruf (Rechte serverseitig:
 * Gründe, Abwesenheit und „da/fehlte“ nur für das Trainerteam).
 */
export function SquadSheet({
  eventId,
  visible,
  onClose,
  inEventScreen,
}: {
  eventId: string;
  visible: boolean;
  onClose: () => void;
  /** im Termin-Detail entfällt „Termin öffnen“ */
  inEventScreen?: boolean;
}) {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api<EventDetail>(`/events/${eventId}`),
    enabled: visible,
  });
  const e = query.data;
  const past = !!e && new Date(e.startsAt) < new Date();
  const dotColor: Record<GroupKey, string> = {
    yes: colors.status.success.solid,
    maybe: colors.status.action.solid,
    pending: colors.anstoss.textTertiary,
    no: colors.status.urgent.solid,
    absent: colors.status.info.solid,
  };
  const mineOf = (id: string): 'self' | 'child' | null => {
    const r = e?.myResponses.find((m) => m.personId === id);
    return r ? (r.relation === 'self' ? 'self' : 'child') : null;
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T variant="headline" style={{ fontSize: 24, lineHeight: 28 }} accessibilityRole="header">
            {e ? `${t('KADER')} · ${formatDay(e.startsAt)}` : t('KADER')}
          </T>
          {e ? (
            <T variant="caption" numberOfLines={1} verbatim>
              {e.title}
            </T>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Schließen')}
          hitSlop={10}
          onPress={onClose}
          style={{ padding: 6 }}
        >
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
      </View>
      {query.isPending ? <Loading /> : null}
      {query.error ? <ErrorNotice error={query.error} onRetry={() => query.refetch()} /> : null}
      {e?.counts ? <AttendanceBar counts={e.counts} /> : null}
      {e
        ? GROUPS.map((g) => {
            const list = sortGroup(e.participants.filter((p) => groupOf(p) === g.key));
            if (list.length === 0) return null;
            return (
              <View
                key={g.key}
                accessibilityRole="summary"
                accessibilityLabel={`${t(g.title)}, ${t(`${list.length} Personen`)}`}
                style={{ gap: 6 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: dotColor[g.key],
                    }}
                  />
                  <T variant="section" style={{ flex: 1, fontSize: 12 }}>
                    {g.title}
                  </T>
                  <T variant="label" verbatim>
                    {list.length}
                  </T>
                </View>
                <View
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    paddingHorizontal: 12,
                  }}
                >
                  {list.map((p, i) => (
                    <Row
                      key={p.personId}
                      p={p}
                      first={i === 0}
                      mine={mineOf(p.personId)}
                      past={past}
                      dot={dotColor[g.key]}
                    />
                  ))}
                </View>
              </View>
            );
          })
        : null}
      {e && e.participants.length === 0 && !query.isPending ? (
        <T variant="caption">Die Kaderliste ist für dich nicht freigegeben.</T>
      ) : null}
      {!inEventScreen && e ? (
        <Button
          label="Termin öffnen"
          variant="outline"
          onPress={() => {
            onClose();
            router.push(`/events/${e.id}`);
          }}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * Zu-/Absage-Balken mit Kader-Pop-up: Balken und Legende sind eine antippbare Fläche. Ohne Zahlen (Mannschaft gibt die
 * Übersicht für Spieler und Eltern nicht frei) entfällt alles. Die Kaderliste wird beim Berühren vorgeladen.
 */
export function AttendanceOverview({
  event,
  counts,
  hero,
  compact,
  link,
  inEventScreen,
  renderTitleLink,
}: {
  event: { id: string };
  counts: AttendanceCounts | null;
  hero?: boolean;
  compact?: boolean;
  link?: boolean;
  inEventScreen?: boolean;
  /** Termin-Hero: Link „Kader ›“ in der Titelzeile statt am Ende der Legende */
  renderTitleLink?: (open: () => void) => React.ReactNode;
}) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  if (!counts) return null;
  const prefetch = () =>
    void queryClient.prefetchQuery({
      queryKey: ['event', event.id],
      queryFn: () => api<EventDetail>(`/events/${event.id}`),
    });
  return (
    <>
      {renderTitleLink?.(() => setOpen(true))}
      <AttendanceBar
        counts={counts}
        hero={hero}
        compact={compact}
        link={link}
        onPress={() => setOpen(true)}
        onPressIn={prefetch}
      />
      <SquadSheet
        eventId={event.id}
        visible={open}
        onClose={() => setOpen(false)}
        inEventScreen={inEventScreen}
      />
    </>
  );
}
