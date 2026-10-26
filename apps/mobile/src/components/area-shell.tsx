/**
 * Gemeinsame Bausteine der eigenen Bereiche „Admin-Verwaltung“ (violett) und „Vereinskasse“ (blau), Paket AV:
 * Kopfband mit „Zur App“, untere Leiste mit beschrifteten Reitern, Kategorien mit farbigen Untergruppen.
 */
import { Ionicons } from '@/components/icon';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/app-text';
import { Breadcrumbs, PageTitle } from '@/components/sub-header';
import { FloatingNav } from '@/components/tab-bar';
import { GradientFill, Screen, T, TileGrid, type IconName } from '@/components/ui';
import { breadcrumbsFor } from '@/lib/breadcrumbs';
import type { AreaCategory } from '@/lib/areas';
import { Columns } from '@/components/columns';
import { t } from '@/lib/i18n';
import { useIsDesktop } from '@/lib/layout';
import { useTheme } from '@/lib/theme';
import { webState } from '@/lib/web-state';

export type AreaTone = 'violet' | 'blue';

/** Reiter des Bereichs für die schlanke Kopfzeile am Desktop (Paket DT3); die Layouts stellen sie bereit. */
export const AreaTabsContext = createContext<AreaTab[]>([]);

/**
 * Desktop (Paket DT3): statt Kopfband und unterer Leiste eine schlanke Zeile mit Bereichsname (Farbe nur als
 * Akzentstrich), den Unterbereichen als Reitern und „Zur App“.
 */
function DesktopAreaBar({ tone, title }: { tone: AreaTone; title: string }) {
  const { colors, isDark } = useTheme();
  const tabs = useContext(AreaTabsContext);
  const [fill, on] = AREA_ACCENT[tone][isDark ? 'dark' : 'light'];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.anstoss.divider,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: fill }} />
        <T variant="headline" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 26 }}>
          {title}
        </T>
      </View>
      <View role="tablist" style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {tabs.map((i) => (
          <Pressable
            key={i.key}
            accessibilityRole="tab"
            accessibilityLabel={i.label}
            aria-selected={i.active}
            onPress={i.onPress}
            style={(state) => ({
              minHeight: 36,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              borderRadius: 18,
              backgroundColor: i.active
                ? fill
                : webState(state).hovered
                  ? colors.anstoss.overlay
                  : 'transparent',
            })}
          >
            <Ionicons name={i.icon} size={16} color={i.active ? on : colors.onSurface} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: i.active ? '800' : '600',
                color: i.active ? on : colors.onSurface,
              }}
            >
              {i.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Zur App')}
        onPress={() => router.dismissTo('/verein')}
        style={{
          minHeight: 36,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="close-circle-outline" size={18} color={colors.onSurface} />
        <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: '700' }}>
          {t('Zur App')}
        </Text>
      </Pressable>
    </View>
  );
}

/** Kopfband des Bereichs: Farbe des Bereichs, Titel, aktuelle Seite und „Beenden“. */
function AreaBand({ tone, title, subtitle }: { tone: AreaTone; title: string; subtitle?: string }) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const band = colors.anstoss.bands[tone === 'violet' ? 'admin' : 'cash'];
  const c = { container: band[0], onContainer: '#FFFFFF' };
  return (
    <View
      style={{
        paddingTop: insets.top + 18,
        paddingBottom: 14,
        paddingHorizontal: spacing.lg + 4,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <GradientFill from={band[0]} to={band[1]} vertical />
      <View style={{ flex: 1, minWidth: 0 }}>
        {subtitle ? (
          <T variant="caption" color="rgba(255,255,255,0.78)" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
        <T
          variant="figure"
          color={c.onContainer}
          numberOfLines={1}
          accessibilityRole="header"
          style={{ fontSize: 28, lineHeight: 30, letterSpacing: 0 }}
        >
          {title}
        </T>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Zur App')}
        onPress={() => router.dismissTo('/verein')}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.4)',
        }}
      >
        <Ionicons name="close-circle-outline" size={20} color={c.onContainer} />
        <Text style={{ color: c.onContainer, fontSize: 13.5, fontWeight: '800' }}>
          {t('Zur App')}
        </Text>
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
  const desktop = useIsDesktop();
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
      {desktop ? (
        <DesktopAreaBar tone={tone} title={areaTitle} />
      ) : (
        <AreaBand tone={tone} title={areaTitle} />
      )}
      {isRoot ? null : desktop ? (
        <PageTitle crumbs={crumbs} title={title} />
      ) : (
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

/** Aktive Pille der Bereichs-Navigation: solide Bereichsfarbe, Schrift darauf mit ausreichendem Kontrast. */
export const AREA_ACCENT: Record<AreaTone, { dark: [string, string]; light: [string, string] }> = {
  violet: { dark: ['#7C4DE0', '#FFFFFF'], light: ['#6D3FD1', '#FFFFFF'] },
  blue: { dark: ['#4C8DFF', '#06142E'], light: ['#2563D6', '#FFFFFF'] },
};

/**
 * Untere Leiste von Verwaltung und Vereinskasse: dieselbe schwebende Pille wie in der übrigen App (Paket AP);
 * der aktive Reiter zeigt Symbol und Text in der Bereichsfarbe, die übrigen nur ein Symbol.
 */
export function AreaTabBar({
  tone,
  items,
  onHeight,
}: {
  tone: AreaTone;
  items: AreaTab[];
  onHeight: (height: number) => void;
}) {
  const { isDark } = useTheme();
  const desktop = useIsDesktop();
  const [fill, on] = AREA_ACCENT[tone][isDark ? 'dark' : 'light'];
  // Desktop (Paket DT): feste Bereichsleiste unten mit beschrifteten Reitern statt schwebender Pille
  useEffect(() => {
    if (desktop) onHeight(0);
  }, [desktop, onHeight]);
  if (desktop) return null;
  return (
    <FloatingNav
      accent={{ fill, on }}
      onHeight={onHeight}
      items={items.map((i) => ({ ...i, iconActive: i.icon }))}
    />
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
      <T variant="section" style={{ fontSize: 22, lineHeight: 25 }} accessibilityRole="header">
        {title}
      </T>
    </View>
  );
}

/** Seite einer Kategorie: Untergruppen mit Farbpunkt und Kacheln in der Farbe der Gruppe. */
export function CategoryPage({
  category,
  children,
  top,
}: {
  category: AreaCategory;
  children?: ReactNode;
  /** Zeile über den Gruppen (z. B. Textlink „Auswertung ansehen ›“) */
  top?: ReactNode;
}) {
  return (
    <Screen edges={[]}>
      {top}
      <Columns min={380} gap={28}>
        {category.groups.map((g) => (
          <View key={g.key} style={{ gap: 18, paddingTop: 34 }}>
            <GroupHeading title={g.title} tint={g.tint} />
            <TileGrid items={g.tiles.map((tile) => ({ ...tile, tint: g.tint }))} />
          </View>
        ))}
      </Columns>
      {children}
    </Screen>
  );
}
