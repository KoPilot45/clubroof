/**
 * Grundbausteine der Oberfläche. Alle Farben kommen aus dem Vereinsthema (siehe
 * docs/FARBKONZEPT.md): `primary` nur als Fläche, `primaryText` für Text/Icons auf Karten,
 * Statusfarben immer mit Beschriftung.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { StatusKey } from '@clubroof/design-tokens';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Switch,
  Image,
  Pressable,
  TextInput,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { HEADING_FONT, inputFont } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';
import { Text } from './app-text';
import { RequestError } from '@/lib/api';
import { mediaUri } from '@/lib/upload';
import { dateFormat, t } from '@/lib/i18n';

export type IconName = ComponentProps<typeof Ionicons>['name'];

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
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link">
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
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  /** tonal = dezente Vereinsfarbe für Nebenaktionen in Listen, action = gewählter Zwischenstatus */
  variant?: 'primary' | 'outline' | 'danger' | 'tonal' | 'action';
  /** sm für Aktionen innerhalb von Listen und Karten */
  size?: 'md' | 'sm';
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
  }[variant];
  const small = size === 'sm';
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
          minHeight: small ? 36 : 46,
          paddingHorizontal: small ? 12 : 16,
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
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={palette.fg} /> : null}
          <Text style={{ color: palette.fg, fontSize: small ? 13 : 15, fontWeight: '800' }}>
            {label}
          </Text>
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
  const main = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="label" numberOfLines={2} style={{ fontWeight: '700' }}>
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
        paddingVertical: spacing.sm + 2,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth * 2,
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
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceMuted} /> : null}
    </View>
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
      <Card style={{ gap: 12, alignItems: 'flex-start' }}>
        <Chip
          tone="info"
          icon={status === 403 ? 'lock-closed' : 'search'}
          label={status === 403 ? 'Kein Zugriff' : 'Nicht gefunden'}
        />
        <T>{text}</T>
        {router.canGoBack() ? (
          <Button label="Zurück" variant="outline" onPress={() => router.back()} />
        ) : (
          <Button label="Zur Startseite" variant="outline" onPress={() => router.replace('/')} />
        )}
      </Card>
    );
  }
  return (
    <Card style={{ gap: 12, alignItems: 'flex-start' }}>
      <Chip tone="urgent" icon="alert-circle" label="Fehler" />
      <T>{text}</T>
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
};

export function TileGrid({ items }: { items: TileItem[] }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {items.map((item) => {
        const disabled = item.soon || !item.onPress;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityLabel={item.soon ? `${item.label}, bald verfügbar` : item.label}
            disabled={disabled}
            onPress={item.onPress}
            style={({ pressed }) => ({
              flexBasis: '47%',
              flexGrow: 1,
              minHeight: 96,
              gap: 10,
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
              opacity: item.soon ? 0.55 : 1,
            })}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.primaryContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={item.icon} size={19} color={colors.onPrimaryContainer} />
              </View>
              {!item.soon && item.badge !== undefined && item.badge !== 0 ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: 6,
                    borderRadius: 11,
                    backgroundColor: colors.status.action.container,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: HEADING_FONT,
                      fontSize: 14,
                      fontWeight: '400',
                      color: colors.status.action.onContainer,
                    }}
                  >
                    {item.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={{ gap: 2 }}>
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: colors.onSurface }}
                numberOfLines={2}
              >
                {item.label}
              </Text>
              {item.soon || item.hint ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color:
                      item.tone && item.tone !== 'neutral'
                        ? colors.status[item.tone].onContainer
                        : colors.onSurfaceMuted,
                  }}
                  numberOfLines={2}
                >
                  {item.soon ? 'Bald verfügbar' : item.hint}
                </Text>
              ) : null}
            </View>
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
  const { colors, radii } = useTheme();
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
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                maxWidth: '100%',
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : colors.surface,
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
  kind?: 'text' | 'email' | 'password' | 'newPassword' | 'code';
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
          kind === 'email' ? 'email-address' : kind === 'code' ? 'number-pad' : 'default'
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
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <T variant="figure" color={color ?? colors.primaryText}>
        {value}
      </T>
      <T variant="caption" style={{ textAlign: 'center' }}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
});
