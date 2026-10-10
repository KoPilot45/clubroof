import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useContext, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelect } from '@/lib/haptics';
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

export type NavItem = {
  key: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

/**
 * Schwebende Leiste: Pille mit bis zu fünf Punkten; der aktive Punkt ist eine farbige Pille mit
 * Beschriftung, die übrigen zeigen nur das Icon (Beschriftung für Screenreader). Gemeinsame Grundlage
 * der Tab-Leiste und der Verwaltungs-Navigation.
 */
export function FloatingNav({
  items,
  onHeight,
}: {
  items: NavItem[];
  /** meldet Höhe samt Abstand zum unteren Rand (damit Seiten Platz lassen) */
  onHeight?: (height: number) => void;
}) {
  const { colors, sizes, isDark, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  const bottom = Math.max(insets.bottom, 12) + 10;

  useEffect(() => {
    onHeight?.(sizes.tabBar + bottom);
  }, [onHeight, sizes.tabBar, bottom]);
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
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            aria-selected={item.active}
            onPress={() => {
              if (!item.active) hapticSelect();
              item.onPress();
            }}
            onLongPress={item.onLongPress}
            style={{
              height: sizes.tabItem,
              minWidth: sizes.touchTarget + 2,
              paddingHorizontal: item.active ? 16 : 0,
              borderRadius: sizes.tabItem / 2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: item.active ? colors.primary : 'transparent',
            }}
          >
            <Ionicons
              name={item.active ? item.iconActive : item.icon}
              size={22}
              color={item.active ? colors.onPrimary : colors.onSurfaceMuted}
            />
            {item.active ? (
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: '700', color: colors.onPrimary }}
              >
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Tab-Leiste der App (Home, Team, Termine, Verein, Mehr). */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const items: NavItem[] = state.routes.map((route, index) => {
    const focused = state.index === index;
    const { options } = descriptors[route.key]!;
    const [off, on] = TAB_ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
    return {
      key: route.key,
      label: typeof options.title === 'string' ? options.title : route.name,
      icon: off,
      iconActive: on,
      active: focused,
      onPress: () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
      },
      onLongPress: () => navigation.emit({ type: 'tabLongPress', target: route.key }),
    };
  });
  return <FloatingNav items={items} onHeight={reportHeight} />;
}
