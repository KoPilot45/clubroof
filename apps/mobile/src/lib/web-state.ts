import type { PressableStateCallbackType } from 'react-native';

/** Zustand eines Pressable inklusive der Web-Zustände Hover und Fokus (react-native-web); nativ immer leer. */
export type WebPressState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };
export const webState = (state: PressableStateCallbackType) => state as WebPressState;
