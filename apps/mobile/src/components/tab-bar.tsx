import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useContext, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { Text } from './app-text';
import { shadowStyle, type IconName } from './ui';

export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  team: ['people-outline', 'people'],
  termine: ['calendar-outline', 'calendar'],
  verein: ['shield-outline', 'shield'],
  mehr: ['grid-outline', 'grid'],
};

/** Platz, den die schwebende Leiste einnimmt (Höhe + Abstand unten) – Seiten halten darüber Luft. */
export const TAB_BAR_SPACE = 68 + 22;

/**
 * Schwebende Tab-Leiste: Pille mit fünf Punkten; der aktive Bereich ist eine farbige Pille mit
 * Beschriftung, die übrigen zeigen nur das Icon (Beschriftung für Screenreader).
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, sizes, isDark, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const [keyboard, setKeyboard] = useState(false);
  const bottom = Math.max(insets.bottom, 12) + 10;

  useEffect(() => {
    reportHeight?.(sizes.tabBar + bottom);
  }, [reportHeight, sizes.tabBar, bottom]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 20, right: 20, bottom, alignItems: 'center' }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          width: '100%',
          maxWidth: 480,
          height: sizes.tabBar,
          borderRadius: sizes.tabBar / 2,
          paddingHorizontal: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surfaceRaised,
          ...(isDark
            ? { borderWidth: 1, borderColor: colors.border }
            : shadowStyle(elevation.floating)),
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key]!;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const [off, on] = TAB_ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={{
                height: sizes.tabItem,
                minWidth: sizes.touchTarget + 2,
                paddingHorizontal: focused ? 16 : 0,
                borderRadius: sizes.tabItem / 2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: focused ? colors.primary : 'transparent',
              }}
            >
              <Ionicons
                name={focused ? on : off}
                size={22}
                color={focused ? colors.onPrimary : colors.onSurfaceMuted}
              />
              {focused ? (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 14, fontWeight: '700', color: colors.onPrimary }}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
