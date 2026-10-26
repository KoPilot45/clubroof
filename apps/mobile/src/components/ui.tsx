/**
 * Grundbausteine der Oberfläche. Alle Farben kommen aus dem Vereinsthema (siehe
 * docs/FARBKONZEPT.md): `primary` nur als Fläche, `primaryText` für Text/Icons auf Karten,
 * Statusfarben immer mit Beschriftung.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import type { StatusKey, TintKey } from '@clubroof/design-tokens';
import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Switch,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  TextInput,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { FIGURE_FONT, HEADING_FONT, inputFont } from '@/lib/fonts';
import { TEMPLATE_WIDTH, useTemplate } from '@/lib/desktop-templates';
import { CONTENT_MAX, useIsCompactDesktop, useIsDesktop } from '@/lib/layout';
import { useTheme } from '@/lib/theme';
import { webState } from '@/lib/web-state';
import { Text } from './app-text';
import { CalendarSheet } from './calendar-picker';
import { Honeycomb } from './honeycomb';
import { RequestError } from '@/lib/api';
import { mediaUri } from '@/lib/upload';
import { FadeIn, PressScale, ScrollYContext, useCountUp } from '@/lib/motion';
import { hapticSelect } from '@/lib/haptics';
import { dateFormat, t } from '@/lib/i18n';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Weicher Schatten aus den Tokens (`elevation`); als `boxShadow`, damit er auf iOS, Android und Web gleich wirkt. */
export function shadowStyle(e: {
  color: string;
  opacity: number;
  radius: number;
  offsetY: number;
}): ViewStyle {
  const n = parseInt(e.color.slice(1), 16);
  const rgba = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${e.opacity})`;
  return { boxShadow: `0 ${e.offsetY}px ${e.radius}px ${rgba}` };
}

/** Hex-Farbe mit Deckkraft als rgba (für Ränder und Flächen in Statusfarbe). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ── Typografie ────────────────────────────────────────────────────────────────

type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'section'
  | 'headline'
  | 'figure'
  | 'body'
  | 'label'
  | 'caption'
  | 'overline';

export { HEADING_FONT };

export function T({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
  selectable,
  accessibilityRole,
  verbatim,
}: {
  accessibilityRole?: 'header';
  /** Nicht übersetzen (feste Bezeichnungen wie CSV-Spalten) */
  verbatim?: boolean;
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const { colors, fontSizes } = useTheme();
  const variants: Record<TextVariant, TextStyle> = {
    display: { fontSize: fontSizes.headline, fontWeight: '800', letterSpacing: -0.3 },
    // Kartentitel: Saira Condensed 22–24
    title: { fontFamily: HEADING_FONT, fontSize: 23, lineHeight: 26, fontWeight: '400' },
    heading: { fontSize: fontSizes.bodyLarge, fontWeight: '700' },
    body: { fontSize: fontSizes.body, fontWeight: '400', lineHeight: 21 },
    label: { fontSize: fontSizes.label, fontWeight: '600' },
    caption: { fontSize: fontSizes.caption, lineHeight: 17, fontWeight: '500' },
    // Zwischenüberschriften (Stil „Anstoß“): Saira Condensed 700, 21 px, Großbuchstaben, Laufweite 1 px
    section: {
      fontFamily: HEADING_FONT,
      fontSize: 21,
      lineHeight: 24,
      fontWeight: '400',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    // Seitentitel: Saira Condensed 700, 28 px (Kopfzeilen-Titel), normale Schreibweise
    headline: {
      fontFamily: HEADING_FONT,
      fontSize: 28,
      lineHeight: 30,
      fontWeight: '400',
    },
    // Große Zahlen (Kassenstand, Ergebnisse, Countdown): Saira Condensed ExtraBold, ca. 48 px
    figure: { fontFamily: FIGURE_FONT, fontSize: 48, fontWeight: '400', letterSpacing: 0.2 },
    overline: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
  };
  // Nebentext und Eyebrow: tertiäre Textfarbe (Anstoß)
  const muted = variant === 'caption' || variant === 'overline';
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      accessibilityRole={accessibilityRole}
      verbatim={verbatim}
      style={[
        variants[variant],
        { color: color ?? (muted ? colors.anstoss.textTertiary : colors.onSurface) },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function Screen({
  children,
  refreshing,
  onRefresh,
  header,
  edges = ['top'],
  onEndReached,
  wide,
  footer,
  flushTop,
  scrollRef,
}: {
  /** Zugriff auf die Scrollfläche (z. B. nach oben springen) */
  scrollRef?: React.Ref<ScrollView>;
  /** Seite beginnt ohne Innenabstand oben (Plakat-Hero bis zum Rand, Home) */
  flushTop?: boolean;
  /** feste untere Leiste mit dem Hauptknopf (Formulare): Verlauf nach oben, Knopf 52 hoch */
  footer?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: ReactNode;
  edges?: ('top' | 'bottom')[];
  /** wird aufgerufen, wenn man nahe ans Ende der Seite scrollt (Nachladen langer Listen) */
  onEndReached?: () => void;
  /** Formular mit zwei Spalten (Paket DT3): am Desktop bis 1040 px breit */
  wide?: boolean;
}) {
  const { colors, spacing } = useTheme();
  // In den Tabs liegt die schwebende Leiste über dem Inhalt: unten Platz dafür lassen
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const desktop = useIsDesktop();
  const compact = useIsCompactDesktop();
  // Breite des Inhalts nach Seitenvorlage (Paket DT2): Formulare schmal, Tabellen und Berichte breit
  // (Hooks immer in gleicher Reihenfolge aufrufen, danach auswerten – sonst leert der Breitenwechsel die Seite)
  const template = useTemplate();
  const contentMax = desktop ? Math.max(TEMPLATE_WIDTH[template], wide ? 1040 : 0) : CONTENT_MAX;
  const scrollY = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();
  return (
    <ScrollYContext.Provider value={header ? scrollY : null}>
      <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <ScrollView
          ref={scrollRef}
          style={{ backgroundColor: colors.background }}
          scrollEventThrottle={header || onEndReached ? 16 : undefined}
          onScroll={
            header || onEndReached
              ? (e) => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                  if (header) scrollY.setValue(contentOffset.y);
                  if (
                    onEndReached &&
                    contentSize.height - (contentOffset.y + layoutMeasurement.height) < 500
                  )
                    onEndReached();
                }
              : undefined
          }
          contentContainerStyle={{
            // Seitenrand 22 px (Stil „Anstoß“); Abschnitte bringen 12 px Luft nach oben mit (26 insgesamt)
            paddingHorizontal: desktop ? (compact ? 22 : 28) : 22,
            paddingTop: flushTop ? 0 : spacing.md + 2,
            gap: spacing.md + 2,
            paddingBottom: spacing.xxxl + tabBarHeight,
            // Auf großen Bildschirmen (Browser, Tablet) nicht über die ganze Breite ziehen
            width: '100%',
            maxWidth: contentMax,
            alignSelf: 'center',
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primaryText}
              />
            ) : undefined
          }
        >
          {flattenChildren(children).map((child, i) => (
            <FadeIn key={i} group={pathname} index={Math.min(i, 8)}>
              <ChildIndexContext.Provider value={i}>{child}</ChildIndexContext.Provider>
            </FadeIn>
          ))}
        </ScrollView>
        {footer ? (
          <View
            style={{
              paddingHorizontal: 22,
              paddingTop: 12,
              paddingBottom: 18 + (tabBarHeight > 0 ? tabBarHeight - 8 : 0),
              gap: 10,
              backgroundColor: colors.background,
              borderTopWidth: 1,
              borderTopColor: colors.anstoss.divider,
              alignItems: 'center',
            }}
          >
            {/* Speichern-Leiste so breit wie der Inhalt (Desktop: Formulare 720 px) */}
            <View style={{ width: '100%', maxWidth: contentMax - 44, gap: 10 }}>{footer}</View>
          </View>
        ) : null}
      </SafeAreaView>
    </ScrollYContext.Provider>
  );
}

/**
 * Fläche (Stil „Anstoß“): Weiß bei 6 % auf dem Hintergrund mit feinem Rand, Radius 22. `list`: Karte für
 * Listenzeilen (die Zeilen bringen ihren Abstand selbst mit, Trennlinien innen).
 */
export function Card({
  children,
  style,
  list,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  list?: boolean;
}) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.anstoss.card,
          borderRadius: radii.xl,
          paddingHorizontal: 16,
          paddingVertical: list ? 4 : 16,
          borderWidth: 1,
          borderColor: colors.anstoss.cardBorder,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Das Plakat läuft so weit unter die Folgeelemente aus (px). */
const POSTER_RUNOUT = 150;
const POSTER_FADE: [number, number][] = [
  [0, 0],
  [0.12, 0.04],
  [0.24, 0.12],
  [0.36, 0.26],
  [0.5, 0.46],
  [0.64, 0.68],
  [0.78, 0.86],
  [0.9, 0.96],
  [1, 1],
];

/**
 * Plakat bzw. Hero-Block (Stil „Anstoß“): radialer Verlauf Plakatfarbe 1 → 2 → Hintergrund, Radius 28,
 * Innenabstand 18, Schrift immer `hero.onHero`. Je Bildschirm genau eine. Inhalte setzt die Seite.
 * `poster`: großer Plakatverlauf mit Überblendung nach unten (Home), sonst der kleinere Hero-Block.
 */
export function HeroCard({
  children,
  style,
  onPress,
  accessibilityLabel,
  poster,
  background,
  palette,
  compact,
}: {
  /** kleinerer Innenabstand und Radius 20 (Bühne des Aufstellungsplaners) */
  compact?: boolean;
  /** eigene Farben statt der Vereinsfarbe (z. B. Orange für Veranstaltungen); `to` färbt auch die weißen Knöpfe */
  palette?: { from: string; to: string };
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** macht die ganze Karte antippbar (dann keine eigenen Buttons darin) */
  onPress?: () => void;
  accessibilityLabel?: string;
  poster?: boolean;
  /** Wasserzeichen hinter dem Inhalt (Plakat-Kürzel, Rasenstreifen) */
  background?: ReactNode;
}) {
  const { colors, radii, isDark } = useTheme();
  // In den eigenen Bereichen trägt der Hero deren Farbe (Verwaltung violett, Vereinskasse blau)
  const pathname = usePathname();
  const area = pathname.startsWith('/admin')
    ? colors.anstoss.areaHeroes.admin
    : pathname.startsWith('/club-cash')
      ? colors.anstoss.areaHeroes.cash
      : null;
  palette = palette ?? area ?? undefined;
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  // Hintergrund bekommt die gemessene Größe: wächst die Karte (z. B. nach dem Laden), wächst er mit
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const radius = poster ? 0 : compact ? 20 : radii.xxl;
  const outer: ViewStyle = { borderRadius: radius };
  const body = (
    <View
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{
        flexGrow: 1,
        borderRadius: radius,
        // Plakat: der Körper läuft 150 px über das Layout hinaus und blendet hinter den Folgeelementen aus
        overflow: poster ? 'visible' : 'hidden',
        padding: poster ? 0 : compact ? 8 : 18,
        gap: poster ? 0 : compact ? 2 : 12,
        // Kartenkante im Hero-Block: 1 px Aufhellung
        borderWidth: poster ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Svg
        style={{ position: 'absolute', top: 0, left: 0 }}
        width={box?.w ?? 0}
        height={(box?.h ?? 0) + (poster ? POSTER_RUNOUT : 0)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <Defs>
          {poster ? (
            // CSS „120 % 80 % at 80 % 0“: in der gestreckten 0–100-Fläche ein Kreis (r) mit gestauchter Höhe
            <RadialGradient
              id={gradientId}
              cx={isDark ? '80' : '85'}
              cy="0"
              r="120"
              gradientTransform={`scale(1 ${isDark ? 0.5833 : 0.65})`}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={colors.anstoss.poster.from} />
              <Stop offset={isDark ? '0.55' : '0.99'} stopColor={colors.anstoss.poster.to} />
              <Stop offset="1" stopColor={isDark ? colors.background : colors.anstoss.poster.to} />
            </RadialGradient>
          ) : (
            // CSS „120 % 120 % at 90 % 0“, Endfarbe bei 130 %: Kreis mit r = 156 in der gestreckten Fläche
            <RadialGradient id={gradientId} cx="90" cy="0" r="156" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={palette?.from ?? colors.hero.from} />
              <Stop offset="0.46" stopColor={palette?.to ?? colors.hero.to} />
              <Stop
                offset="1"
                stopColor={isDark ? colors.background : (palette?.to ?? colors.hero.to)}
              />
            </RadialGradient>
          )}
          {/* Auslauf: neunstufige Überblendung zum Seitenhintergrund über die unteren 55 % des Körpers */}
          <LinearGradient id={`${gradientId}f`} x1="0" y1="0" x2="0" y2="1">
            {POSTER_FADE.map(([at, alpha]) => (
              <Stop key={at} offset={at} stopColor={colors.background} stopOpacity={alpha} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
        {poster ? (
          <Rect x="0" y="45" width="100" height="55" fill={`url(#${gradientId}f)`} />
        ) : null}
      </Svg>
      <Honeycomb poster={poster} />
      {background}
      {children}
    </View>
  );
  const toned = (
    <HeroToneContext.Provider value={palette?.to ?? colors.hero.to}>
      {body}
    </HeroToneContext.Provider>
  );
  if (onPress)
    return (
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={[outer, style]}
      >
        {toned}
      </PressScale>
    );
  return <View style={[outer, style]}>{toned}</View>;
}

