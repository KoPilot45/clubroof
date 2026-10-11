import { View } from 'react-native';
import { EVENT_KIND_LABELS, kindColor, type EventKind } from '@/lib/event-types';
import { useTheme } from '@/lib/theme';
import { gridChipStyle } from './month-calendar';
import { T } from './ui';

/** Legende der Terminarten (Farbpunkt immer mit Beschriftung). */
export function KindLegend({
  kinds,
  cancelled,
}: {
  kinds: EventKind[];
  /** zusätzlich „Abgesagt“ (roter Punkt) */
  cancelled?: boolean;
}) {
  const { colors } = useTheme();
  const order: EventKind[] = ['training', 'match', 'tournament', 'team', 'club'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {order
        .filter((k) => kinds.includes(k))
        .map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: kindColor(k, colors),
              }}
            />
            <T variant="caption">{EVENT_KIND_LABELS[k]}</T>
          </View>
        ))}
      {cancelled ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.status.urgent.solid,
            }}
          />
          <T variant="caption">Abgesagt</T>
        </View>
      ) : null}
    </View>
  );
}

/** Legende des Kalenderrasters: Beispiel-Chip mit Form und Farbe plus Beschriftung (nie nur Farbe). */
export function GridLegend({ cancelled }: { cancelled?: boolean }) {
  const { colors } = useTheme();
  const items: {
    label: string;
    type: 'match' | 'training' | 'team_event';
    team: boolean;
    cancelled?: boolean;
  }[] = [
    { label: 'Spiel', type: 'match', team: true },
    { label: 'Training', type: 'training', team: true },
    { label: 'Verein', type: 'team_event', team: false },
    ...(cancelled
      ? [{ label: 'Abgesagt', type: 'match' as const, team: true, cancelled: true }]
      : []),
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {items.map((i) => {
        const c = gridChipStyle(
          {
            type: i.type,
            team: i.team ? { id: '', name: '', badge: '' } : null,
            status: i.cancelled ? 'cancelled' : 'scheduled',
          },
          colors,
        );
        return (
          <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 26,
                height: 16,
                borderRadius: 6,
                backgroundColor: c.bg,
                borderWidth: 1,
                borderColor: c.border,
                borderStyle: c.dashed ? 'dashed' : 'solid',
              }}
            />
            <T
              variant="caption"
              style={{ textDecorationLine: i.cancelled ? 'line-through' : 'none' }}
            >
              {i.label}
            </T>
          </View>
        );
      })}
    </View>
  );
}
