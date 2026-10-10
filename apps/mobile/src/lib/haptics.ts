import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptisches Feedback (iOS/Android): leise, kurz und nur dort, wo eine Handlung bestätigt wird – Zu-/Absage,
 * Abhaken, Schalter, Fehler. Im Browser und wenn das Gerät es nicht kann, passiert nichts.
 */
const run = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
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
