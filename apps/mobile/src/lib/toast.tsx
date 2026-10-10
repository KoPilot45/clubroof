import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/app-text';
import { useTheme } from '@/lib/theme';

type Toast = { message: string; actionLabel?: string; onAction?: () => void };

const ToastContext = createContext<(toast: Toast) => void>(() => undefined);

/** Kurze Rückmeldung am unteren Rand, optional mit Aktion wie „Rückgängig“. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: Toast) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          // über der schwebenden Tab-Leiste (68 hoch, Abstand unten)
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom, 12) + 10 + 68 + 12,
            alignItems: 'center',
          }}
        >
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              width: '100%',
              maxWidth: 520,
              borderRadius: radii.xl,
              backgroundColor: colors.onSurface,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.status.success.solid,
              }}
            >
              <Ionicons name="checkmark" size={18} color={colors.status.success.onSolid} />
            </View>
            <Text style={{ flex: 1, color: colors.surface, fontWeight: '600' }}>
              {toast.message}
            </Text>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                onPress={() => {
                  const action = toast.onAction;
                  setToast(null);
                  action?.();
                }}
              >
                <Text style={{ color: colors.primaryContainer, fontWeight: '800' }}>
                  {toast.actionLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
