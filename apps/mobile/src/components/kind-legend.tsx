import { View } from 'react-native';
import { EVENT_KIND_LABELS, kindColor, type EventKind } from '@/lib/event-types';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

/** Legende der Terminarten (Farbpunkt immer mit Beschriftung). */
export function KindLegend({ kinds }: { kinds: EventKind[] }) {
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
    </View>
  );
}