/** Textfarbe weißer Knöpfe auf dem Plakat bzw. Hero-Block (dunkler Ton der Hero-Farbe). */
const HeroToneContext = createContext<string | null>(null);

/** Kinder einer Seite ohne Fragmente: jede Fläche ist ein eigenes Kind mit gleichem Abstand. */
function flattenChildren(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flattenChildren(child.props.children)
      : [child],
  );
}

/** Position des Kindes in der Seite (0 = ganz oben): Abschnittsüberschrift ganz oben rückt näher heran. */
const ChildIndexContext = createContext<number | null>(null);

export function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const first = useContext(ChildIndexContext) === 0;
  // Desktop (Paket DT3): 28 statt 48 px Abstand vor dem Abschnitt, ganz oben keiner zusätzlich
  const desktop = useIsDesktop();
  // Abschnittsüberschrift (Stil „Anstoß“): Akzentlinie 4 × 18, 12 px Abstand zum Inhalt; die Seite
  // lässt 14 px Abstand, Abschnitte ergänzen oben 12 → 26 px wie im Entwurf.
  return (
    // Eine einzige Abschnittsüberschrift für die ganze App: 48 davor (14 Seitenabstand + 34), 18 danach,
    // Überschrift 22 px; steht sie ganz oben unter Kopfzeile oder Hero: 32 davor
    <View style={{ gap: 18, paddingTop: first ? (desktop ? 4 : 18) : desktop ? 16 : 34 }}>
      <View style={styles.rowBetween}>
        <View style={styles.sectionTitle}>
          <View
            style={{
              width: 4,
              height: 18,
              borderRadius: 2,
              backgroundColor: colors.primary,
            }}
          />
          <T
            variant="section"
            numberOfLines={1}
            style={{ flexShrink: 1, fontSize: 22, lineHeight: 25 }}
            accessibilityRole="header"
          >
            {title}
          </T>
        </View>
        {action && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            accessibilityRole="link"
          >
            <T
              variant="caption"
              color={colors.primaryText}
              numberOfLines={1}
              style={{ fontWeight: '700', flexShrink: 0 }}
            >
              {`${t(action)} ›`}
            </T>
          </Pressable>
        ) : null}
      </View>
      <ChildIndexContext.Provider value={null}>
        <Stack>{children}</Stack>
      </ChildIndexContext.Provider>
    </View>
  );
}

/** Stapel von Karten und Zeilen: 14 px Abstand, wie im Kachelraster (Regel RS). */
export function Stack({ children, gap = 14 }: { children: ReactNode; gap?: number }) {
  return <View style={{ gap }}>{children}</View>;
}

/**
 * Blatt von unten (Bestätigung, Auswahl, Grund-Feld): Hintergrund abgedunkelt, Tippen daneben schließt.
 * Inhalt scrollt, wenn er höher als 85 % des Bildschirms wird.
 */
/**
 * Detailbereich am Desktop (U08): Seitenpanel von rechts über der Liste mit Schließen-Knopf, Esc schließt.
 * Liste, Suche, Filter und Scrollposition dahinter bleiben unverändert; es gibt keinen zweiten, unabhängig
 * scrollenden Bereich neben der Liste (Entscheidung 19.10.2026). Am Handy nicht verwenden (dort klappt der Eintrag auf).
 */
