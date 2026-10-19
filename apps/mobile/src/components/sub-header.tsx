/**
 * Kopf aller Unterseiten (Paket NV): dieselbe Kopfzeile wie in den Tabs (Wappen, Bereichsname, Suche,
 * Benachrichtigungen) und darunter der Pfad als Pillen (Entwurf N2): runder Zurück-Knopf, vorige Stufen
 * antippbar, letzte Stufe gefüllt. Ab vier Stufen steht zwischen erster und letzter Stufe „…“ mit der Liste der übrigen; Stufen sind höchstens 14 Zeichen lang.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, HeaderButton, SearchField } from '@/components/app-header';
import { useIsDesktop } from '@/lib/layout';
import { ListRow, Sheet, T } from '@/components/ui';
import {
  breadcrumbsFor,
  collapseCrumbs,
  shortCrumb,
  TAB_LABELS,
  type Crumb,
} from '@/lib/breadcrumbs';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

type HeaderProps = {
  route: { name: string; params?: object };
  options: { title?: string };
  /** Namensvorsatz verschachtelter Navigatoren, z. B. „admin/“ */
  prefix?: string;
};

function go(href: Crumb['href']) {
  if (href) router.dismissTo(href);
}

function goBack(crumbs: Crumb[]) {
  if (router.canGoBack()) router.back();
  else router.replace((crumbs[crumbs.length - 2]?.href ?? '/') as never);
}

/**
 * Desktop (Paket DT3): Pfad als Text mit „›“ (ohne die aktuelle Seite); steht über dem Seitentitel. Ohne
 * übergeordnete Stufe gibt es stattdessen den Zurück-Pfeil.
 */
export function CrumbLine({ parents }: { parents: Crumb[] }) {
  const { colors } = useTheme();
  return (
    <View
      role="navigation"
      accessibilityLabel={t('Pfad')}
      style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}
    >
      {parents.map((c, i) => (
        <View key={`${c.label}${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {i > 0 ? (
            <Ionicons name="chevron-forward" size={12} color={colors.onSurfaceMuted} />
          ) : null}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t(c.label)}
            onPress={() => go(c.href)}
          >
            <T variant="caption" color={colors.primaryText} style={{ fontWeight: '700' }}>
              {shortCrumb(c.label)}
            </T>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/**
 * Pfad als Pillen. Mit `current` (Standard) ist die letzte Stufe die aktuelle Seite; ohne steht der Seitentitel
 * schon groß darüber und der Pfad zeigt nur die übergeordneten Stufen.
 */
export function Breadcrumbs({ crumbs, current = true }: { crumbs: Crumb[]; current?: boolean }) {
  const { colors, spacing, radii } = useTheme();
  const [open, setOpen] = useState(false);
  const { shown, hidden } = collapseCrumbs(crumbs);
  const lastIndex = shown.length - 1;
  const sep = (key: string) => (
    <Ionicons key={key} name="chevron-forward" size={14} color={colors.onSurfaceMuted} />
  );
  const pills: React.ReactNode[] = [];
  shown.forEach((c, i) => {
    if (i > 0) pills.push(sep(`s${i}`));
    if (i === 1 && hidden.length) {
      pills.push(
        <Pressable
          key="more"
          accessibilityRole="button"
          accessibilityLabel={t('Weitere Stufen anzeigen')}
          onPress={() => setOpen(true)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <View
            style={{
              height: 32,
              minWidth: 36,
              paddingHorizontal: 10,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceVariant,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T variant="label" verbatim>
              …
            </T>
          </View>
        </Pressable>,
      );
      pills.push(sep('s-more'));
    }
    const label = c.label;
    if (current && i === lastIndex) {
      pills.push(
        <View
          key={`c${i}`}
          aria-current="page"
          style={{
            height: 32,
            paddingHorizontal: 14,
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
            justifyContent: 'center',
          }}
        >
          <T
            variant="label"
            color={colors.onPrimary}
            numberOfLines={1}
            style={{ maxWidth: 200, fontWeight: '700' }}
          >
            {label}
          </T>
        </View>,
      );
    } else {
      pills.push(
        <Pressable
          key={`c${i}`}
          accessibilityRole="button"
          accessibilityLabel={t(label)}
          onPress={() => go(c.href)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <View
            style={{
              height: 32,
              paddingHorizontal: 14,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceVariant,
              justifyContent: 'center',
            }}
          >
            <T variant="label" numberOfLines={1} style={{ maxWidth: 160 }}>
              {shortCrumb(label)}
            </T>
          </View>
        </Pressable>,
      );
    }
  });
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg + 4,
        paddingBottom: spacing.sm,
      }}
    >
      <HeaderButton icon="arrow-back" label="Zurück" onPress={() => goBack(crumbs)} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'center', gap: 4, paddingRight: spacing.md }}
      >
        {pills}
      </ScrollView>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('Pfad')}>
        {hidden.map((c, i) => (
          <ListRow
            key={`${c.label}${i}`}
            first={i === 0}
            title={c.label}
            onPress={() => {
              setOpen(false);
              go(c.href);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

/** Desktop (Paket DT3): Seitenname als Titel, darüber der Pfad bzw. der Zurück-Pfeil. */
export function PageTitle({ crumbs, title }: { crumbs: Crumb[]; title: string }) {
  const parents = crumbs.slice(0, -1);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 28,
        paddingTop: 16,
        paddingBottom: 4,
      }}
    >
      {parents.length === 0 ? (
        <HeaderButton icon="arrow-back" label="Zurück" onPress={() => goBack(crumbs)} />
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {parents.length > 0 ? <CrumbLine parents={parents} /> : null}
        <T
          variant="headline"
          accessibilityRole="header"
          numberOfLines={1}
          style={{ fontSize: 28, lineHeight: 32 }}
        >
          {title}
        </T>
      </View>
      <SearchField onPress={() => router.push('/search')} />
    </View>
  );
}

/** Einfacher Kopf für öffentliche Seiten ohne Anmeldung (Einladungscode, Über Clubroof). */
function PublicHeader({ title }: { title: string }) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg + 4,
        backgroundColor: colors.background,
      }}
    >
      <HeaderButton
        icon="arrow-back"
        label="Zurück"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
      />
      <T variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </T>
    </View>
  );
}

/** Kopf für `Stack`-Screens (`header: (p) => <SubHeader {...p} />`). */
export function SubHeader({ route, options, prefix = '' }: HeaderProps) {
  const session = useSession();
  const desktop = useIsDesktop();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const title = options.title ?? route.name;
  if (session.status !== 'signedIn') return <PublicHeader title={title} />;
  const { section, crumbs } = breadcrumbsFor(
    `${prefix}${route.name}`,
    (route.params ?? {}) as Record<string, string>,
    title,
  );
  if (desktop)
    return (
      <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
        <PageTitle crumbs={crumbs} title={title} />
      </View>
    );
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      {/* Der konkrete Seitentitel steht vollständig groß, der Bereich klein darüber; der Pfad zeigt nur die Stufen davor */}
      <AppHeader title={title} subtitle={t(TAB_LABELS[section])} />
      <Breadcrumbs crumbs={crumbs.slice(0, -1)} current={false} />
    </View>
  );
}
