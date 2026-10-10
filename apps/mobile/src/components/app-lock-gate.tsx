import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { Button, T } from '@/components/ui';
import { useAppLockEnabled, useAppLockLoaded } from '@/lib/app-lock';
import { deviceAuthenticate } from '@/lib/device-auth';
import { useTheme } from '@/lib/theme';

/** Nach so vielen Sekunden im Hintergrund wird wieder gesperrt. */
const RELOCK_AFTER_SECONDS = 60;

/** Deckt die App ab, solange sie gesperrt ist; entsperrt wird mit Face ID, Fingerabdruck oder Gerätecode. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const enabled = useAppLockEnabled();
  const loaded = useAppLockLoaded();
  const { colors } = useTheme();
  const [locked, setLocked] = useState(true);
  const leftAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (await deviceAuthenticate('Clubroof entsperren')) setLocked(false);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (enabled) void unlock();
    else setLocked(false);
  }, [loaded, enabled, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') leftAt.current ??= Date.now();
      else if (state === 'active') {
        const away = leftAt.current ? (Date.now() - leftAt.current) / 1000 : 0;
        leftAt.current = null;
        if (enabled && away >= RELOCK_AFTER_SECONDS) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => sub.remove();
  }, [enabled, unlock]);

  const covered = enabled && locked;
  return (
    <>
      {children}
      {covered ? (
        <View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 32,
            backgroundColor: colors.background,
          }}
        >
          <Ionicons name="lock-closed" size={48} color={colors.primaryText} />
          <T variant="title">Clubroof ist gesperrt</T>
          <Button label="Entsperren" icon="finger-print" onPress={() => void unlock()} />
        </View>
      ) : null}
    </>
  );
}