export function SidePanel({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  // Esc schließt auch dann, wenn der Fokus noch in der Liste dahinter steht
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Schließen')}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.anstoss.scrim }]}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={{
            width: 480,
            maxWidth: '100%',
            height: '100%',
            backgroundColor: colors.anstoss.sheet,
            borderLeftWidth: 1,
            borderColor: colors.anstoss.sheetBorder,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 8,
            }}
          >
            <T variant="headline" style={{ fontSize: 24, flex: 1 }} accessibilityRole="header">
              {title}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Schließen')}
              onPress={onClose}
              style={(state) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: webState(state).hovered ? colors.anstoss.overlay : 'transparent',
              })}
            >
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: spacing.sm,
              gap: spacing.md,
              paddingBottom: spacing.xxl,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const { colors, radii, spacing } = useTheme();
  const { height } = useWindowDimensions();
  // Desktop-Ansicht (Paket DT): zentrierter Dialog statt Fenster von unten; Esc schließt (Modal → onRequestClose)
  const desktop = useIsDesktop();
  // leiser Impuls beim Öffnen eines Auswahlfensters
  useEffect(() => {
    if (visible) hapticSelect();
  }, [visible]);
  return (
    <Modal
      transparent
      visible={visible}
      animationType={desktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: desktop ? 'center' : 'flex-end',
          backgroundColor: colors.anstoss.scrim,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Schließen')}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            maxHeight: height * 0.85,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            ...(desktop
              ? { borderBottomLeftRadius: radii.xxl, borderBottomRightRadius: radii.xxl }
              : null),
            backgroundColor: colors.anstoss.sheet,
            borderTopWidth: 1,
            borderColor: colors.anstoss.sheetBorder,
            ...(desktop ? { borderWidth: 1 } : null),
          }}
        >
          {desktop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Schließen')}
              onPress={onClose}
              style={(state) => ({
                position: 'absolute',
                top: 14,
                right: 14,
                zIndex: 2,
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: webState(state).hovered ? colors.anstoss.overlay : 'transparent',
              })}
            >
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          ) : (
            <View
              style={{
                alignSelf: 'center',
                width: 44,
                height: 5,
                borderRadius: 3,
                marginTop: 10,
                backgroundColor: colors.anstoss.textTertiary,
                opacity: 0.5,
              }}
            />
          )}
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: spacing.md,
              gap: spacing.md,
              paddingBottom: spacing.xxl,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {title ? (
              <T variant="headline" style={{ fontSize: 26 }} accessibilityRole="header">
                {title}
              </T>
            ) : null}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Dialog in der Mitte (Stil „Anstoß“, Vorlage U15): „Wirklich löschen?“ mit Name des Eintrags und zwei
 * Knöpfen. Löschen fragt immer nach; es verschiebt in das Archiv (docs/ARCHIV.md).
 */
export function Dialog({
  visible,
  onClose,
  title,
  text,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Abbrechen',
  danger = true,
  icon = 'trash-outline',
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  text?: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  /** Bestätigen ist rot (Löschen) */
  danger?: boolean;
  icon?: IconName;
  loading?: boolean;
}) {
  const { colors, radii } = useTheme();
  const tone = danger ? colors.status.urgent : colors.status.info;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
          backgroundColor: colors.anstoss.scrimDialog,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Schließen')}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: radii.xxl,
            padding: 24,
            gap: 14,
            backgroundColor: colors.anstoss.sheet,
            borderWidth: 1,
            borderColor: colors.anstoss.sheetBorder,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tone.container,
            }}
          >
            <Ionicons name={icon} size={26} color={tone.onContainer} />
          </View>
          <T
            variant="headline"
            style={{ fontSize: 26, textAlign: 'center' }}
            accessibilityRole="header"
          >
            {title}
          </T>
          {text ? (
            <T style={{ textAlign: 'center', color: colors.onSurfaceMuted }}>{text}</T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 }}>
            <Button label={cancelLabel} variant="neutral" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label={confirmLabel}
              variant={danger ? 'dangerSolid' : 'primary'}
              loading={loading}
              onPress={onConfirm}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Chips & Badges ────────────────────────────────────────────────────────────

export function Chip({
  label,
  tone = 'primary',
  icon,
  size = 'sm',
}: {
  label: string;
  tone?: StatusKey | 'primary' | 'neutral' | TintKey;
  icon?: IconName;
  /** sm = Statusmarke (Radius 8, 11,5 px) in Listen und Karten, md = Pille (12 px) für eigenständige Marken */
  size?: 'sm' | 'md';
}) {
  const { colors, radii } = useTheme();
  const palette =
    tone === 'primary'
      ? { bg: colors.primaryContainer, fg: colors.onPrimaryContainer }
      : tone === 'neutral'
        ? { bg: colors.anstoss.overlay, fg: colors.onSurfaceMuted }
        : tone in colors.tints
          ? {
              bg: colors.tints[tone as TintKey].container,
              fg: colors.tints[tone as TintKey].onContainer,
            }
          : {
              bg: colors.status[tone as StatusKey].container,
              fg: colors.status[tone as StatusKey].onContainer,
            };
  const md = size === 'md';
  return (
    <View
      testID="chip"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: md ? 6 : 4,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        minHeight: md ? 28 : 22,
        backgroundColor: palette.bg,
        borderRadius: md ? radii.pill : 8,
        paddingHorizontal: md ? 11 : 8,
        paddingVertical: md ? 5 : 2,
      }}
    >
      {icon ? <Ionicons name={icon} size={md ? 14 : 12} color={palette.fg} /> : null}
      <Text
        style={{
          flexShrink: 1,
          color: palette.fg,
          fontSize: md ? 12 : 11.5,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Mannschafts-Badge wie „B1“, „1.“, „AH“ (Konzept §2). */
export function TeamBadge({ badge }: { badge: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        minWidth: 30,
        height: 22,
        paddingHorizontal: 6,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.anstoss.overlay,
      }}
    >
      <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.onSurface }}>{badge}</Text>
    </View>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  size = 'md',
  compact,
  hideLabel,
}: {
  label: string;
  onPress: () => void;
  /**
   * Pillenförmig. primary = Hauptaktion (gefüllt), outline/danger = Nebenaktion (umrandet), tonal = dezente
   * Vereinsfarbe, action = Zwischenstatus; hero/heroOutline = auf der Blickfangkarte (Schrift `onHero`).
   */
  variant?:
    | 'primary'
    | 'outline'
    | 'danger'
    | 'tonal'
    | 'action'
    | 'hero'
    | 'heroOutline'
    | 'dangerSolid'
    | 'actionSolid'
    | 'neutral';
  /** sm für Aktionen innerhalb von Listen und Karten (ebenfalls mindestens 44 pt hoch) */
  size?: 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** schmaler Innenabstand für Dreier-Reihen, in denen Beschriftungen sonst umbrechen */
  compact?: boolean;
  /** nur das Symbol zeigen (Beschriftung bleibt für Screenreader) */
  hideLabel?: boolean;
}) {
  const { colors, radii, sizes } = useTheme();
  const heroTone = useContext(HeroToneContext);
  const palette = {
    primary: {
      bg: colors.primary,
      pressed: colors.primaryPressed,
      fg: colors.onPrimary,
      border: colors.primary,
    },
    // Nebenknopf: Fläche mit feinem Rand (Stil „Anstoß“)
    outline: {
      bg: colors.anstoss.card,
      pressed: colors.anstoss.overlayStrong,
      fg: colors.onSurface,
      border: colors.anstoss.fieldBorder,
    },
    danger: {
      bg: 'transparent',
      pressed: colors.status.urgent.container,
      fg: colors.status.urgent.onContainer,
      border: colors.status.urgent.onContainer,
    },
    // Rot gefüllt (z. B. „Löschen“, „Absage senden“), orange gefüllt („Unsicher senden“), grau („Abbrechen“)
    dangerSolid: {
      bg: colors.status.urgent.solid,
      pressed: colors.status.urgent.onContainer,
      fg: colors.status.urgent.onSolid,
      border: colors.status.urgent.solid,
    },
    actionSolid: {
      bg: colors.status.action.solid,
      pressed: colors.status.action.onContainer,
      fg: colors.status.action.onSolid,
      border: colors.status.action.solid,
    },
    neutral: {
      bg: colors.anstoss.overlayStrong,
      pressed: colors.anstoss.overlayStrong,
      fg: colors.onSurface,
      border: 'transparent',
    },
    tonal: {
      bg: colors.primaryContainer,
      pressed: colors.surfaceVariant,
      fg: colors.onPrimaryContainer,
      border: colors.primaryContainer,
    },
    action: {
      bg: colors.status.action.container,
      pressed: colors.surfaceVariant,
      fg: colors.status.action.onContainer,
      border: colors.status.action.container,
    },
    // Auf dem Plakat: helle Fläche mit dunkler Schrift bzw. umrandet in Weiß
    hero: {
      bg: '#FFFFFF',
      pressed: 'rgba(255,255,255,0.85)',
      fg: heroTone ?? colors.hero.to,
      border: '#FFFFFF',
    },
    heroOutline: {
      bg: 'transparent',
      pressed: colors.hero.decor,
      fg: colors.hero.onHero,
      border: 'rgba(255,255,255,0.4)',
    },
  }[variant];
  const small = size === 'sm';
  const border = variant === 'heroOutline' ? 2 : 1;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={hideLabel ? t(label) : undefined}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: small ? sizes.buttonSmall : sizes.button,
          paddingHorizontal: compact ? 8 : small ? 14 : 18,
          borderRadius: radii.pill,
          borderWidth: border,
          borderColor: palette.border,
          backgroundColor: pressed ? palette.pressed : palette.bg,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={hideLabel ? 24 : small ? 17 : 19} color={palette.fg} />
          ) : null}
          {hideLabel ? null : (
            <Text
              numberOfLines={2}
              style={{
                flexShrink: 1,
                textAlign: 'center',
                color: palette.fg,
                fontSize: small ? 14 : 16,
                fontWeight: '800',
              }}
            >
              {label}
            </Text>
          )}
        </>
      )}
    </PressScale>
  );
}

