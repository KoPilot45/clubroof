/**
 * Grundbausteine der Oberfläche. Alle Farben kommen aus dem Vereinsthema (siehe
 * docs/FARBKONZEPT.md): `primary` nur als Fläche, `primaryText` für Text/Icons auf Karten,
 * Statusfarben immer mit Beschriftung.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import type { StatusKey, TintKey } from '@clubroof/design-tokens';
import {
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
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { HEADING_FONT, inputFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';
import { Text } from './app-text';
import { RequestError } from '@/lib/api';
import { mediaUri } from '@/lib/upload';
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
    title: { fontSize: fontSizes.title, fontWeight: '800' },
    heading: { fontSize: fontSizes.bodyLarge, fontWeight: '700' },
    body: { fontSize: fontSizes.body, fontWeight: '400', lineHeight: 21 },
    label: { fontSize: fontSizes.label, fontWeight: '600' },
    caption: { fontSize: fontSizes.caption, fontWeight: '500' },
    // Zwischenüberschriften: Oswald, Großbuchstaben (Festlegung 07.10.2026)
    section: {
      fontFamily: HEADING_FONT,
      fontSize: 18,
      fontWeight: '400',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    // Kopfzeilen-Titel: Oswald in normaler Schreibweise
    headline: { fontFamily: HEADING_FONT, fontSize: 22, fontWeight: '400', letterSpacing: 0.3 },
    // Große Zahlen (Kassenstand, Ergebnisse, Countdown): Oswald wie eine Anzeigetafel
    figure: { fontFamily: HEADING_FONT, fontSize: 26, fontWeight: '400', letterSpacing: 0.3 },
    overline: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
  };
  const muted = variant === 'caption' || variant === 'overline';
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      accessibilityRole={accessibilityRole}
      verbatim={verbatim}
      style={[
        variants[variant],
        { color: color ?? (muted ? colors.onSurfaceMuted : colors.onSurface) },
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
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: ReactNode;
  edges?: ('top' | 'bottom')[];
}) {
  const { colors, spacing } = useTheme();
  // In den Tabs liegt die schwebende Leiste über dem Inhalt: unten Platz dafür lassen
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: spacing.lg + 4,
          gap: spacing.lg + 2,
          paddingBottom: spacing.xxxl + tabBarHeight,
          // Auf großen Bildschirmen (Browser, Tablet) nicht über die ganze Breite ziehen
          width: '100%',
          maxWidth: 960,
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
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Weiche Karte (Radius 24): hell mit dezentem Schatten ohne Rahmen, dunkel eine Flächenstufe heller
 * mit feinem Rahmen (docs/DESIGNSYSTEM.md).
 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, radii, spacing, isDark, elevation } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceRaised,
          borderRadius: radii.xl,
          padding: spacing.md + 2,
          ...(isDark
            ? { borderWidth: 1, borderColor: colors.border }
            : shadowStyle(elevation.card)),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Blickfangkarte: Verlauf der Vereinsfarbe (`hero.from → hero.to`) mit Wellen und Kreis als SVG, Schrift
 * immer `hero.onHero`. Je Bildschirm genau eine (docs/DESIGNSYSTEM.md, Regel 1). Inhalte setzt die Seite.
 */
