import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/app-text';
import { lastOnlineAt, setOffline, useOffline } from '@/lib/connection';
import { formatTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/**
 * Hinweis am oberen Rand, solange keine Verbindung zum Server besteht: Stand der Anzeige,
 * was weiter lesbar ist, und „Erneut verbinden“.
 */
export function OfflineBanner() {
  const offline = useOffline();
  const { colors, radii, sizes } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  if (!offline) return null;
  const c = colors.status.action;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
    >
      <View
        accessibilityRole="alert"
        style={{
          marginTop: insets.top + 6,
          marginHorizontal: 12,
          paddingVertical: 10,
          paddingLeft: 14,
          paddingRight: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: radii.xl,
          backgroundColor: c.container,
          borderWidth: 1,
          borderColor: c.solid,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={22} color={c.onContainer} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.onContainer, fontWeight: '800', fontSize: 14 }}>
            Du bist offline
          </Text>
          <Text style={{ color: c.onContainer, fontSize: 12 }}>
            {`Angezeigt wird der Stand von ${formatTime(new Date(lastOnlineAt()).toISOString())} Uhr. Termine und Kader sind lesbar.`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setOffline(false);
            void queryClient.invalidateQueries();
          }}
          style={{
            minHeight: sizes.touchTarget,
            paddingHorizontal: 14,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.solid,
          }}
        >
          <Text style={{ color: c.onSolid, fontWeight: '800', fontSize: 13 }}>
            Erneut verbinden
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