/** Ein/Aus-Schalter in Vereinsfarbe. */
export function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      disabled={disabled}
      trackColor={{ true: colors.primary, false: colors.anstoss.fieldBorder }}
      thumbColor="#FFFFFF"
      {...({ activeThumbColor: '#FFFFFF' } as object)}
      onValueChange={(v) => {
        hapticSelect();
        onChange(v);
      }}
    />
  );
}

// ── Wappen & Avatar ───────────────────────────────────────────────────────────

/** Vereinswappen. Solange kein Logo hochgeladen ist, ein Schild mit Kürzel in Vereinsfarbe. */
/** Hochgeladenes oder gelieferte Vereinswappen: quadratisch mit weißem Grund, daher als abgerundete Kachel (dunkel kein harter Kasten). */
export function ClubLogo({
  uri,
  size,
  label = t('Vereinslogo'),
}: {
  uri: string;
  size: number;
  label?: string;
}) {
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={label}
      resizeMode="contain"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
    />
  );
}

export function Crest({ initials, size = 40 }: { initials: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 40 44"
      accessibilityLabel={t('Vereinswappen')}
    >
      <Path d="M20 1 L38 6 V20 C38 32 30 39 20 43 C10 39 2 32 2 20 V6 Z" fill={colors.primary} />
      <Path
        d="M20 5 L34.5 9 V20 C34.5 30 28 35.6 20 39 C12 35.6 5.5 30 5.5 20 V9 Z"
        fill="none"
        stroke={colors.onPrimary}
        strokeWidth={1.4}
      />
      <SvgText
        x="20"
        y="25"
        textAnchor="middle"
        fontWeight="800"
        fontSize={initials.length > 3 ? 7.5 : initials.length === 3 ? 9 : 11}
        fill={colors.onPrimary}
      >
        {initials}
      </SvgText>
    </Svg>
  );
}

/** Profilfoto oder – ohne Foto – Initialen in Vereinsfarbe. */
export function Avatar({
  name,
  size = 36,
  uri,
}: {
  name: string;
  size?: number;
  uri?: string | null;
}) {
  const { colors } = useTheme();
  if (uri)
    return (
      <Image
        source={{ uri: mediaUri(uri)! }}
        accessibilityLabel={t(`Profilfoto ${name}`)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(colors.primary, 0.15),
        }}
      />
    );
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // Anstoß: Akzentfarbe bei 15 % als Fläche, Initialen in der Akzentfarbe
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: withAlpha(colors.primary, 0.15),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.primaryText, fontWeight: '800', fontSize: size * 0.34 }}>
        {initials}
      </Text>
    </View>
  );
}

/**
 * Icon in einer Kachel, z. B. vor Listeneinträgen. Pastellfarben (`tints`) mit dunkler Schrift für
 * Bereiche und Kennzahlen; Statusfarben nur zusammen mit einer Beschriftung daneben.
 */
export function IconTile({
  name,
  tone = 'primary',
  filled,
  size = 'md',
}: {
  name: IconName;
  tone?: StatusKey | 'primary' | TintKey;
  filled?: boolean;
  /** md = 40, lg = 52 */
  size?: 'md' | 'lg';
}) {
  const { colors, sizes } = useTheme();
  const palette = filled
    ? { bg: colors.primary, fg: colors.onPrimary }
    : tone === 'primary'
      ? { bg: colors.primaryContainer, fg: colors.onPrimaryContainer }
      : tone in colors.tints
        ? {
            bg: colors.tints[tone as TintKey].container,
            fg: colors.tints[tone as TintKey].onContainer,
          }
        : {
            bg: colors.status[tone as StatusKey].container,
            fg: colors.status[tone as StatusKey].onContainer,
          };
  const box = size === 'lg' ? sizes.iconTileLarge : sizes.iconTile;
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: filled ? box / 2 : size === 'lg' ? 16 : 14,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={size === 'lg' ? 26 : 20} color={palette.fg} />
    </View>
  );
}

/** Datumskachel: Wochentag klein, Tag groß (md 48×50, lg 52×56). */
export function DateTile({
  weekday,
  day,
  muted,
  size = 'md',
  color,
}: {
  weekday: string;
  day: string;
  /** abgesagt: graue Fläche */
  muted?: boolean;
  size?: 'md' | 'lg';
  /** Farbe des Wochentags und der Fläche (15 %); Standard: Kategorie „Mannschaft“ */
  color?: string;
}) {
  const { colors } = useTheme();
  const lg = size === 'lg';
  const tint = color ?? colors.anstoss.categories.team;
  const fg = muted ? colors.anstoss.textTertiary : tint;
  return (
    <View
      style={{
        width: lg ? 54 : 50,
        paddingVertical: lg ? 6 : 5,
        borderRadius: lg ? 15 : 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: muted ? colors.anstoss.card : withAlpha(tint, 0.15),
      }}
    >
      <T
        variant="caption"
        color={fg}
        style={{ fontSize: 10.5, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase' }}
      >
        {weekday.replace('.', '')}
      </T>
      <T
        variant="figure"
        color={muted ? colors.anstoss.textTertiary : colors.onSurface}
        style={{ fontSize: lg ? 28 : 26, lineHeight: lg ? 28 : 26 }}
      >
        {day}
      </T>
    </View>
  );
}

// ── Listen ────────────────────────────────────────────────────────────────────

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  first,
  strike,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  /** durchgestrichener Titel (abgesagt) */
  strike?: boolean;
}) {
  const { colors, sizes } = useTheme();
  const main = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <T
          numberOfLines={2}
          color={strike ? colors.anstoss.textTertiary : undefined}
          style={{
            fontSize: 15,
            lineHeight: 20,
            fontWeight: '700',
            textDecorationLine: strike ? 'line-through' : 'none',
          }}
        >
          {title}
        </T>
        {typeof subtitle === 'string' ? (
          <T variant="caption" numberOfLines={2}>
            {subtitle}
          </T>
        ) : (
          subtitle
        )}
      </View>
    </>
  );
  // Die Polsterung gehört zum Tippbereich: die ganze Zeile (mindestens 44 pt) ist antippbar
  const inner = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: sizes.touchTarget,
    paddingVertical: 12,
  } as const;
  // Zusatz rechts (Buttons, Schalter) steht neben dem antippbaren Bereich, nie darin:
  // verschachtelte Buttons sind im Web ungültig.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {/* Trennlinie, links bis hinter das Symbol eingerückt (Stil „Anstoß“) */}
      {first ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: leading ? 54 : 0,
            right: 0,
            height: 1,
            backgroundColor: colors.anstoss.divider,
          }}
        />
      )}
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" style={inner}>
          {main}
        </Pressable>
      ) : (
        <View style={inner}>{main}</View>
      )}
      {/* Chips setzen alignSelf: flex-start; der Container zentriert sie wieder zur Zeile */}
      {trailing ? <View style={{ alignSelf: 'center' }}>{trailing}</View> : null}
      {onPress && !trailing ? (
        <Ionicons name="chevron-forward" size={18} color={colors.anstoss.textTertiary} />
      ) : null}
    </View>
  );
}

/**
 * Wisch-Aktion in Listen: Nach links wischen zeigt eine Aktion (z. B. „Zusagen“); Antippen führt sie aus, weiter
 * Wischen löst sie sofort aus. Immer zusätzlich zu einer sichtbaren Bedienung erreichbar (Screenreader: eigene
 * Aktion am Element). Die Zeile braucht eine eigene Hintergrundfarbe, damit die Aktion dahinter verdeckt bleibt.
 */