export function HeroCard({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** macht die ganze Karte antippbar (dann keine eigenen Buttons darin) */
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, radii, spacing, isDark, elevation } = useTheme();
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  // Hintergrund bekommt die gemessene Größe: wächst die Karte (z. B. nach dem Laden), wächst er mit
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const outer: ViewStyle = {
    borderRadius: radii.xxl,
    ...(isDark ? { borderWidth: 1, borderColor: colors.hero.decor } : shadowStyle(elevation.hero)),
  };
  const body = (
    <View
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ borderRadius: radii.xxl, overflow: 'hidden', padding: spacing.lg, gap: 12 }}
    >
      <Svg
        style={{ position: 'absolute', top: 0, left: 0 }}
        width={box?.w ?? 0}
        height={box?.h ?? 0}
        viewBox="0 0 306 270"
        preserveAspectRatio="xMidYMid slice"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0.3" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={colors.hero.from} />
            <Stop offset="0.62" stopColor={colors.hero.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="306" height="270" fill={`url(#${gradientId})`} />
        <Path
          d="M0 160 C50 120 100 200 153 160 C206 120 256 180 306 140 L306 270 L0 270Z"
          fill={colors.hero.decor}
        />
        <Path
          d="M0 200 C60 170 105 235 165 200 C225 170 265 215 306 190 L306 270 L0 270Z"
          fill={colors.hero.decor}
        />
        <Circle cx="270" cy="28" r="64" fill={colors.hero.decor} />
      </Svg>
      {children}
    </View>
  );
  if (onPress)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={[outer, style]}
      >
        {body}
      </Pressable>
    );
  return <View style={[outer, style]}>{body}</View>;
}

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
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.rowBetween}>
        <View style={styles.sectionTitle}>
          <View
            style={{
              width: 4,
              alignSelf: 'stretch',
              borderRadius: 2,
              backgroundColor: colors.primary,
            }}
          />
          <T variant="section" style={{ flexShrink: 1 }} accessibilityRole="header">
            {title}
          </T>
        </View>
        {action && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="link"
          >
            <T variant="label" color={colors.primaryText}>
              {`${t(action)} ›`}
            </T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Blatt von unten (Bestätigung, Auswahl, Grund-Feld): Hintergrund abgedunkelt, Tippen daneben schließt.
 * Inhalt scrollt, wenn er höher als 85 % des Bildschirms wird.
 */
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
  const { colors, radii, spacing, isDark } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
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
            backgroundColor: colors.surfaceRaised,
            ...(isDark ? { borderWidth: 1, borderColor: colors.border } : null),
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 5,
              borderRadius: 3,
              marginTop: 10,
              backgroundColor: colors.border,
            }}
          />
          <ScrollView
            contentContainerStyle={{
              padding: spacing.xl,
              gap: spacing.md,
              paddingBottom: spacing.xxl,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {title ? (
              <T variant="headline" accessibilityRole="header">
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
  /** sm = Statusmarke in Listen und Karten, md = Höhe `sizes.chipHeight` für eigenständige Chips */
  size?: 'sm' | 'md';
}) {
  const { colors, radii, sizes } = useTheme();
  const palette =
    tone === 'primary'
      ? { bg: colors.primaryContainer, fg: colors.onPrimaryContainer }
      : tone === 'neutral'
        ? { bg: colors.surfaceVariant, fg: colors.onSurfaceMuted }
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        minHeight: md ? sizes.chipHeight : 24,
        backgroundColor: palette.bg,
        borderRadius: radii.pill,
        paddingHorizontal: md ? 12 : 10,
        paddingVertical: 2,
      }}
    >
      {icon ? <Ionicons name={icon} size={md ? 14 : 12} color={palette.fg} /> : null}
      <Text
        style={{
          flexShrink: 1,
          color: palette.fg,
          fontSize: md ? 13 : 12,
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
        minWidth: 28,
        height: 20,
        paddingHorizontal: 5,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceVariant,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.onSurface }}>{badge}</Text>
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
  variant?: 'primary' | 'outline' | 'danger' | 'tonal' | 'action' | 'hero' | 'heroOutline';
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
  const palette = {
    primary: {
      bg: colors.primary,
      pressed: colors.primaryPressed,
      fg: colors.onPrimary,
      border: colors.primary,
    },
    outline: {
      bg: 'transparent',
      pressed: colors.surfaceVariant,
      fg: colors.onSurface,
      border: colors.border,
    },
    danger: {
      bg: 'transparent',
      pressed: colors.status.urgent.container,
      fg: colors.status.urgent.onContainer,
      border: colors.border,
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
    // Auf dem Verlauf: weiße (bzw. dunkle) Fläche mit Verlaufsfarbe als Schrift
    hero: {
      bg: colors.hero.onHero,
      pressed: colors.hero.onHero,
      fg: colors.hero.from,
      border: colors.hero.onHero,
    },
    heroOutline: {
      bg: 'transparent',
      pressed: colors.hero.decor,
      fg: colors.hero.onHero,
      border: colors.hero.onHero,
    },
  }[variant];
  const small = size === 'sm';
  const border = variant === 'heroOutline' ? 2 : 1;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hideLabel ? t(label) : undefined}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: small ? sizes.buttonSmall : sizes.button,
          paddingHorizontal: compact ? 6 : small ? 10 : 14,
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
            <Ionicons name={icon} size={hideLabel ? 24 : small ? 16 : 18} color={palette.fg} />
          ) : null}
          {hideLabel ? null : (
            <Text
              numberOfLines={2}
              style={{
                flexShrink: 1,
                textAlign: 'center',
                color: palette.fg,
                fontSize: small ? 13 : 15,
                fontWeight: '800',
              }}
            >
              {label}
            </Text>
          )}
        </>
      )}
    </Pressable>
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
      trackColor={{ true: colors.primary, false: colors.border }}
      thumbColor={colors.surface}
      {...({ activeThumbColor: colors.surface } as object)}
      onValueChange={onChange}
    />
  );
}

