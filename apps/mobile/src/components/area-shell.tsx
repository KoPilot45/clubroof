/**
 * Gemeinsame Bausteine der eigenen Bereiche „Admin-Verwaltung“ (violett) und „Vereinskasse“ (blau), Paket AV:
 * Kopfband mit „Beenden“, untere Leiste mit beschrifteten Reitern, Kategorien mit farbigen Untergruppen.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/app-text';
import { Breadcrumbs } from '@/components/sub-header';
import { Screen, T, TileGrid, shadowStyle, type IconName } from '@/components/ui';
import { breadcrumbsFor } from '@/lib/breadcrumbs';
import type { AreaCategory } from '@/lib/areas';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export type AreaTone = 'violet' | 'blue';

/** Kopfband des Bereichs: Farbe des Bereichs, Titel, aktuelle Seite und „Beenden“. */
function AreaBand({ tone, title, subtitle }: { tone: AreaTone; title: string; subtitle?: string }) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const c = colors.tints[tone];
  return (
    <View
      style={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg + 4,
        backgroundColor: c.container,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {subtitle ? (
          <T variant="caption" color={c.onContainer} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
        <T variant="headline" color={c.onContainer} numberOfLines={1} accessibilityRole="header">
          {title}
        </T>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(`${title} beenden`)}
        onPress={() => router.dismissTo('/mehr')}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: c.onContainer,
        }}
      >
        <Ionicons name="close-circle-outline" size={20} color={c.onContainer} />
        <Text style={{ color: c.onContainer, fontWeight: '800' }}>Beenden</Text>
      </Pressable>
    </View>
  );
}

/**
 * Kopf für `Stack`-Screens eines Bereichs. Auf den Reiterseiten nur das Band, auf Unterseiten zusätzlich der Pfad
 * („Verwaltung › Mitglieder › Mitglied“).
 */
export function AreaHeader({
  tone,
  areaTitle,
  rootCrumb,
  roots,
  route,
  options,
  prefix = '',
}: {
  tone: AreaTone;
  areaTitle: string;
  /** erste Stufe des Pfads (führt zur Übersicht des Bereichs) */
  rootCrumb: { label: string; href: string };
  /** Routennamen der Reiterseiten (ohne Pfad) */
  roots: string[];
  route: { name: string; params?: object };
  options: { title?: string };
  /** Namensvorsatz für die Pfadtabelle, z. B. „admin/“ */
  prefix?: string;
}) {
  const { colors } = useTheme();
  const title = options.title ?? route.name;
  const isRoot = roots.includes(route.name);
  const crumbs = isRoot
    ? []
    : (() => {
        const all = breadcrumbsFor(
          `${prefix}${route.name}`,
          (route.params ?? {}) as Record<string, string>,
          title,
        ).crumbs;
        // Die Tab-Stufe („Verein“) entfällt: Der Bereich beginnt mit seiner Übersicht.
        const rest = all.slice(1);
        const hasRoot = rest[0]?.label === rootCrumb.label;
        return [
          { label: rootCrumb.label, href: rootCrumb.href as never },
          ...(hasRoot ? rest.slice(1) : rest),
        ];
      })();
  return (
    <View style={{ backgroundColor: colors.background }}>
      <AreaBand tone={tone} title={areaTitle} />
      {isRoot ? null : (
        <View style={{ paddingTop: 10 }}>
          <Breadcrumbs crumbs={crumbs} />
        </View>
      )}
    </View>
  );
}

export type AreaTab = {
  key: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
};

/** Untere Leiste mit beschrifteten Reitern (Symbol über der Beschriftung), aktiver Reiter in der Bereichsfarbe. */
export function AreaTabBar({
  tone,
  items,
  onHeight,
}: {
  tone: AreaTone;
  items: AreaTab[];
  onHeight: (height: number) => void;
}) {
  const { colors, sizes, isDark, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  const bottom = Math.max(insets.bottom, 12) + 10;
  const height = 64;
  const c = colors.tints[tone];
  useEffect(() => {
    onHeight(height + bottom);
  }, [onHeight, bottom]);
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
      style={{ position: 'absolute', left: 12, right: 12, bottom, alignItems: 'center' }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          width: '100%',
          maxWidth: 520,
          height,
          borderRadius: 32,
          padding: 6,
          flexDirection: 'row',
          gap: 4,
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
            onPress={item.onPress}
            style={{
              flex: 1,
              minHeight: sizes.touchTarget,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              backgroundColor: item.active ? c.container : 'transparent',
            }}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={item.active ? c.onContainer : colors.onSurfaceMuted}
            />
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                fontWeight: item.active ? '800' : '600',
                color: item.active ? c.onContainer : colors.onSurfaceMuted,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Überschrift einer Untergruppe mit Farbpunkt. */
function GroupHeading({
  title,
  tint,
}: {
  title: string;
  tint: AreaCategory['groups'][number]['tint'];
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: colors.tints[tint].onContainer,
        }}
      />
      <T variant="section" accessibilityRole="header">
        {title}
      </T>
    </View>
  );
}

/** Seite einer Kategorie: Untergruppen mit Farbpunkt und Kacheln in der Farbe der Gruppe. */
export function CategoryPage({
  category,
  children,
}: {
  category: AreaCategory;
  children?: ReactNode;
}) {
  return (
    <Screen edges={[]}>
      {category.groups.map((g) => (
        <View key={g.key} style={{ gap: 16 }}>
          <GroupHeading title={g.title} tint={g.tint} />
          <TileGrid items={g.tiles.map((tile) => ({ ...tile, tint: g.tint }))} />
        </View>
      ))}
      {children}
    </Screen>
  );
}