export function SwipeRow({
  children,
  label,
  icon,
  tone = 'success',
  onAction,
}: {
  children: ReactNode;
  /** Beschriftung der Aktion (auch für Screenreader) */
  label: string;
  icon: IconName;
  tone?: StatusKey;
  onAction: () => void;
}) {
  const { colors } = useTheme();
  const WIDTH = 92;
  const x = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const [open, setOpen] = useState(false);
  /** nach einem Wischen kein Antippen auslösen (im Browser folgt auf das Loslassen ein Klick) */
  const dragged = useRef(false);
  const snap = (to: number) => {
    offset.current = to;
    setOpen(to !== 0);
    Animated.spring(x, {
      toValue: to,
      useNativeDriver: Platform.OS !== 'web',
      bounciness: 0,
    }).start();
  };
  const pan = useRef(
    PanResponder.create({
      // nur waagerechte Wischbewegungen übernehmen, damit die Seite weiter scrollt
      // Capture: auch wenn ein Knopf in der Zeile die Berührung schon hält, übernimmt das Wischen
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragged.current = true;
      },
      onPanResponderMove: (_, g) =>
        x.setValue(Math.min(0, Math.max(-WIDTH * 1.6, offset.current + g.dx))),
      onPanResponderRelease: (_, g) => {
        setTimeout(() => (dragged.current = false), 150);
        const end = offset.current + g.dx;
        if (end < -WIDTH * 1.4) {
          hapticSelect();
          snap(0);
          onActionRef.current();
        } else snap(end < -WIDTH / 2 ? -WIDTH : 0);
      },
      onPanResponderTerminate: () => {
        setTimeout(() => (dragged.current = false), 150);
        snap(offset.current);
      },
    }),
  ).current;
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const c = colors.status[tone];
  return (
    <View style={{ overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: WIDTH,
          opacity: open ? 1 : 0,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(label)}
          disabled={!open}
          onPress={() => {
            snap(0);
            onAction();
          }}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            backgroundColor: c.container,
          }}
        >
          <Ionicons name={icon} size={22} color={c.onContainer} />
          <Text style={{ color: c.onContainer, fontSize: 12, fontWeight: '700' }}>{label}</Text>
        </Pressable>
      </View>
      <Animated.View
        {...pan.panHandlers}
        {...({
          onClickCapture: (e: { stopPropagation: () => void }) => {
            if (dragged.current) e.stopPropagation();
          },
        } as object)}
        style={{ transform: [{ translateX: x }], backgroundColor: colors.surface }}
        accessibilityActions={[{ name: 'activate', label: t(label) }]}
        onAccessibilityAction={() => onAction()}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ── Zustände ──────────────────────────────────────────────────────────────────

/** Grauer, atmender Platzhalter statt Drehkreis: die Seite wirkt schneller und springt weniger. */
function SkeletonBlock({
  height,
  width,
  radius,
  style,
}: {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radii, motion } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.skeletonPulse / 2,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: motion.skeletonPulse / 2,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion, motion.skeletonPulse]);
  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius: radius ?? radii.md,
          backgroundColor: colors.anstoss.overlayStrong,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Platzhalter einer Listenzeile: Kachel, zwei Textzeilen, Status. */
function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <SkeletonBlock height={44} width={44} radius={14} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock height={12} width="70%" />
        <SkeletonBlock height={10} width="45%" />
      </View>
      <SkeletonBlock height={22} width={64} radius={11} />
    </View>
  );
}

/**
 * Ladezustand mit pulsierenden Platzhaltern. `list` (Standard) für Listen in Karten; `page` für den
 * ersten Aufbau einer Seite: Blickfangkarte, Band, Liste.
 */
export function Loading({ variant = 'list' }: { variant?: 'list' | 'page' }) {
  const { colors, radii } = useTheme();
  const rows = (
    <>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </>
  );
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('Lädt')}
      style={{ gap: 14, paddingVertical: variant === 'page' ? 0 : 4 }}
    >
      {variant === 'page' ? (
        <>
          <SkeletonBlock height={230} radius={radii.xxl} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <SkeletonBlock height={92} radius={radii.xl} style={{ flex: 1 }} />
            <SkeletonBlock height={92} radius={radii.xl} style={{ flex: 1 }} />
          </View>
          <View
            style={{
              padding: 14,
              borderRadius: radii.xl,
              backgroundColor: colors.anstoss.card,
              borderWidth: 1,
              borderColor: colors.anstoss.cardBorder,
            }}
          >
            {rows}
          </View>
        </>
      ) : (
        rows
      )}
    </View>
  );
}

/**
 * Hinweiskarte mit Symbol, Titel, Text und optionaler Handlung. `urgent` für Fehler, `action` für
 * Warnungen (z. B. 2-Faktor), `info` für ruhige Hinweise. Immer mit Titel – nie Farbe allein.
 */
export function Notice({
  tone,
  icon,
  title,
  text,
  action,
}: {
  tone: 'urgent' | 'action' | 'info';
  icon: IconName;
  title: string;
  text: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  const { colors, radii } = useTheme();
  const c = colors.status[tone];
  // Karte mit Rand in Statusfarbe, Symbolkreis, Titel in Saira und Text (Stil „Anstoß“, U12)
  return (
    <View
      accessibilityRole={tone === 'urgent' ? 'alert' : undefined}
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderRadius: radii.xl,
        backgroundColor: colors.anstoss.card,
        borderWidth: 1,
        borderColor: withAlpha(c.solid, 0.4),
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(c.solid, 0.18),
        }}
      >
        <Ionicons name={icon} size={22} color={c.onContainer} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T variant="title" color={c.onContainer} style={{ fontSize: 22, lineHeight: 25 }}>
          {title}
        </T>
        <T style={{ fontSize: 13, lineHeight: 18, color: colors.onSurfaceMuted }}>{text}</T>
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={action.onPress}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 8,
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: withAlpha(c.onContainer, 0.5),
              backgroundColor: pressed ? c.container : 'transparent',
            })}
          >
            {action.icon ? <Ionicons name={action.icon} size={16} color={c.onContainer} /> : null}
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.onContainer }}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Fehlerhinweis. Fehlende Rechte (403) und nicht Gefundenes (404) erscheinen als ruhiger
 * Hinweis ohne „Erneut versuchen“ – ein Neuladen ändert daran nichts.
 */
export function ErrorNotice({
  error,
  message,
  onRetry,
}: {
  error?: Error | null;
  message?: string;
  onRetry?: () => void;
}) {
  const status = error instanceof RequestError ? error.status : null;
  const text = message ?? error?.message ?? 'Es ist ein unerwarteter Fehler aufgetreten.';
  // Ohne umgebenden Screen (ganze Seite ersetzt): Seitenrand wie bei den Zustandskarten (22)
  const standalone = useContext(ChildIndexContext) === null;
  const wrap = (node: React.ReactNode) =>
    standalone ? <View style={{ padding: 22 }}>{node}</View> : node;
  if (status === 403 || status === 404) {
    return wrap(
      <Notice
        tone="info"
        icon={status === 403 ? 'lock-closed' : 'search'}
        title={status === 403 ? 'Kein Zugriff' : 'Nicht gefunden'}
        text={text}
        action={
          router.canGoBack()
            ? { label: 'Zurück', onPress: () => router.back() }
            : { label: 'Zur Startseite', onPress: () => router.replace('/') }
        }
      />,
    );
  }
  return wrap(
    <Notice
      tone="urgent"
      icon="alert"
      title="Das hat nicht geklappt"
      text={text}
      action={
        onRetry ? { label: 'Erneut versuchen', onPress: onRetry, icon: 'refresh' } : undefined
      }
    />,
  );
}

