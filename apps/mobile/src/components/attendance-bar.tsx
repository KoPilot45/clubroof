import type { AttendanceCounts } from '@clubroof/core';
import { Pressable, View } from 'react-native';
import { t } from '@/lib/i18n';
import { GrowRow } from '@/lib/motion';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

/**
 * Beschriftungen der Rückmeldungen („12 Zusagen“, „1 Unsicher“, „1 Absage“, „6 offen“): Zahl davor, bei einer Person
 * im Singular. Wer wegen einer Abwesenheit ausfällt, zählt hier als Absage. Die Texte kommen nur von hier.
 */
export function attendanceLabels(counts: AttendanceCounts) {
  return {
    yes: counts.yes === 1 ? t('1 Zusage') : t(`${counts.yes} Zusagen`),
    maybe: t(`${counts.maybe} Unsicher`),
    no: counts.no === 1 ? t('1 Absage') : t(`${counts.no} Absagen`),
    pending: t(`${counts.pending} offen`),
  };
}

/**
 * Balken der Rückmeldungen zu einem Termin mit Legende „12 Zusagen · 1 Unsicher · 2 Absagen · 6 offen“ (Punkt + Text,
 * nie nur Farbe). `hero`: auf dunklem Untergrund (offen = Weiß 28 %); `compact`: Balken 8 px und eine Legendenzeile
 * (Home-Plakat). `onPress`: Balken und Legende sind eine antippbare Fläche (mindestens 44 pt, Paket KP); am Ende der
 * Legende steht „Kader ›“, außer `link={false}` (dann sitzt der Link in der Titelzeile des Heros).
 */
export function AttendanceBar({
  counts,
  hero,
  compact,
  onPress,
  onPressIn,
  link = true,
}: {
  counts: AttendanceCounts;
  hero?: boolean;
  compact?: boolean;
  onPress?: () => void;
  /** z. B. zum Vorladen der Kaderliste beim Berühren */
  onPressIn?: () => void;
  link?: boolean;
}) {
  const { colors } = useTheme();
  const track = hero ? 'rgba(255,255,255,0.28)' : colors.border;
  const text = hero ? colors.hero.onHero : undefined;
  const labels = attendanceLabels(counts);
  const parts = [
    { key: 'yes', n: counts.yes, color: colors.status.success.solid, label: labels.yes },
    { key: 'maybe', n: counts.maybe, color: colors.status.action.solid, label: labels.maybe },
    { key: 'no', n: counts.no, color: colors.status.urgent.solid, label: labels.no },
    { key: 'pending', n: counts.pending, color: track, label: labels.pending },
  ];
  const total = parts.reduce((sum, p) => sum + p.n, 0);
  const caption = compact ? { fontSize: 11.5, lineHeight: 15 } : null;
  const body = (
    <View style={{ gap: compact ? 6 : 8 }}>
      <View
        aria-hidden
        style={{
          height: compact ? 8 : 10,
          borderRadius: compact ? 4 : 5,
          overflow: 'hidden',
          backgroundColor: track,
        }}
      >
        <GrowRow style={{ flexDirection: 'row', height: '100%' }}>
          {total > 0
            ? parts
                .filter((p) => p.n > 0)
                .map((p) => <View key={p.key} style={{ flex: p.n, backgroundColor: p.color }} />)
            : null}
        </GrowRow>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 }}>
        {parts.map((p) => (
          <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
            <T variant="caption" color={text} verbatim style={caption}>
              {p.label}
            </T>
          </View>
        ))}
        {onPress && link ? (
          <T
            variant="caption"
            color={hero ? colors.hero.onHero : colors.primaryText}
            style={{ fontWeight: '800', ...caption }}
          >
            Kader ›
          </T>
        ) : null}
      </View>
    </View>
  );
  const summary = parts.map((p) => p.label).join(', ');
  if (!onPress)
    return (
      <View accessible accessibilityLabel={summary}>
        {body}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('Kader anzeigen')}: ${summary}`}
      onPress={onPress}
      onPressIn={onPressIn}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      {body}
    </Pressable>
  );
}
