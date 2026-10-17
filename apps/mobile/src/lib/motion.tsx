import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * Bewegung des Stils „Anstoß“: Druck-Zustand, Hochzählen, gestaffeltes Einblenden. Alles schaltet sich ab,
 * wenn das Gerät „Bewegung reduzieren“ meldet.
 */
let reduced = false;
const listeners = new Set<() => void>();
let started = false;
function start() {
  if (started) return;
  started = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((v) => {
      reduced = v;
      listeners.forEach((l) => l());
    })
    .catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
    reduced = v;
    listeners.forEach((l) => l());
  });
}

export function useReduceMotion(): boolean {
  start();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => reduced,
    () => false,
  );
}

const native = Platform.OS !== 'web';

/** Pressable mit Druck-Zustand: Skalierung auf 0,97 in ca. 100 ms, `style` bekommt weiterhin `pressed`. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function PressScale({
  style,
  onPressIn,
  onPressOut,
  scale = 0.97,
  ...rest
}: Omit<ComponentProps<typeof Pressable>, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  scale?: number;
}) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const to = (v: number) =>
    Animated.timing(value, {
      toValue: v,
      duration: reduce ? 0 : 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: native,
    }).start();
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        to(scale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        to(1);
        onPressOut?.(e);
      }}
      style={[resolved, { transform: [{ scale: value }] }]}
    />
  );
}

/** Zahl, die beim ersten Anzeigen in ca. 0,9 s hochzählt (ohne Bewegung: sofort der Endwert). */
export function useCountUp(target: number, duration = 900): number {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(reduce ? target : 0);
  const done = useRef(false);
  useEffect(() => {
    if (reduce || done.current) {
      setShown(target);
      return;
    }
    done.current = true;
    const t0 = Date.now();
    let frame: ReturnType<typeof setTimeout>;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(target * eased));
      if (p < 1) frame = setTimeout(tick, 32);
    };
    tick();
    return () => clearTimeout(frame);
  }, [target, reduce, duration]);
  return shown;
}

/**
 * Zahl in einem Text, die beim ersten Anzeigen hochzählt (Kennzahlen in Blickflächen). `format` macht aus dem
 * laufenden Wert den Text, z. B. `formatEuro` für Cent-Beträge; ohne Bewegung steht sofort der Endwert.
 */
export function Counted({ value, format }: { value: number; format?: (n: number) => string }) {
  const n = useCountUp(value);
  return <>{format ? format(n) : String(n)}</>;
}

const seen = new Set<string>();

/** Blendet Inhalt ein (350 ms, Abstand 70 ms je Element) – nur beim ersten Laden eines Bildschirms. */
export function FadeIn({
  children,
  index = 0,
  group,
  style,
}: {
  children: ReactNode;
  index?: number;
  /** Bildschirmname; wurde er schon gezeigt, erscheint der Inhalt sofort */
  group?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const key = group ? `${group}:${index}` : null;
  const skip = reduce || (key !== null && seen.has(key));
  const value = useRef(new Animated.Value(skip ? 1 : 0)).current;
  useEffect(() => {
    if (skip) return;
    if (key) seen.add(key);
    Animated.timing(value, {
      toValue: 1,
      duration: 350,
      delay: index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [skip, key, index, value]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Füllstand eines Balkens (0–1), wächst in 0,85 s. */
export function useBarFill(target: number): Animated.Value {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(reduce ? target : 0)).current;
  useEffect(() => {
    Animated.timing(value, {
      toValue: target,
      duration: reduce ? 0 : 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [target, reduce, value]);
  return value;
}

/** Füllbalken: die Füllung wächst beim ersten Anzeigen auf `percent` (0–100) Prozent der Breite. */
export function GrowBar({ percent, style }: { percent: number; style?: StyleProp<ViewStyle> }) {
  const grow = useBarFill(1);
  const target = `${Math.max(0, Math.min(100, percent))}%`;
  return (
    <Animated.View
      style={[
        style,
        { width: grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', target] }) },
      ]}
    />
  );
}

/** Balken aus Abschnitten (flex): die ganze Reihe wächst beim ersten Anzeigen von links auf volle Breite. */
export function GrowRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const grow = useBarFill(1);
  return (
    <Animated.View
      style={[
        style,
        { width: grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Scroll-Position des umgebenden Bildschirms (für die schrumpfende Kopfzeile). */
export const ScrollYContext = createContext<Animated.Value | null>(null);
export const useScrollY = () => useContext(ScrollYContext);