/** Leerer Zustand: erklärt, warum nichts da ist, und bietet wenn möglich den nächsten Schritt an. */
export function Empty({
  icon,
  text,
  hint,
  action,
}: {
  icon: IconName;
  text: string;
  /** zweite, leisere Zeile (was als Nächstes passiert) */
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  // Desktop (Paket DT3): kompakter, weniger Leerfläche
  const desktop = useIsDesktop();
  // Leerer Zustand (Stil „Anstoß“, U12): Symbolkreis in Akzent bei 13 %, Titel in Saira, leiser Hinweis
  return (
    <View
      style={{
        alignItems: 'center',
        gap: 4,
        paddingVertical: desktop ? 12 : 24,
        paddingHorizontal: 12,
      }}
    >
      <View
        style={{
          width: desktop ? 48 : 64,
          height: desktop ? 48 : 64,
          borderRadius: desktop ? 24 : 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(colors.primary, 0.13),
        }}
      >
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <T variant="title" style={{ textAlign: 'center', marginTop: 8 }}>
        {text}
      </T>
      {hint ? (
        <T variant="caption" style={{ textAlign: 'center', fontSize: 13 }}>
          {hint}
        </T>
      ) : null}
      {action ? (
        <View style={{ marginTop: 10 }}>
          <Button label={action.label} size="sm" variant="tonal" onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Primäraktion einer Seite („Thema eröffnen“): am Desktop als Knopf rechts oben statt Balken über die ganze
 * Breite (Paket DT3), sonst unverändert.
 */
export function PageAction({ children }: { children: ReactNode }) {
  const desktop = useIsDesktop();
  if (!desktop) return <>{children}</>;
  return <View style={{ alignItems: 'flex-end' }}>{children}</View>;
}

// ── Kacheln (Untermenüs in Team, Verein, Mehr) ─────────────────────────────────

export type TileItem = {
  key: string;
  label: string;
  icon: IconName;
  onPress?: () => void;
  /** Zahl oder kurzer Hinweis oben rechts, z. B. offene Umfragen */
  badge?: string | number;
  /** Kleine Kennzahl oben rechts in der Kategoriefarbe (Datum, Zahl, Bilanz, Kassenstand), Paket PO */
  figure?: string;
  /** Funktion folgt in einem späteren Paket */
  soon?: boolean;
  /** „Hinzufügen“-Kachel: gestrichelter Umriss in der Vereinsfarbe statt Fläche (Paket AP) */
  add?: boolean;
  /** Längerer Hinweis nur für Screenreader (unter der Kachel steht er nicht mehr) */
  hint?: string;
  /** Ton des Hinweises (immer zusammen mit dem Text, nie Farbe allein) */
  tone?: 'neutral' | 'action' | 'success' | 'urgent' | 'info';
  /** Pastellfarbe der Icon-Kachel im kompakten Raster (sonst reihum) */
  tint?: TintKey;
};

/**
 * Kachelraster: vier Spalten wie im Entwurf – Kachel 60 hoch mit Pastell-Icon, Beschriftung
 * darunter, Zähler oder „neu“ oben rechts, ein kurzer Hinweis unter der Beschriftung.
 */
export function TileGrid({ items }: { items: TileItem[] }) {
  return <LargeTileGrid items={items} />;
}

/**
 * Große Kacheln (Paket AK, Home und Verein): 2 Spalten, Abstand 14, mindestens 124 hoch, Radius 24,
 * Symbolfläche 60 × 60 oben links, Kennzahl oben rechts, Beschriftung unten links. Eine ungerade letzte
 * Kachel bleibt halbe Breite.
 */
/** Große Kacheln zeigen Umrisssymbole (wie im Entwurf), sofern es das Symbol als Umriss gibt. */
const outlineIcon = (name: IconName): IconName =>
  !name.endsWith('-outline') && `${name}-outline` in Ionicons.glyphMap
    ? (`${name}-outline` as IconName)
    : name;

/**
 * Desktop (Paket NACHBESSERUNG-DESKTOP-UND-KASSE): flache Zeilenkachel – Symbol links, Name (bricht nur zwischen Wörtern),
 * Kennzahl als Pill rechts in der Kachel. Raster `auto-fill` ab 210 px Breite.
 */
function DesktopTileGrid({ items }: { items: TileItem[] }) {
  const { colors } = useTheme();
  return (
    <View
      style={
        {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 12,
        } as never
      }
    >
      {items.map((item, index) => {
        const disabled = item.soon || !item.onPress;
        const value =
          item.figure ?? (item.badge !== undefined && item.badge !== 0 ? String(item.badge) : null);
        const showBadge = !item.soon && value !== null;
        const tint = item.tint ?? TINT_ORDER[index % TINT_ORDER.length]!;
        const urgent = item.tone === 'action' || item.tone === 'urgent';
        const accent = urgent ? colors.status.action.solid : colors.tints[tint].onContainer;
        return (
          <PressScale
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityLabel={[
              item.label,
              showBadge ? value : null,
              item.soon ? 'bald verfügbar' : item.hint,
            ]
              .filter(Boolean)
              .join(', ')}
            disabled={disabled}
            onPress={item.onPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 60,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 18,
              ...(item.add
                ? {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderStyle: 'dashed' as const,
                    borderColor: withAlpha(colors.primary, 0.7),
                  }
                : {
                    backgroundColor: colors.anstoss.card,
                    borderWidth: 1,
                    borderColor: colors.anstoss.cardBorder,
                  }),
              opacity: item.soon ? 0.55 : 1,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: item.add
                  ? withAlpha(colors.primary, 0.14)
                  : colors.tints[tint].container,
              }}
            >
              <Ionicons
                name={item.add ? 'add' : outlineIcon(item.icon)}
                size={22}
                color={item.add ? colors.primaryText : colors.tints[tint].onContainer}
              />
            </View>
            <Text
              verbatim
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                fontWeight: '700',
                color: item.add ? colors.primaryText : colors.onSurface,
              }}
            >
              {t(item.label)}
            </Text>
            {showBadge ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                  backgroundColor: accent,
                }}
              >
                <Text
                  verbatim
                  style={{ fontSize: 12, fontWeight: '800', color: colors.background }}
                >
                  {value}
                </Text>
              </View>
            ) : null}
          </PressScale>
        );
      })}
    </View>
  );
}

function LargeTileGrid({ items }: { items: TileItem[] }) {
  const { colors } = useTheme();
  // Desktop: flache Zeilenkacheln im auto-fill-Raster
  const desktop = useIsDesktop();
  if (desktop) return <DesktopTileGrid items={items} />;
  const tileWidth = '47.9%';
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 14,
      }}
    >
      {items.map((item, index) => {
        const disabled = item.soon || !item.onPress;
        const value =
          item.figure ?? (item.badge !== undefined && item.badge !== 0 ? String(item.badge) : null);
        const showBadge = !item.soon && value !== null;
        const tint = item.tint ?? TINT_ORDER[index % TINT_ORDER.length]!;
        const urgent = item.tone === 'action' || item.tone === 'urgent';
        const accent = urgent ? colors.status.action.solid : colors.tints[tint].onContainer;
        return (
          <PressScale
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityLabel={[
              item.label,
              showBadge ? value : null,
              item.soon ? 'bald verfügbar' : item.hint,
            ]
              .filter(Boolean)
              .join(', ')}
            disabled={disabled}
            onPress={item.onPress}
            style={{
              width: tileWidth,
              minHeight: 124,
              padding: 16,
              borderRadius: 24,
              justifyContent: item.add ? 'center' : 'space-between',
              alignItems: item.add ? 'center' : undefined,
              ...(item.add
                ? {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderStyle: 'dashed' as const,
                    borderColor: withAlpha(colors.primary, 0.7),
                  }
                : {
                    backgroundColor: colors.anstoss.card,
                    borderWidth: 1,
                    borderColor: colors.anstoss.cardBorder,
                  }),
              opacity: item.soon ? 0.55 : 1,
            }}
          >
            {item.add ? (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: withAlpha(colors.primary, 0.14),
                  }}
                >
                  <Ionicons name="add" size={34} color={colors.primaryText} />
                </View>
                <Text
                  verbatim
                  style={{ fontSize: 14, fontWeight: '700', color: colors.primaryText }}
                >
                  {t(item.label)}
                </Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 19,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.tints[tint].container,
                    }}
                  >
                    <Ionicons
                      name={outlineIcon(item.icon)}
                      size={34}
                      color={colors.tints[tint].onContainer}
                    />
                  </View>
                  {showBadge ? (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        minWidth: 24,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: accent,
                      }}
                    >
                      <Text
                        verbatim
                        style={{ fontSize: 12, fontWeight: '800', color: colors.background }}
                      >
                        {value}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View>
                  <Text
                    verbatim
                    style={{ fontSize: 14, fontWeight: '700', color: colors.onSurface }}
                  >
                    {softBreaks(t(item.label))}
                  </Text>
                  {item.soon ? (
                    <Text style={{ fontSize: 12, color: colors.anstoss.textTertiary }}>
                      Bald verfügbar
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </PressScale>
        );
      })}
    </View>
  );
}

/** Lange Kachelnamen trennen an Wortfugen (weiche Trennstriche) statt mitten im Wort. */
const SOFT_BREAKS: [string, string][] = [
  ['Veranstaltungen', 'Veranstal\u00ADtungen'],
  ['Ansprechpartner', 'Ansprech\u00ADpartner'],
  ['Platzbelegung', 'Platz\u00ADbelegung'],
  ['Strafenkatalog', 'Strafen\u00ADkatalog'],
  ['Kassenverwaltung', 'Kassen\u00ADverwaltung'],
  ['Spielerbewegungen', 'Spieler\u00ADbewegungen'],
  ['Änderungsprotokoll', 'Änderungs\u00ADprotokoll'],
  ['Benachrichtigungen', 'Benachrichti\u00ADgungen'],
  ['Mannschaftszuschuss', 'Mannschafts\u00ADzuschuss'],
  ['Beitragsübersicht', 'Beitrags\u00ADübersicht'],
  ['Beitragsarten', 'Beitrags\u00ADarten'],
  ['Kassenprüfung', 'Kassen\u00ADprüfung'],
  ['Announcements', 'Announce\u00ADments'],
  ['Contact persons', 'Contact persons'],
];
const softBreaks = (label: string) =>
  SOFT_BREAKS.reduce((text, [word, soft]) => text.replace(word, soft), label);

const TINT_ORDER: TintKey[] = ['blue', 'orange', 'pink', 'green', 'violet'];

// ── Formulare ─────────────────────────────────────────────────────────────────

