/**
 * Abteilungsübersicht im Team-Tab (Paket BU) für Sportliche Leitung, Jugendleitung und Vorstand: reine Übersicht,
 * kein Zugriff in die Mannschaften. Ampel nur für die Trainingsbeteiligung – immer mit Wort.
 */
import {
  AREA_LABELS,
  type AreaKey,
  type AreaOverview,
  type AreaTeamCard,
  type ParticipationLevel,
} from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import {
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  HeroCard,
  Loading,
  Screen,
  T,
  TeamBadge,
} from '@/components/ui';
import { formatShortDate, clubDayMinutes } from '@/lib/format';
import { dateFormat, t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Counted, GrowRow } from '@/lib/motion';

const LEVEL_WORD: Record<ParticipationLevel, string> = {
  good: 'gut',
  medium: 'mittel',
  low: 'niedrig',
  none: 'zu wenig Daten',
};

const whenFormat = dateFormat({ weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** Kennzahl in der Blickfläche. */
function Figure({ value, label }: { value: string | number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 70 }}>
      <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 28, lineHeight: 32 }}>
        {typeof value === 'number' ? <Counted value={value} /> : value}
      </T>
      <T variant="caption" color={colors.hero.onHero}>
        {label}
      </T>
    </View>
  );
}

function Bar({ parts }: { parts: { value: number; color: string }[] }) {
  const { colors } = useTheme();
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.border,
      }}
    >
      <GrowRow style={{ flexDirection: 'row', height: '100%' }}>
        {total > 0
          ? parts
              .filter((p) => p.value > 0)
              .map((p, i) => <View key={i} style={{ flex: p.value, backgroundColor: p.color }} />)
          : null}
      </GrowRow>
    </View>
  );
}

function TeamCard({ card, lite }: { card: AreaTeamCard; lite: boolean }) {
  const { colors } = useTheme();
  const { participation: p, nextMatch: m, squad } = card;
  const tone =
    p.level === 'good'
      ? 'success'
      : p.level === 'medium'
        ? 'action'
        : p.level === 'low'
          ? 'urgent'
          : 'neutral';
  const solid =
    p.level === 'good'
      ? colors.status.success.solid
      : p.level === 'medium'
        ? colors.status.action.solid
        : colors.status.urgent.solid;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TeamBadge badge={card.badge} />
        <T variant="heading" numberOfLines={1} style={{ flex: 1 }} verbatim>
          {card.name}
        </T>
      </View>
      <T variant="caption">
        {lite
          ? t(`${squad.total} Spieler`)
          : t(`Kader: ${squad.available} von ${squad.total} verfügbar`)}
      </T>
      <T variant="caption">
        {card.coaches.length ? (
          <>
            <T variant="label">{t('Trainerteam')}: </T>
            <T variant="caption" verbatim>
              {card.coaches.join(', ')}
            </T>
          </>
        ) : (
          t('Trainerteam: kein Trainer')
        )}
      </T>

      {lite ? null : (
        <View style={{ gap: 6 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <T variant="label">Trainingsbeteiligung</T>
            <Chip
              tone={tone}
              label={
                p.percent !== null && p.level !== 'none'
                  ? `${p.percent} % · ${t(LEVEL_WORD[p.level])}`
                  : t(LEVEL_WORD.none)
              }
            />
          </View>
          <Bar
            parts={
              p.level === 'none' || p.percent === null
                ? [{ value: 1, color: colors.border }]
                : [
                    { value: p.percent, color: solid },
                    { value: 100 - p.percent, color: colors.border },
                  ]
            }
          />
          <T variant="caption">
            {p.sessions > 0
              ? t(`${p.sessions} erfasste Einheiten in 4 Wochen`)
              : t('Keine erfasste Einheit in 4 Wochen')}
          </T>
        </View>
      )}

      <View style={{ gap: 6 }}>
        <T variant="label">Nächstes Spiel</T>
        {m ? (
          <>
            <T variant="caption" verbatim>
              {`${whenFormat.format(new Date(m.startsAt))} · ${formatShortDate(clubDayMinutes(m.startsAt).day)} · ${t(m.isHome ? 'Heim' : 'Auswärts')} · ${m.opponent}`}
            </T>
            {lite ? null : (
              <>
                <Bar
                  parts={[
                    { value: m.yes, color: colors.status.success.solid },
                    { value: m.no, color: colors.status.urgent.solid },
                    { value: m.open, color: colors.onSurfaceMuted },
                  ]}
                />
                <T variant="caption">
                  {t(`${m.yes} zugesagt · ${m.no} abgesagt · ${m.open} offen`)}
                </T>
              </>
            )}
          </>
        ) : (
          <T variant="caption">Kein Spiel geplant</T>
        )}
      </View>
    </Card>
  );
}

export function AreaOverviewScreen({ switcher }: { switcher?: ReactNode }) {
  const { api, me } = useSignedIn();
  const { colors } = useTheme();
  const [area, setArea] = useState<AreaKey | 'all'>('all');
  const query = useQuery({
    queryKey: ['club', 'areas', area],
    queryFn: () => api<AreaOverview>(`/club/areas?area=${area}`),
  });
  const o = query.data;
  const areas = me.areaOverview?.areas ?? [];
  const on = colors.hero.onHero;

  return (
    <Screen
      header={<AppHeader title="Team" subtitle="Abteilungsübersicht" />}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      {switcher}
      {areas.length > 1 ? (
        <ChoiceChips
          options={[
            { value: 'all', label: 'Alle' },
            ...areas.map((a) => ({ value: a, label: AREA_LABELS[a] })),
          ]}
          selected={[area]}
          onToggle={setArea}
        />
      ) : null}
      {query.isPending ? <Loading /> : null}
      {query.error ? <ErrorNotice error={query.error} onRetry={() => query.refetch()} /> : null}
      {o ? (
        <>
          <HeroCard>
            <T variant="overline" color={on}>
              {o.area === 'all'
                ? areas.length > 1
                  ? 'Gesamter Verein'
                  : AREA_LABELS[areas[0]!]
                : AREA_LABELS[o.area]}
            </T>
            <T variant="figure" color={on} style={{ fontSize: 44, lineHeight: 50 }}>
              <Counted value={o.summary.teams} />
            </T>
            <T variant="label" color={on} style={{ fontWeight: '400' }}>
              Mannschaften
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
              <Figure value={o.summary.players} label="Spieler" />
              <Figure value={o.summary.coaches} label="Trainer" />
              <Figure value={o.summary.matchesThisWeek} label="Spiele diese Woche" />
              {o.summary.trainingAverage !== null ? (
                <Figure value={`${o.summary.trainingAverage} %`} label="Training Ø" />
              ) : null}
            </View>
            {o.record ? (
              <View
                style={{
                  gap: 2,
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                }}
              >
                <T variant="overline" color={on}>
                  Bilanz Saison
                </T>
                <T variant="label" color={on} verbatim>
                  {t(
                    `${o.record.won} Siege · ${o.record.drawn} Remis · ${o.record.lost} Niederlagen`,
                  )}
                </T>
              </View>
            ) : null}
          </HeroCard>

          {o.teams.length === 0 ? (
            <Empty icon="shirt-outline" text="Keine Mannschaften in der Abteilung." />
          ) : null}
          {o.teams.map((card) => (
            <TeamCard key={card.id} card={card} lite={o.lite} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
