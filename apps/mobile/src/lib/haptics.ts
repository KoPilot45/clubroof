import * as Haptics from 'expo-haptics';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { readSetting, writeSetting } from './flags';

/**
 * Haptisches Feedback (iOS/Android): leise, kurz und nur dort, wo eine Handlung bestätigt wird – Zu-/Absage,
 * Abhaken, Schalter, Fehler. Im Browser und wenn das Gerät es nicht kann, passiert nichts.
 */
let enabled = true;
const listeners = new Set<() => void>();

/** Vibration ein-/ausschalten (pro Gerät, Standard: an); gespeichert wird nur das Ausschalten. */
export async function loadHaptics() {
  const stored = await readSetting('haptics');
  if (stored === 'off' && enabled) {
    enabled = false;
    listeners.forEach((l) => l());
  }
}
export function setHapticsEnabled(value: boolean) {
  enabled = value;
  listeners.forEach((l) => l());
  void writeSetting('haptics', value ? null : 'off');
}
export const useHapticsEnabled = (): boolean =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => enabled,
    () => true,
  );

const run = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web' || !enabled) return;
  void fn().catch(() => undefined);
};

/** Auswahl oder Schalter geändert (Tab, Chip, Kontrollkästchen). */
export const hapticSelect = () => run(() => Haptics.selectionAsync());
/** Aktion erfolgreich (Zu-/Absage gespeichert, Aufgabe erledigt). */
export const hapticSuccess = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
/** Aktion fehlgeschlagen. */
export const hapticError = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