/** Auswahl aus wenigen Optionen als Chips (einfach oder mehrfach). */
export function ChoiceChips<T extends string>({
  options,
  selected,
  onToggle,
  label,
  tone = 'primary',
  check = false,
  scroll = false,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  selected: T[];
  onToggle: (value: T) => void;
  label?: string;
  /** Farbe der gewählten Option: Vereinsfarbe oder rot (z. B. Grund einer Absage) */
  tone?: 'primary' | 'urgent' | 'light';
  /** zeigt bei der gewählten Option ein Häkchen */
  check?: boolean;
  /** eine einzige, seitlich wischbare Zeile statt Umbruch */
  scroll?: boolean;
}) {
  const { colors, radii, sizes } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {label ? <T variant="label">{label}</T> : null}
      {(() => {
        const row = (children: ReactNode) =>
          scroll ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
              accessibilityRole="radiogroup"
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
              accessibilityRole="radiogroup"
            >
              {children}
            </View>
          );
        return row(
          options.map((o) => {
            const active = selected.includes(o.value);
            // `light`: Filterzeile – die gewählte Option ist weiß mit dunkler Schrift
            const fill =
              tone === 'urgent'
                ? colors.status.urgent.solid
                : tone === 'light'
                  ? colors.onSurface
                  : colors.primary;
            const onFill =
              tone === 'urgent'
                ? colors.status.urgent.onSolid
                : tone === 'light'
                  ? colors.background
                  : colors.onPrimary;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  hapticSelect();
                  onToggle(o.value);
                }}
                hitSlop={{ top: 6, bottom: 6 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: sizes.chipHeight + 2,
                  paddingHorizontal: 15,
                  paddingVertical: 9,
                  maxWidth: '100%',
                  borderRadius: radii.pill,
                  borderWidth: 1.5,
                  borderColor: active ? fill : colors.anstoss.fieldBorder,
                  backgroundColor: active ? fill : colors.anstoss.card,
                }}
              >
                {active && check ? <Ionicons name="checkmark" size={16} color={onFill} /> : null}
                {o.icon ? (
                  <Ionicons name={o.icon} size={15} color={active ? onFill : colors.onSurface} />
                ) : null}
                <Text
                  style={{
                    flexShrink: 1,
                    fontSize: 13.5,
                    fontWeight: '700',
                    color: active ? onFill : colors.onSurface,
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          }),
        );
      })()}
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline,
  kind = 'text',
  onSubmit,
  accent,
  hint,
  letterSpacing,
  editable = true,
}: {
  /** gesperrt (z. B. Antworten einer Umfrage nach der ersten Stimme) */
  editable?: boolean;
  /** Laufweite in px (z. B. Kürzel) */
  letterSpacing?: number;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  /** Steuert Tastatur, Autovervollständigung und verdeckte Eingabe */
  kind?: 'text' | 'email' | 'password' | 'newPassword' | 'code' | 'url' | 'phone' | 'date';
  onSubmit?: () => void;
  /** hebt das Feld farbig umrandet hervor (z. B. Pflichtfeld in Gelb) */
  accent?: string;
  /** Hinweis unter dem Feld */
  hint?: string;
}) {
  const { colors } = useTheme();
  const secret = kind === 'password' || kind === 'newPassword';
  const [shown, setShown] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="label">{label}</T>
        {/* Zähler nur bei langen Texten oder nahe am Limit – kurze Felder bleiben ruhig */}
        {maxLength && !secret && (maxLength >= 200 || value.length >= maxLength * 0.8) ? (
          <T variant="caption">{`${value.length} / ${maxLength}`}</T>
        ) : null}
      </View>
      <View>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ? t(placeholder) : placeholder}
          placeholderTextColor={colors.anstoss.placeholder}
          maxLength={maxLength}
          multiline={multiline}
          editable={editable}
          secureTextEntry={secret && !shown}
          autoCapitalize={kind === 'text' ? 'sentences' : 'none'}
          autoCorrect={kind === 'text'}
          keyboardType={
            kind === 'email'
              ? 'email-address'
              : kind === 'code'
                ? 'number-pad'
                : kind === 'url'
                  ? 'url'
                  : kind === 'phone'
                    ? 'phone-pad'
                    : kind === 'date'
                      ? 'numbers-and-punctuation'
                      : 'default'
          }
          autoComplete={
            kind === 'email'
              ? 'email'
              : kind === 'password'
                ? 'current-password'
                : kind === 'newPassword'
                  ? 'new-password'
                  : kind === 'code'
                    ? 'one-time-code'
                    : kind === 'phone'
                      ? 'tel'
                      : undefined
          }
          onSubmitEditing={onSubmit}
          style={{
            minHeight: multiline ? 88 : 56,
            borderWidth: accent ? 2 : 1.5,
            borderColor: accent ?? colors.anstoss.fieldBorder,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            ...inputFont(),
            color: colors.onSurface,
            ...(letterSpacing ? { letterSpacing, fontWeight: '800' as const } : null),
            backgroundColor: colors.anstoss.card,
            textAlignVertical: multiline ? 'top' : 'center',
            ...(secret ? { paddingRight: 88 } : null),
          }}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(shown ? 'Passwort verbergen' : 'Passwort anzeigen')}
            onPress={() => setShown(!shown)}
            style={{
              position: 'absolute',
              right: 4,
              top: 0,
              bottom: 0,
              minWidth: 80,
              paddingHorizontal: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '700' }}>
              {t(shown ? 'Verbergen' : 'Zeigen')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? <T variant="caption">{hint}</T> : null}
    </View>
  );
}

