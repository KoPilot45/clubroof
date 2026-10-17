import type { EventDetail } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, View } from 'react-native';
import { AttendanceBar } from '@/components/team';
import { Chip, HeroCard, T, TeamBadge } from '@/components/ui';
import { formatDay, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { EVENT_TYPE_LABELS, MATCH_KIND_LABELS } from '@/lib/labels';
import { useTheme } from '@/lib/theme';

/**
 * Der eine Hero im Termin-Detail (Paket TH): Spiel mit Heim – Zeit/Ergebnis – Gast, sonst Titel; darunter Datum,
 * Ortszeile mit Route und – bei Mannschaftsterminen, wenn die Mannschaft die Übersicht freigibt – Zu- und Absagen.
 */
export function EventHero({
  event: e,
  clubShortName,
  past,
}: {
  event: EventDetail;
  clubShortName: string;
  past: boolean;
}) {
  const { colors } = useTheme();
  const on = colors.hero.onHero;
  const soft = 'rgba(255,255,255,0.88)';
  const cancelled = e.status === 'cancelled';
  const match = e.match;
  const strike = cancelled ? ('line-through' as const) : ('none' as const);
  const timeRange = `${formatTime(e.startsAt)}${e.endsAt ? `–${formatTime(e.endsAt)}` : ''} Uhr`;

  const ours = `${clubShortName}${e.team ? ` ${e.team.badge}` : ''}`;
  const [home, away] = match
    ? match.isHome
      ? [ours, match.opponentName]
      : [match.opponentName, ours]
    : ['', ''];
  const played = !!match && match.goalsFor != null && match.goalsAgainst != null;
  const score =
    match && played
      ? match.isHome
        ? `${match.goalsFor} : ${match.goalsAgainst}`
        : `${match.goalsAgainst} : ${match.goalsFor}`
      : formatTime(e.startsAt);
  const overline = match
    ? [match.competition, e.type === 'tournament' ? t('Turnier') : t(MATCH_KIND_LABELS[match.kind])]
        .filter(Boolean)
        .join(' · ')
    : null;
  const showBar = !!e.counts && !!e.team && !cancelled && (e.type === 'match' || e.type === 'training');

  return (
    <HeroCard style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {e.team ? <TeamBadge badge={e.team.badge} /> : <Chip tone="info" label="Verein" />}
        <Chip tone="neutral" label={EVENT_TYPE_LABELS[e.type]} />
        {cancelled ? <Chip tone="urgent" icon="close-circle" label="Abgesagt" /> : null}
        {past ? <Chip tone="archived" icon="time-outline" label="Vergangener Termin" /> : null}
      </View>

      {match ? (
        <View
          accessibilityRole="summary"
          accessibilityLabel={`${home} gegen ${away}, ${score}`}
          style={{ gap: 8 }}
        >
          {overline ? (
            <T variant="overline" color={on} style={{ textAlign: 'center' }} verbatim>
              {overline}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T
              variant="heading"
              color={on}
              style={{ flex: 1, textAlign: 'center', textDecorationLine: strike }}
              numberOfLines={2}
              verbatim
            >
              {home}
            </T>
            <T variant="figure" color={on} style={{ fontSize: 40 }} verbatim>
              {score}
            </T>
            <T
              variant="heading"
              color={on}
              style={{ flex: 1, textAlign: 'center', textDecorationLine: strike }}
              numberOfLines={2}
              verbatim
            >
              {away}
            </T>
          </View>
        </View>
      ) : (
        <T
          variant="figure"
          color={on}
          style={{ fontSize: 46, lineHeight: 48, textDecorationLine: strike }}
          verbatim
        >
          {e.title}
        </T>
      )}

      <T
        color={soft}
        style={{ fontSize: 14, textAlign: match ? 'center' : 'left' }}
        verbatim
      >
        {[formatDay(e.startsAt), match && !played ? null : timeRange]
          .filter(Boolean)
          .join(' · ')}
      </T>
      {e.cancelledReason ? (
        <T color={on} style={{ fontWeight: '700', textAlign: match ? 'center' : 'left' }}>
          {e.cancelledReason}
        </T>
      ) : null}

      {e.location ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.25)',
          }}
        >
          <Ionicons name="location-outline" size={20} color={on} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700', fontSize: 15 }} color={on} verbatim>
              {e.location}
            </T>
            {e.meetingAt || e.meetingPoint ? (
              <T variant="caption" color="rgba(255,255,255,0.8)" verbatim>
                {[e.meetingAt ? `${t('Treffpunkt')} ${formatTime(e.meetingAt)}` : null, e.meetingPoint]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            ) : null}
          </View>
          {e.routeUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('Route')}
              hitSlop={10}
              onPress={() => void Linking.openURL(e.routeUrl!)}
            >
              <T style={{ fontWeight: '800', fontSize: 13 }} color={on}>
                Route ›
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showBar ? (
        <View
          style={{
            gap: 8,
            padding: 14,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.25)',
          }}
        >
          <T variant="overline" color={on}>
            Zu- und Absagen
          </T>
          <AttendanceBar counts={e.counts!} hero />
        </View>
      ) : null}

      {e.invited ? (
        <T variant="caption" color="rgba(255,255,255,0.8)" verbatim>
          {t(
            `Eingeladen: ${[
              ...e.invited.teams,
              e.invited.persons
                ? `${e.invited.persons} ${e.invited.persons === 1 ? 'Person' : 'Personen'}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}`,
          )}
        </T>
      ) : null}
    </HeroCard>
  );
}
