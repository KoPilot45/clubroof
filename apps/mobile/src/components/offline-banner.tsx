import { useQueryClient } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/app-text';
import { setOffline, useOffline } from '@/lib/connection';
import { useTheme } from '@/lib/theme';

/** Hinweis am oberen Rand, solange keine Verbindung zum Server besteht. */
export function OfflineBanner() {
  const offline = useOffline();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  if (!offline) return null;
  const c = colors.status.urgent;
  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingTop: insets.top + 6,
        paddingBottom: 8,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: c.container,
      }}
    >
      <Text style={{ flex: 1, color: c.onContainer, fontWeight: '600', fontSize: 13 }}>
        Keine Verbindung. Die Anzeige ist evtl. nicht aktuell.
      </Text>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          setOffline(false);
          void queryClient.invalidateQueries();
        }}
      >
        <Text style={{ color: c.onContainer, fontWeight: '800', fontSize: 13 }}>
          Erneut versuchen
        </Text>
      </Pressable>
    </View>
  );
}
