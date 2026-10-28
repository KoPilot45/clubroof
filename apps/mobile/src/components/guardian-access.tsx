import type { GuardianAccess, MyGuardianAccess } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Notice, Section, T } from '@/components/ui';
import { ChoiceCard } from '@/components/wizard';
import { RequestError } from '@/lib/api';
import { ACCESS_LEVELS, accessTitle } from '@/lib/guardian-access';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

/** „Wer darf für mich mitsehen?“ – das Kind steuert den Zugang seiner Eltern (Paket KIND-EIGENER-ZUGANG). */
export function GuardianAccessCard() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const key = ['guardian-access'];
  const data = useQuery({
    queryKey: key,
    queryFn: () => api<MyGuardianAccess>('/me/guardian-access'),
  });
  const [error, setError] = useState<string | null>(null);
  const done = (next: MyGuardianAccess) => {
    setError(null);
    queryClient.setQueryData(key, next);
  };
  const fail = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : 'Die Änderung wurde nicht gespeichert.');
  const set = useMutation({
    mutationFn: (access: GuardianAccess) =>
      api<MyGuardianAccess>('/me/guardian-access', { method: 'PUT', body: { access } }),
    onSuccess: done,
    onError: fail,
  });
  const answer = useMutation({
    mutationFn: (approve: boolean) =>
      api<MyGuardianAccess>('/me/guardian-access/answer', { method: 'POST', body: { approve } }),
    onSuccess: done,
    onError: fail,
  });

  const first = data.data?.guardians[0];
  if (!first) return null;
  const names = data.data!.guardians.map((g) => g.name).join(' · ');
  const current = ACCESS_LEVELS.find((l) => l.value === first.access)!;

  return (
    <Section title="Wer darf für mich mitsehen?">
      <Card style={{ gap: 10 }}>
        <T variant="caption">{names}</T>
        <Chip tone="info" icon={current.icon} label={current.title} />
        <T>{current.child}</T>
      </Card>
      {first.requestedAccess ? (
        <Notice
          tone="action"
          icon="help-circle-outline"
          title="Deine Eltern fragen an"
          text={t(
            `Sie möchten wieder mitsehen: ${t(accessTitle(first.requestedAccess))}. Du entscheidest.`,
          )}
          action={{ label: 'Zustimmen', onPress: () => answer.mutate(true), icon: 'checkmark' }}
        />
      ) : null}
      {first.requestedAccess ? (
        <Button
          label="Ablehnen"
          variant="outline"
          loading={answer.isPending}
          onPress={() => answer.mutate(false)}
        />
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <View style={{ gap: 10, marginTop: 8 }}>
        {ACCESS_LEVELS.map((l) => (
          <ChoiceCard
            key={l.value}
            icon={l.icon}
            title={l.title}
            text={l.child}
            selected={first.access === l.value}
            onPress={() => first.access !== l.value && set.mutate(l.value)}
          />
        ))}
      </View>
      <T variant="caption" style={{ marginTop: 8 }}>
        Du kannst das jederzeit selbst ändern. Deine Eltern erfahren davon.
      </T>
    </Section>
  );
}
