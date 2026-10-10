/**
 * Baukasten der Einrichtungsassistenten (Paket E): gleicher Aufbau in jedem Schritt – Zurück, Fortschrittsbalken
 * („Schritt X von N · NN %“), Frage mit kurzer Erklärung, Auswahl, optionaler Hinweis, fester Weiter-Knopf und
 * „Überspringen“. Pro Seite nur ein Thema. Zwischenstände bleiben auf dem Gerät (`useWizardDraft`).
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/app-text';
import { Button, Chip, IconTile, T, shadowStyle, type IconName } from '@/components/ui';
import { readSetting, writeSetting } from '@/lib/flags';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export function WizardShell({
  title,
  explanation,
  step,
  total,
  onBack,
  onNext,
  nextLabel = 'Weiter',
  nextDisabled,
  busy,
  onSkip,
  hint,
  error,
  header,
  children,
}: {
  title: string;
  explanation?: string;
  /** 1-basiert; ohne Angabe (Willkommen, Fertig) kein Fortschrittsbalken */
  step?: number;
  total?: number;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
  onSkip?: () => void;
  /** ruhiger Hinweis unter dem Inhalt („Das änderst du später in der Verwaltung“) */
  hint?: string;
  error?: string | null;
  /** Kopf über dem Titel, z. B. Logo auf der Willkommensseite */
  header?: ReactNode;
  children: ReactNode;
}) {
  const { colors, spacing, sizes, isDark, elevation } = useTheme();
  const percent = step && total ? Math.round(((step - 1) / total) * 100) : 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={{ width: '100%', maxWidth: 520, flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.md,
                minHeight: sizes.headerButton + spacing.lg,
              }}
            >
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Zurück')}
                  onPress={onBack}
                  style={{
                    width: sizes.headerButton,
                    height: sizes.headerButton,
                    borderRadius: sizes.headerButton / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surfaceRaised,
                    ...(isDark
                      ? { borderWidth: 1, borderColor: colors.border }
                      : shadowStyle(elevation.control)),
                  }}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
                </Pressable>
              ) : null}
              {step && total ? (
                <View style={{ flex: 1, gap: 6 }}>
                  <T variant="caption">{`Schritt ${step} von ${total} · ${percent} %`}</T>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: 100, now: percent }}
                    style={{
                      height: 8,
                      borderRadius: 4,
                      overflow: 'hidden',
                      backgroundColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.max(percent, 4)}%`,
                        height: '100%',
                        borderRadius: 4,
                        backgroundColor: colors.primary,
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: spacing.xl,
                gap: spacing.lg,
                paddingBottom: spacing.xl,
              }}
            >
              {header}
              <View style={{ gap: spacing.sm }}>
                <T
                  variant="headline"
                  accessibilityRole="header"
                  style={{ fontSize: 28, lineHeight: 34 }}
                >
                  {title}
                </T>
                {explanation ? <T color={colors.onSurfaceMuted}>{explanation}</T> : null}
              </View>
              {children}
              {hint ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.onSurfaceMuted}
                  />
                  <T variant="caption" style={{ flex: 1 }}>
                    {hint}
                  </T>
                </View>
              ) : null}
              {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
            </ScrollView>
            <View style={{ padding: spacing.xl, paddingTop: spacing.sm, gap: 4 }}>
              <Button
                label={nextLabel}
                onPress={onNext}
                disabled={nextDisabled}
                loading={busy}
                style={{ alignSelf: 'stretch' }}
              />
              {onSkip ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onSkip}
                  style={{
                    minHeight: sizes.touchTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: '700', fontSize: 14 }}>
                    {t('Überspringen')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Auswahlkarte (eine Option aus mehreren, mit Symbol, Titel und Erklärung). */
export function ChoiceCard({
  icon,
  title,
  text,
  selected,
  onPress,
  multi,
  badge,
}: {
  icon: IconName;
  title: string;
  text?: string;
  selected: boolean;
  onPress: () => void;
  /** Kontrollkästchen statt Auswahlkreis */
  multi?: boolean;
  /** z. B. „Empfohlen“ */
  badge?: string;
}) {
  const { colors, radii, isDark, elevation } = useTheme();
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        padding: 14,
        borderRadius: radii.xl,
        backgroundColor: colors.surfaceRaised,
        borderWidth: 2,
        borderColor: selected ? colors.primary : isDark ? colors.border : 'transparent',
        ...(isDark ? null : shadowStyle(elevation.card)),
      }}
    >
      <IconTile name={icon} tone={selected ? 'primary' : 'blue'} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <T variant="label" style={{ fontWeight: '700', flexShrink: 1 }}>
            {title}
          </T>
          {badge ? <Chip label={badge} tone="success" /> : null}
        </View>
        {text ? <T variant="caption">{text}</T> : null}
      </View>
      <Ionicons
        name={
          multi
            ? selected
              ? 'checkbox'
              : 'square-outline'
            : selected
              ? 'radio-button-on'
              : 'radio-button-off'
        }
        size={24}
        color={selected ? colors.primaryText : colors.onSurfaceMuted}
      />
    </Pressable>
  );
}

/** Zahl mit Plus und Minus (z. B. Anzahl Plätze). */
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const { colors, sizes, radii } = useTheme();
  const btn = (name: 'remove' | 'add', delta: number, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(name === 'add' ? `${label} erhöhen` : `${label} verringern`)}
      disabled={off}
      onPress={() => onChange(value + delta)}
      style={{
        width: sizes.touchTarget + 4,
        height: sizes.touchTarget + 4,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primaryContainer,
        opacity: off ? 0.4 : 1,
      }}
    >
      <Ionicons name={name} size={22} color={colors.onPrimaryContainer} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
        {label}
      </T>
      {btn('remove', -1, value <= min)}
      <T variant="figure" style={{ minWidth: 36, textAlign: 'center', fontSize: 28 }}>
        {value}
      </T>
      {btn('add', 1, value >= max)}
    </View>
  );
}

/**
 * Zwischenstand eines Assistenten auf dem Gerät: wird geladen, bei jeder Änderung gespeichert und nach dem
 * Abschluss gelöscht. Geheimnisse (Passwort, Code) gehören nicht hinein.
 */
export function useWizardDraft<T extends object>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    void readSetting(key).then((raw) => {
      try {
        if (raw) setState({ ...initial, ...(JSON.parse(raw) as Partial<T>) });
      } catch {
        // beschädigter Entwurf: neu beginnen
      }
      setLoaded(true);
    });
    // nur beim Öffnen
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    if (first.current) {
      first.current = false;
      return;
    }
    void writeSetting(key, JSON.stringify(state));
  }, [state, loaded, key]);
  const patch = (p: Partial<T>) => setState((s) => ({ ...s, ...p }));
  const clear = () => void writeSetting(key, null);
  return { state, patch, loaded, clear };
}
