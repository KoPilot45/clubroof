import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelect } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/motion';
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

/** Aktive Kapsel: federt beim Aktivieren in 380 ms mit leichtem Überschwingen auf. */
function useCapsule(active: boolean) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      value.setValue(active ? 1 : 0);
      return;
    }
    Animated.timing(value, {
      toValue: active ? 1 : 0,
      duration: 380,
      easing: active ? Easing.out(Easing.back(1.6)) : Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [active, reduce, value]);
  return value.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
}

function NavDot({ item, children }: { item: NavItem; children: React.ReactNode }) {
  const scale = useCapsule(item.active);
  return (
    <Animated.View
      style={{ flex: item.active ? 2.2 : 1, flexDirection: 'row', transform: [{ scale }] }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Schwebende Leiste: Pille mit bis zu fünf Punkten; der aktive Punkt ist eine farbige Pille mit
 * Beschriftung, die übrigen zeigen nur das Icon (Beschriftung für Screenreader). Gemeinsame Grundlage
 * der Tab-Leiste und der Verwaltungs-Navigation.
 */
export function FloatingNav({
  items,
  onHeight,
  accent,
}: {
  items: NavItem[];
  /** abweichende Farbe der aktiven Pille (Verwaltung violett, Vereinskasse blau) */
  accent?: { fill: string; on: string };
  /** meldet Höhe samt Abstand zum unteren Rand (damit Seiten Platz lassen) */
  onHeight?: (height: number) => void;
}) {
  const { colors, sizes, isDark, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  const bottom = Math.max(insets.bottom, 4) + 10;

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
      style={{ position: 'absolute', left: 16, right: 16, bottom, alignItems: 'center' }}
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
          backgroundColor: colors.anstoss.tabBar,
          borderWidth: 1,
          borderColor: colors.anstoss.tabBarBorder,
          ...(isDark ? null : shadowStyle(elevation.floating)),
        }}
      >
        {items.map((item) => (
          <NavDot key={item.key} item={item}>
            <Pressable
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
                backgroundColor: item.active ? (accent?.fill ?? colors.primary) : 'transparent',
              }}
            >
              <Ionicons
                name={item.active ? item.iconActive : item.icon}
                size={22}
                color={item.active ? (accent?.on ?? colors.onPrimary) : colors.anstoss.textTertiary}
              />
              {item.active ? (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 14, fontWeight: '700', color: accent?.on ?? colors.onPrimary }}
                >
                  {item.label}
                </Text>
              ) : null}
            </Pressable>
          </NavDot>
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
