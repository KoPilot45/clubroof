/**
 * Ring-Countdown auf dem Hero (Paket DESIGN-HELL-TERMINKARTE-HERO, Variante 3): 64 px, Fortschritt = wie nah der Termin
 * rückt (Fenster 7 Tage, weiter entfernt ist der Ring leer), in der Mitte Zahl und Einheit. Zustände: in n Tagen,
 * morgen („1 Tag“), heute (Stunden, unter einer Stunde Minuten), läuft gerade (Ring voll, roter Punkt).
 */
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/app-text';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

const WINDOW_MS = 7 * 86_400_000;

export type CountdownState = {
  kind: 'days' | 'tomorrow' | 'hours' | 'minutes' | 'live';
  value: number;
  /** Anteil 0–1 für den Ring */
  progress: number;
};

/** Kalendertage bis zum Beginn in der Vereinszeitzone (0 = heute). */
function calendarDays(startsAt: Date, now: Date, timeZone: string): number {
  const dayOf = (d: Date) =>
    Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone }).format(d) + 'T00:00:00Z');
  return Math.round((dayOf(startsAt) - dayOf(now)) / 86_400_000);
}

export function countdownState(
  startsAt: string,
  endsAt: string | null,
  now = new Date(),
  timeZone = 'Europe/Berlin',
): CountdownState {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 2 * 3_600_000);
  const ms = start.getTime() - now.getTime();
  if (ms <= 0 && now < end) return { kind: 'live', value: 0, progress: 1 };
  const progress = Math.min(1, Math.max(0, 1 - ms / WINDOW_MS));
  const days = calendarDays(start, now, timeZone);
  if (days >= 2) return { kind: 'days', value: days, progress: ms > WINDOW_MS ? 0 : progress };
  if (days === 1) return { kind: 'tomorrow', value: 1, progress };
  if (ms >= 3_600_000) return { kind: 'hours', value: Math.floor(ms / 3_600_000), progress };
  return { kind: 'minutes', value: Math.max(1, Math.ceil(Math.max(ms, 0) / 60_000)), progress };
}

/** Text für Bildschirmleser. */
export function countdownLabel(c: CountdownState): string {
  switch (c.kind) {
    case 'live':
      return t('Läuft gerade');
    case 'tomorrow':
      return t('Beginnt morgen');
    case 'days':
      return t(`Beginnt in ${c.value} Tagen`);
    case 'hours':
      return c.value === 1 ? t('Beginnt in 1 Stunde') : t(`Beginnt in ${c.value} Stunden`);
    default:
      return c.value === 1 ? t('Beginnt in 1 Minute') : t(`Beginnt in ${c.value} Minuten`);
  }
}

export function CountdownRing({ startsAt, endsAt }: { startsAt: string; endsAt: string | null }) {
  const { colors } = useTheme();
  const c = countdownState(startsAt, endsAt);
  const r = 26;
  const len = 2 * Math.PI * r;
  const unit =
    c.kind === 'days'
      ? c.value === 1
        ? 'Tag'
        : 'Tage'
      : c.kind === 'tomorrow'
        ? 'Tag'
        : c.kind === 'hours'
          ? 'Std'
          : c.kind === 'minutes'
            ? 'Min'
            : 'läuft';
  return (
    <View
      accessible
      accessibilityLabel={countdownLabel(c)}
      style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={64} height={64} viewBox="0 0 64 64" style={{ position: 'absolute' }} aria-hidden>
        <Circle cx={32} cy={32} r={r} fill="none" stroke={colors.hero.track} strokeWidth={6} />
        <Circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={colors.hero.onHero}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${len * c.progress} ${len}`}
          transform="rotate(-90 32 32)"
        />
      </Svg>
      {c.kind === 'live' ? (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.hero.no }} />
      ) : (
        <T
          variant="figure"
          verbatim
          color={colors.hero.onHero}
          style={{ fontSize: 24, lineHeight: 24 }}
        >
          {c.value}
        </T>
      )}
      <Text
        style={{
          fontSize: 9.5,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: colors.hero.onHero,
          marginTop: c.kind === 'live' ? 3 : 0,
        }}
      >
        {t(unit)}
      </Text>
    </View>
  );
}
