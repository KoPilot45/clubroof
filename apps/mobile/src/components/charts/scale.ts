import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from '@/lib/motion';

/** Obergrenze einer Achse auf „runde“ Werte (1, 2, 2,5, 5 × 10ⁿ). */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const f = max / base;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * base;
}

/** Wertebereich einer oder mehrerer Reihen inklusive Nulllinie. */
export function extent(values: number[]): { min: number; max: number } {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  return { min: lo < 0 ? -niceMax(-lo) : 0, max: niceMax(hi) };
}

/** Fortschritt 0 → 1 (ca. 0,85 s) für Linien, Säulen und Balken; sofort 1 bei „Bewegung reduzieren“. */
export function useGrow(deps: unknown[] = []): number {
  const reduce = useReduceMotion();
  const [p, setP] = useState(reduce ? 1 : 0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (reduce) {
      setP(1);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 850);
      setP(1 - (1 - t) ** 3);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    setP(0);
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [reduce, ...deps]);
  return p;
}

/** Berührung oder Maus über der Zeichenfläche → Index (rastet auf den nächsten Punkt). */
export function usePointer(width: number, count: number, onIndex: (i: number) => void) {
  const set = (x: number) => {
    if (width <= 0 || count <= 0) return;
    const i = Math.round((x / width) * count - 0.5);
    onIndex(Math.max(0, Math.min(count - 1, i)));
  };
  return {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (e: { nativeEvent: { locationX: number } }) => set(e.nativeEvent.locationX),
    onResponderMove: (e: { nativeEvent: { locationX: number } }) => set(e.nativeEvent.locationX),
  };
}
