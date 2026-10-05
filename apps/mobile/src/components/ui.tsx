/**
 * Grundbausteine der Oberfläche. Alle Farben kommen aus dem Vereinsthema (siehe
 * docs/FARBKONZEPT.md): `primary` nur als Fläche, `primaryText` für Text/Icons auf Karten,
 * Statusfarben immer mit Beschriftung.
 */
import { Ionicons } from '@expo/vector-icons';
import type { StatusKey } from '@clubroof/design-tokens';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ── Typografie ────────────────────────────────────────────────────────────────

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'overline';

export function T({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
}: {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const { colors, fontSizes } = useTheme();
  const variants: Record<TextVariant, TextStyle> = {
    display: { fontSize: fontSizes.headline, fontWeight: '800', letterSpacing: -0.3 },
    title: { fontSize: fontSizes.title, fontWeight: '800' },
    heading: { fontSize: fontSizes.bodyLarge, fontWeight: '700' },
    body: { fontSize: fontSizes.body, fontWeight: '400', lineHeight: 21 },
    label: { fontSize: fontSizes.label, fontWeight: '600' },
    caption: { fontSize: fontSizes.caption, fontWeight: '500' },
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
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.surface }}>
      {header}
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: spacing.xxxl,
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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderRadius: radii.lg,
          padding: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
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
        <T variant="heading">{title}</T>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link">
            <T variant="label" color={colors.primaryText}>
              {action} ›
            </T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// ── Chips & Badges ────────────────────────────────────────────────────────────

export function Chip({
  label,
  tone = 'primary',
  icon,
}: {
  label: string;
  tone?: StatusKey | 'primary' | 'neutral';
  icon?: IconName;
}) {
  const { colors, radii } = useTheme();
  const palette =
    tone === 'primary'
      ? { bg: colors.primaryContainer, fg: colors.onPrimaryContainer }
      : tone === 'neutral'
        ? { bg: colors.surfaceVariant, fg: colors.onSurfaceMuted }
        : { bg: colors.status[tone].container, fg: colors.status[tone].onContainer };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: palette.bg,
        borderRadius: radii.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      {icon ? <Ionicons name={icon} size={12} color={palette.fg} /> : null}
      <Text style={{ color: palette.fg, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
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
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radii } = useTheme();
  const palette = {
    primary: {
      bg: colors.primary,
      pressed: colors.primaryPressed,
      fg: colors.onPrimary,
      border: colors.primary,
    },
    outline: {
      bg: colors.surface,
      pressed: colors.surfaceVariant,
      fg: colors.onSurface,
      border: colors.border,
    },
    danger: {
      bg: colors.surface,
      pressed: colors.status.urgent.container,
      fg: colors.status.urgent.onContainer,
      border: colors.border,
    },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 46,
          paddingHorizontal: 16,
          borderRadius: radii.md,
          borderWidth: 1,
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
          {icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
          <Text style={{ color: palette.fg, fontSize: 15, fontWeight: '800' }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ── Wappen & Avatar ───────────────────────────────────────────────────────────

/** Vereinswappen. Solange kein Logo hochgeladen ist, ein Schild mit Kürzel in Vereinsfarbe. */
export function Crest({ initials, size = 40 }: { initials: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 40 44" accessibilityLabel="Vereinswappen">
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

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const { colors } = useTheme();
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

/** Rundes Icon in einer Kachel, z. B. vor Listeneinträgen. */
export function IconTile({
  name,
  tone = 'primary',
  filled,
}: {
  name: IconName;
  tone?: StatusKey | 'primary';
  filled?: boolean;
}) {
  const { colors } = useTheme();
  const palette = filled
    ? { bg: colors.primary, fg: colors.onPrimary }
    : tone === 'primary'
      ? { bg: colors.primaryContainer, fg: colors.onPrimaryContainer }
      : { bg: colors.status[tone].container, fg: colors.status[tone].onContainer };
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: filled ? 18 : 10,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={18} color={palette.fg} />
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
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  first?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth * 2,
        borderTopColor: colors.border,
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="label" numberOfLines={2} style={{ fontWeight: '700' }}>
          {title}
        </T>
        {typeof subtitle === 'string' ? (
          <T variant="caption" numberOfLines={1}>
            {subtitle}
          </T>
        ) : (
          subtitle
        )}
      </View>
      {trailing}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceMuted} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  ) : (
    content
  );
}

// ── Zustände ──────────────────────────────────────────────────────────────────

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 48, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primaryText} />
    </View>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ gap: 12, alignItems: 'flex-start' }}>
      <Chip tone="urgent" icon="alert-circle" label="Fehler" />
      <T>{message}</T>
      {onRetry ? <Button label="Erneut versuchen" variant="outline" onPress={onRetry} /> : null}
    </Card>
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
      <Ionicons name={icon} size={26} color={colors.onSurfaceMuted} />
      <T variant="caption" style={{ textAlign: 'center' }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
