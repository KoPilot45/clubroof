import type { HelperShift } from '@clubroof/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { RequestError } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Button, Chip, T } from './ui';

/** Eine Helferschicht mit Fortschritt und Ein-/Austragen (Mappe S. 14). */
export function ShiftRow({ shift, first }: { shift: HelperShift; first?: boolean }) {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: () =>
      api<HelperShift>(`/shifts/${shift.id}/signup`, { method: shift.mine ? 'DELETE' : 'PUT' }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['helpers'] });
      void queryClient.invalidateQueries({ queryKey: ['event'] });
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Das hat leider nicht geklappt.'),
  });
  const full = shift.filled >= shift.capacity;
  const share = Math.min(100, Math.round((shift.filled / shift.capacity) * 100));

  return (
    <View
      style={{
        gap: 8,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T variant="label" style={{ fontWeight: '700' }}>
            {shift.title}
          </T>
          <T variant="caption">
            {formatTime(shift.startsAt)} – {formatTime(shift.endsAt)} Uhr
          </T>
        </View>
        <T variant="label" color={full ? colors.status.success.onContainer : colors.onSurfaceMuted}>
          {shift.filled} / {shift.capacity} Helfer
        </T>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.surfaceVariant,
          overflow: 'hidden',
        }}
      >
        <View style={{ width: `${share}%`, height: '100%', backgroundColor: colors.primaryText }} />
      </View>
      {shift.helpers && shift.helpers.length > 0 ? (
        <T variant="caption">{shift.helpers.join(', ')}</T>
      ) : null}
      {shift.mine ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Chip tone="success" icon="checkmark" label="Du bist eingetragen" />
          <View style={{ flex: 1 }} />
          <Button
            label="Austragen"
            variant="outline"
            loading={toggle.isPending}
            onPress={() => toggle.mutate()}
          />
        </View>
      ) : full ? (
        <Chip tone="archived" label="Voll besetzt" />
      ) : (
        <Button
          label="Als Helfer eintragen"
          icon="hand-left-outline"
          loading={toggle.isPending}
          onPress={() => toggle.mutate()}
        />
      )}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
    </View>
  );
}