// ── Wappen & Avatar ───────────────────────────────────────────────────────────

/** Vereinswappen. Solange kein Logo hochgeladen ist, ein Schild mit Kürzel in Vereinsfarbe. */
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
        fontSize={initials.length > 3 ? 8 : 10}
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
          backgroundColor: colors.primaryContainer,
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
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryContainer,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.onPrimaryContainer, fontWeight: '800', fontSize: size * 0.36 }}>
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
}: {
  weekday: string;
  day: string;
  /** abgesagt: graue Fläche */
  muted?: boolean;
  size?: 'md' | 'lg';
}) {
  const { colors } = useTheme();
  const lg = size === 'lg';
  const fg = muted ? colors.onSurfaceMuted : colors.onPrimaryContainer;
  return (
    <View
      style={{
        width: lg ? 52 : 48,
        height: lg ? 56 : 50,
        borderRadius: lg ? 16 : 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: muted ? colors.surfaceVariant : colors.primaryContainer,
      }}
    >
      <T variant="caption" color={fg} style={{ fontSize: 11, lineHeight: 13 }}>
        {weekday}
      </T>
      <T variant="figure" color={fg} style={{ fontSize: lg ? 22 : 20, lineHeight: lg ? 26 : 24 }}>
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
  const { colors, spacing, sizes } = useTheme();
  const main = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <T
          variant="label"
          numberOfLines={2}
          color={strike ? colors.onSurfaceMuted : undefined}
          style={{ fontWeight: '700', textDecorationLine: strike ? 'line-through' : 'none' }}
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
  const inner = { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md } as const;
  // Zusatz rechts (Buttons, Schalter) steht neben dem antippbaren Bereich, nie darin:
  // verschachtelte Buttons sind im Web ungültig.
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: sizes.touchTarget,
        paddingVertical: spacing.sm + 2,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" style={inner}>
          {main}
        </Pressable>
      ) : (
        <View style={inner}>{main}</View>
      )}
      {trailing}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} /> : null}
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
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: motion.skeletonPulse / 2,
          useNativeDriver: true,
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
          backgroundColor: colors.border,
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
  const { colors, radii, isDark, elevation } = useTheme();
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
              backgroundColor: colors.surfaceRaised,
              ...(isDark
                ? { borderWidth: 1, borderColor: colors.border }
                : shadowStyle(elevation.card)),
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
  const { colors, radii, spacing } = useTheme();
  const c = colors.status[tone];
  return (
    <View
      accessibilityRole={tone === 'urgent' ? 'alert' : undefined}
      style={{
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.xl,
        backgroundColor: c.container,
        borderWidth: 1,
        borderColor: c.solid,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.solid,
          }}
        >
          <Ionicons name={icon} size={20} color={c.onSolid} />
        </View>
        <T variant="heading" color={c.onContainer} style={{ flex: 1 }}>
          {title}
        </T>
      </View>
      <T color={c.onContainer}>{text}</T>
      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          variant="outline"
          onPress={action.onPress}
          style={{ alignSelf: 'flex-start', borderColor: c.solid }}
        />
      ) : null}
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
  if (status === 403 || status === 404) {
    return (
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
      />
    );
  }
  return (
    <Notice
      tone="urgent"
      icon="alert"
      title="Das hat nicht geklappt"
      text={text}
      action={
        onRetry ? { label: 'Erneut versuchen', onPress: onRetry, icon: 'refresh' } : undefined
      }
    />
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
  const { colors, radii } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: 10,
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderRadius: radii.xl,
        backgroundColor: colors.surfaceVariant,
      }}
    >
      <IconTile name={icon} size="lg" />
      <T variant="label" style={{ textAlign: 'center', fontWeight: '700' }}>
        {text}
      </T>
      {hint ? (
        <T variant="caption" style={{ textAlign: 'center', marginTop: -4 }}>
          {hint}
        </T>
      ) : null}
      {action ? (
        <Button label={action.label} size="sm" variant="tonal" onPress={action.onPress} />
      ) : null}
    </View>
  );
}