const dayLabel = dateFormat({
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Datumsauswahl: Pfeile verschieben um einen Tag, Antippen des Datums öffnet einen Kalender
 * (Monatsraster, Wischen zwischen Monaten, „Heute“, Mindest-/Höchstdatum).
 */
export function DateStepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  /** ISO-Datum JJJJ-MM-TT */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const shift = (days: number) => {
    const d = new Date(`${value}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    const next = d.toISOString().slice(0, 10);
    if ((!min || next >= min) && (!max || next <= max)) onChange(next);
  };
  const button = (icon: IconName, days: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => shift(days)}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.anstoss.overlayStrong : colors.anstoss.overlay,
      })}
    >
      <Ionicons name={icon} size={18} color={colors.onSurface} />
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 6,
          borderRadius: 18,
          backgroundColor: colors.anstoss.card,
          borderWidth: 1.5,
          borderColor: colors.anstoss.fieldBorder,
        }}
      >
        {button('chevron-back', -1, `${label}: einen Tag früher`)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: Kalender öffnen`}
          onPress={() => setOpen(true)}
          style={{
            flex: 1,
            minHeight: 40,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.onSurfaceMuted} />
          <Text
            style={{
              textAlign: 'center',
              fontSize: 15,
              fontWeight: '700',
              color: colors.onSurface,
            }}
          >
            {dayLabel.format(new Date(`${value}T00:00:00Z`))}
          </Text>
        </Pressable>
        {button('chevron-forward', 1, `${label}: einen Tag später`)}
      </View>
      <CalendarSheet
        visible={open}
        value={value}
        min={min}
        max={max}
        title={label}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const WHEEL_ITEM = 44;
const WHEEL_ROWS = 5;

/** Drehwalze (Wecker-Prinzip): wischen oder scrollen, die Zeile in der Mitte gilt; Antippen springt dorthin. */
function Wheel({
  values,
  value,
  onChange,
  label,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const { colors, radii } = useTheme();
  const ref = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, values.indexOf(value));
  // Impuls je Schritt, wenn die Walze an einer Zeile einrastet
  const tick = useRef(index);
  useEffect(() => {
    // Startposition ohne Animation (nach dem Aufbau des Fensters)
    const id = setTimeout(
      () => ref.current?.scrollTo({ y: index * WHEEL_ITEM, animated: false }),
      30,
    );
    return () => clearTimeout(id);
    // nur beim Öffnen
  }, []);
  const settle = (y: number) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(y / WHEEL_ITEM)));
    ref.current?.scrollTo({ y: i * WHEEL_ITEM, animated: true });
    if (values[i] !== value) onChange(values[i]!);
  };
  const step = (delta: number) => {
    const i = Math.min(values.length - 1, Math.max(0, index + delta));
    ref.current?.scrollTo({ y: i * WHEEL_ITEM, animated: true });
    onChange(values[i]!);
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: String(value).padStart(2, '0') }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ width: 84, height: WHEEL_ITEM * WHEEL_ROWS }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: WHEEL_ITEM * 2,
          height: WHEEL_ITEM,
          borderRadius: radii.md,
          backgroundColor: colors.primaryContainer,
        }}
      />
      <ScrollView
        ref={ref}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const row = Math.min(values.length - 1, Math.max(0, Math.round(y / WHEEL_ITEM)));
          if (row !== tick.current) {
            tick.current = row;
            hapticSelect();
          }
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => settle(y), 140);
        }}
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM * 2 }}
      >
        {values.map((v, i) => (
          <Pressable
            key={v}
            accessible={false}
            onPress={() => {
              ref.current?.scrollTo({ y: i * WHEEL_ITEM, animated: true });
              onChange(v);
            }}
            style={{ height: WHEEL_ITEM, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              verbatim
              style={{
                fontSize: 24,
                fontWeight: v === value ? '800' : '500',
                color: v === value ? colors.onPrimaryContainer : colors.onSurfaceMuted,
                fontVariant: ['tabular-nums'],
              }}
            >
              {String(v).padStart(2, '0')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Zeitauswahl überall (Paket ZE, Wecker-Prinzip): Tippen auf die Uhrzeit öffnet ein Fenster mit zwei Drehwalzen
 * (Stunde 00–23, Minute in 5er-Schritten); „Übernehmen“ setzt die Zeit. Ersetzt die −/+-Knöpfe.
 */
export function TimeStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
  /** wird nicht mehr gebraucht (die Walze geht in 5er-Schritten); bleibt für bestehende Aufrufe */
  step?: number;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [h0, m0] = value.split(':').map(Number) as [number, number];
  const [hour, setHour] = useState(h0);
  const [minute, setMinute] = useState(m0);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // 5er-Schritte; eine bestehende Zeit dazwischen (z. B. 17:50 → 17:45 gibt es, 17:47 nicht) bleibt wählbar
  const minutes = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), m0])].sort(
    (a, b) => a - b,
  );
  const show = () => {
    setHour(h0);
    setMinute(m0);
    setOpen(true);
  };
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(label)}: ${value} Uhr`}
        onPress={show}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minHeight: 58,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: open ? colors.primary : colors.anstoss.fieldBorder,
          backgroundColor: pressed ? colors.anstoss.overlayStrong : colors.anstoss.card,
        })}
      >
        <Ionicons name="time-outline" size={20} color={colors.primaryText} />
        <Text
          verbatim
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: colors.onSurface,
            fontVariant: ['tabular-nums'],
          }}
        >
          {value}
        </Text>
        <Text style={{ fontSize: 14, color: colors.onSurfaceMuted }}>Uhr</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
        >
          <Wheel values={hours} value={hour} onChange={setHour} label={t('Stunde')} />
          <Text verbatim style={{ fontSize: 28, fontWeight: '800', color: colors.onSurface }}>
            :
          </Text>
          <Wheel values={minutes} value={minute} onChange={setMinute} label={t('Minute')} />
        </View>
        <Button
          label="Übernehmen"
          icon="checkmark"
          onPress={() => {
            onChange(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
            setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

/** Kennzahl mit Beschriftung, z. B. im Kaderstatus. */
export function Stat({
  value,
  label,
  color,
  labelColor,
}: {
  value: string | number;
  label: string;
  color?: string;
  /** Beschriftungsfarbe, z. B. auf der Vereinsfarbe */
  labelColor?: string;
}) {
  const { colors } = useTheme();
  const counted = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <T
        variant="figure"
        color={color ?? colors.primaryText}
        numberOfLines={1}
        style={{ fontSize: 28, lineHeight: 32 }}
      >
        {typeof value === 'number' ? counted : value}
      </T>
      <T variant="caption" color={labelColor} style={{ textAlign: 'center' }}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
});

/** Umschalter zwischen wenigen Ansichten (Anstoß: Behälter 7 % Weiß, aktive Option in Vereinsfarbe). */
export function Segment<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: 16,
        backgroundColor: colors.anstoss.overlay,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) {
                hapticSelect();
                onChange(o.value);
              }
            }}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 11,
              paddingHorizontal: 13,
              borderRadius: 12,
              backgroundColor: active ? colors.primary : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13.5,
                fontWeight: '700',
                color: active ? colors.onPrimary : colors.onSurface,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Ticket (Wochenansicht): 132 breit, Farbstreifen links (Status), Wochentag, große Tageszahl, Titel und
 * Nebenzeile. Die Farbe ist nie die einzige Information: der Zustand steht in `caption` bzw. im Titel.
 */
export function Ticket({
  weekday,
  day,
  title,
  caption,
  color,
  struck,
  onPress,
}: {
  weekday: string;
  day: string;
  title: string;
  caption?: string;
  color: string;
  struck?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressScale
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[weekday, day, title, caption].filter(Boolean).join(', ')}
      disabled={!onPress}
      onPress={onPress}
      style={{
        width: 132,
        minHeight: 44,
        borderRadius: 20,
        overflow: 'hidden',
        padding: 14,
        backgroundColor: colors.anstoss.card,
        borderWidth: 1,
        borderColor: colors.anstoss.cardBorder,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: color,
        }}
      />
      <T variant="caption" style={{ fontWeight: '700', textTransform: 'uppercase' }}>
        {weekday.replace('.', '')}
      </T>
      <T variant="figure" style={{ fontSize: 40, lineHeight: 40 }} verbatim>
        {day}
      </T>
      <T
        numberOfLines={1}
        style={{
          marginTop: 8,
          fontSize: 13.5,
          fontWeight: '700',
          textDecorationLine: struck ? 'line-through' : 'none',
        }}
      >
        {title}
      </T>
      {caption ? (
        <T variant="caption" numberOfLines={2} style={{ marginTop: 2, fontSize: 11.5 }}>
          {caption}
        </T>
      ) : null}
    </PressScale>
  );
}

/**
 * Weicher Rand mit kleinem Pfeil ganz rechts am Bildschirm: zeigt, dass eine Leiste nach rechts weitergeht
 * (Paket AP). Liegt über der Leiste, fängt keine Berührungen ab.
 */
export function EdgeHint({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 52,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 4,
      }}
    >
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-hidden
      >
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="0.75" stopColor={colors.background} stopOpacity={0.92} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={0.92} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceMuted} />
    </View>
  );
}

/** Linearer Farbverlauf als Hintergrund (diagonal 135° wie im Entwurf), füllt den Elternbereich. */
export function GradientFill({
  from,
  to,
  overlay,
  vertical,
}: {
  from: string;
  to: string;
  /** senkrecht (180°) statt diagonal */
  vertical?: boolean;
  /** zusätzliche Abdunklung nach unten (Bildkarten), 0–1 an der Unterkante */
  overlay?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden
    >
      <Defs>
        <LinearGradient id={`${id}a`} x1="0" y1="0" x2={vertical ? '0' : '1'} y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.2" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={overlay ?? 0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}a)`} />
      {overlay ? <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}b)`} /> : null}
    </Svg>
  );
}

/**
 * Suchfeld für Listen (Stil „Anstoß“): 50 hoch, Lupe, optional daneben der Filterknopf in der Akzentfarbe
 * („Filter · 1“, wenn Filter aktiv sind).
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  filterCount,
  onFilter,
  autoFocus,
}: {
  autoFocus?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  /** Anzahl aktiver Filter; mit `onFilter` erscheint der Filterknopf */
  filterCount?: number;
  onFilter?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View
        style={{
          flex: 1,
          height: 50,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: colors.anstoss.card,
          borderWidth: 1.5,
          borderColor: colors.anstoss.fieldBorder,
        }}
      >
        <Ionicons name="search-outline" size={18} color={colors.anstoss.placeholder} />
        <TextInput
          accessibilityLabel={t(placeholder)}
          value={value}
          onChangeText={onChangeText}
          placeholder={t(placeholder)}
          placeholderTextColor={colors.anstoss.placeholder}
          autoCorrect={false}
          autoFocus={autoFocus}
          style={{
            flex: 1,
            fontSize: 14,
            color: colors.onSurface,
            ...inputFont(),
            ...({ outlineStyle: 'none' } as object),
          }}
        />
      </View>
      {onFilter ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t('Filter')}
          onPress={onFilter}
          style={{
            height: 50,
            minWidth: 50,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: 15,
            borderRadius: 16,
            backgroundColor: colors.primary,
          }}
        >
          <Ionicons name="options-outline" size={18} color={colors.onPrimary} />
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.onPrimary }}>
            {filterCount ? t(`Filter · ${filterCount}`) : t('Filter')}
          </Text>
        </PressScale>
      ) : null}
    </View>
  );
}

/**
 * Runder „…“-Knopf (44) mit Menü von unten (Vorlage U13/U14): ein Hauptknopf je Karte, alles Weitere
 * hier; Löschen steht zuletzt in Rot und fragt immer nach (siehe `useConfirmDelete`).
 */
export function MoreMenu({
  title,
  actions,
}: {
  title: string;
  actions: { label: string; icon: IconName; onPress: () => void; danger?: boolean }[];
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;
  return (
    <>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={t('Weitere Aktionen')}
        onPress={() => setOpen(true)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.anstoss.overlayStrong,
        }}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurface} />
      </PressScale>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <View>
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                a.onPress();
              }}
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.anstoss.divider,
              }}
            >
              <Ionicons
                name={a.icon}
                size={20}
                color={a.danger ? colors.status.urgent.onContainer : colors.onSurface}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: a.danger ? colors.status.urgent.onContainer : colors.onSurface,
                }}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </>
  );
}

/** Kennzahl-Pille im Hero („Bilanz 5-1-0“, „Einnahmen 662,35 €“): Saira 19, Weiß bei 18 %. */
export function HeroPill({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 3,
        backgroundColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <T variant="headline" color={colors.hero.onHero} style={{ fontSize: 19, lineHeight: 24 }}>
        {label}
      </T>
    </View>
  );
}
