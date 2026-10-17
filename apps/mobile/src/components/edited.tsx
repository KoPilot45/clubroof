import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { formatAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Button, Sheet, T } from './ui';

/** „bearbeitet · vor 2 Std.“ – kleine Spur unter nachträglich geänderten Inhalten (Paket BE). */
export function EditedNote({ at }: { at: string | null | undefined }) {
  const { colors } = useTheme();
  if (!at) return null;
  return (
    <T variant="caption" color={colors.anstoss.textTertiary} verbatim>
      {`${t('bearbeitet')} · ${t(formatAgo(at))}`}
    </T>
  );
}

/**
 * Ungespeicherte Änderungen beim Verlassen eines Bearbeiten-Formulars (Paket BE): Dialog „Speichern / Verwerfen /
 * Bleiben“. `allowLeave()` vor dem Zurückgehen nach erfolgreichem Speichern aufrufen. `guard` irgendwo im
 * Bildschirm rendern.
 */
export function useLeaveGuard(
  dirty: boolean,
  onSave: () => void,
): { guard: ReactNode; allowLeave: () => void } {
  const navigation = useNavigation();
  const [pending, setPending] = useState<{ action: unknown } | null>(null);
  const skip = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || skip.current) return;
        e.preventDefault();
        setPending({ action: e.data.action });
      }),
    [navigation, dirty],
  );
  const guard = (
    <Sheet visible={!!pending} onClose={() => setPending(null)} title="Änderungen speichern?">
      <T variant="caption">Du hast Änderungen vorgenommen, die noch nicht gespeichert sind.</T>
      <View style={{ gap: 8 }}>
        <Button
          label="Speichern"
          icon="checkmark"
          onPress={() => {
            setPending(null);
            onSave();
          }}
        />
        <Button
          label="Verwerfen"
          variant="danger"
          onPress={() => {
            skip.current = true;
            const action = pending?.action;
            setPending(null);
            if (action) navigation.dispatch(action as never);
          }}
        />
        <Button label="Bleiben" variant="outline" onPress={() => setPending(null)} />
      </View>
    </Sheet>
  );
  return {
    guard,
    allowLeave: () => {
      skip.current = true;
    },
  };
}