// ── Kacheln (Untermenüs in Team, Verein, Mehr) ─────────────────────────────────

export type TileItem = {
  key: string;
  label: string;
  icon: IconName;
  onPress?: () => void;
  /** Zahl oder kurzer Hinweis oben rechts, z. B. offene Umfragen */
  badge?: string | number;
  /** Funktion folgt in einem späteren Paket */
  soon?: boolean;
  /** Kurze zweite Zeile, z. B. wer eine Liste anführt */
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
  return <CompactTileGrid items={items} />;
}

/** Lange Kachelnamen trennen an Wortfugen (weiche Trennstriche) statt mitten im Wort. */
const SOFT_BREAKS: [string, string][] = [
  ['Veranstaltungen', 'Veranstal\u00ADtungen'],
  ['Ansprechpartner', 'Ansprech\u00ADpartner'],
  ['Platzbelegung', 'Platz\u00ADbelegung'],
  ['Strafenkatalog', 'Strafen\u00ADkatalog'],
  ['Kassenverwaltung', 'Kassen\u00ADverwaltung'],
  ['Announcements', 'Announce\u00ADments'],
  ['Contact persons', 'Contact persons'],
];
const softBreaks = (label: string) =>
  SOFT_BREAKS.reduce((text, [word, soft]) => text.replace(word, soft), label);

const TINT_ORDER: TintKey[] = ['blue', 'orange', 'pink', 'green', 'violet'];

function CompactTileGrid({ items }: { items: TileItem[] }) {
  const { colors, isDark, elevation } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 14 }}>
      {items.map((item, index) => {
        const disabled = item.soon || !item.onPress;
        const showBadge = !item.soon && item.badge !== undefined && item.badge !== 0;
        const tone = item.tone && item.tone !== 'neutral' ? item.tone : null;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityLabel={[
              item.label,
              showBadge ? String(item.badge) : null,
              item.soon ? 'bald verfügbar' : item.hint,
            ]
              .filter(Boolean)
              .join(', ')}
            disabled={disabled}
            onPress={item.onPress}
            style={{
              width: '22.5%',
              flexGrow: 0,
              alignItems: 'center',
              gap: 6,
              opacity: item.soon ? 0.55 : 1,
            }}
          >
            {({ pressed }) => (
              <>
                <View
                  style={{
                    width: '100%',
                    height: 60,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed ? colors.surfaceVariant : colors.surfaceRaised,
                    ...(isDark
                      ? { borderWidth: 1, borderColor: colors.border }
                      : shadowStyle(elevation.control)),
                  }}
                >
                  <IconTile
                    name={item.icon}
                    tone={item.tint ?? TINT_ORDER[index % TINT_ORDER.length]!}
                  />
                  {showBadge ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -3,
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 6,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: colors.background,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: tone
                          ? colors.status[tone].container
                          : colors.status.action.container,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: tone
                            ? colors.status[tone].onContainer
                            : colors.status.action.onContainer,
                        }}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={2}
                  verbatim
                  style={{
                    fontSize: item.label.length > 11 ? 11 : 12,
                    fontWeight: '600',
                    color: colors.onSurface,
                    textAlign: 'center',
                  }}
                >
                  {softBreaks(t(item.label))}
                </Text>
                {item.soon || item.hint ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      marginTop: -4,
                      fontSize: 11,
                      fontWeight: '600',
                      textAlign: 'center',
                      color: tone ? colors.status[tone].onContainer : colors.onSurfaceMuted,
                    }}
                  >
                    {item.soon ? 'Bald verfügbar' : item.hint}
                  </Text>
                ) : null}
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Formulare ─────────────────────────────────────────────────────────────────

/** Auswahl aus wenigen Optionen als Chips (einfach oder mehrfach). */
export function ChoiceChips<T extends string>({
  options,
  selected,
  onToggle,
  label,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  selected: T[];
  onToggle: (value: T) => void;
  label?: string;
}) {
  const { colors, radii, sizes } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {label ? <T variant="label">{label}</T> : null}
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        accessibilityRole="radiogroup"
      >
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onToggle(o.value)}
              hitSlop={{ top: 6, bottom: 6 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                minHeight: sizes.chipHeight + 2,
                paddingHorizontal: 14,
                paddingVertical: 6,
                maxWidth: '100%',
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : colors.surfaceRaised,
              }}
            >
              {o.icon ? (
                <Ionicons
                  name={o.icon}
                  size={15}
                  color={active ? colors.onPrimary : colors.onSurface}
                />
              ) : null}
              <Text
                style={{
                  flexShrink: 1,
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  /** Steuert Tastatur, Autovervollständigung und verdeckte Eingabe */
  kind?: 'text' | 'email' | 'password' | 'newPassword' | 'code' | 'url';
  onSubmit?: () => void;
}) {
  const { colors, radii } = useTheme();
  const secret = kind === 'password' || kind === 'newPassword';
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="label">{label}</T>
        {maxLength && maxLength > 10 && !secret ? (
          <T variant="caption">{`${value.length} / ${maxLength}`}</T>
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ? t(placeholder) : placeholder}
        placeholderTextColor={colors.onSurfaceMuted}
        maxLength={maxLength}
        multiline={multiline}
        secureTextEntry={secret}
        autoCapitalize={kind === 'text' ? 'sentences' : 'none'}
        autoCorrect={kind === 'text'}
        keyboardType={
          kind === 'email'
            ? 'email-address'
            : kind === 'code'
              ? 'number-pad'
              : kind === 'url'
                ? 'url'
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
                  : undefined
        }
        onSubmitEditing={onSubmit}
        style={{
          minHeight: multiline ? 72 : 46,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          ...inputFont(),
          color: colors.onSurface,
          backgroundColor: colors.surface,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
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

/** Einfache Datumsauswahl mit Vor/Zurück – ohne zusätzliche native Bibliothek. */
export function DateStepper({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  /** ISO-Datum JJJJ-MM-TT */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
}) {
  const { colors, radii } = useTheme();
  const shift = (days: number) => {
    const d = new Date(`${value}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (!min || next >= min) onChange(next);
  };
  const button = (icon: IconName, days: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => shift(days)}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
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
          borderRadius: radii.md,
          backgroundColor: colors.surfaceVariant,
        }}
      >
        {button('chevron-back', -1, `${label}: einen Tag früher`)}
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 15,
            fontWeight: '700',
            color: colors.onSurface,
          }}
        >
          {dayLabel.format(new Date(`${value}T00:00:00Z`))}
        </Text>
        {button('chevron-forward', 1, `${label}: einen Tag später`)}
      </View>
    </View>
  );
}

/** Uhrzeit in 15-Minuten-Schritten (HH:MM). */
export function TimeStepper({
  label,
  value,
  onChange,
  step = 15,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
  step?: number;
}) {
  const { colors, radii } = useTheme();
  const shift = (delta: number) => {
    const [h, m] = value.split(':').map(Number) as [number, number];
    const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
    onChange(
      `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
    );
  };
  const button = (icon: IconName, delta: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => shift(delta)}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
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
          borderRadius: radii.md,
          backgroundColor: colors.surfaceVariant,
        }}
      >
        {button('remove', -step, `${label}: ${step} Minuten früher`)}
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '800',
            color: colors.onSurface,
            fontVariant: ['tabular-nums'],
          }}
        >
          {value} Uhr
        </Text>
        {button('add', step, `${label}: ${step} Minuten später`)}
      </View>
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
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <T variant="figure" color={color ?? colors.primaryText}>
        {value}
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
