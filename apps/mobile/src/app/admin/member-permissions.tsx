import { PERMISSIONS, PERMISSION_GROUPS, type MemberDetail, type Permission } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  Toggle,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { useToast } from '@/lib/toast';

/** Individuelle Rechte: Liste aller Rechte zum An- und Abwählen (zusätzlich zu den Rollen). */
export default function MemberPermissionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const toast = useToast();
  const member = useQuery({
    queryKey: ['admin', 'member', id],
    queryFn: () => api<MemberDetail>(`/admin/members/${id}`),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (member.data) setSelected(new Set(member.data.individualPermissions));
  }, [member.data]);

  const save = useMutation({
    mutationFn: () =>
      api<MemberDetail>(`/admin/members/${id}/permissions`, {
        method: 'PUT',
        body: { permissions: [...selected] },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'member', id], data);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });
      toast({ message: 'Individuelle Rechte gespeichert' });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Rechte konnten nicht gespeichert werden.',
      ),
  });

  if (member.isPending) return <Loading />;
  if (member.error) return <ErrorNotice error={member.error} onRetry={() => member.refetch()} />;
  const m = member.data;
  const before = new Set(m.individualPermissions);
  const changed = selected.size !== before.size || [...selected].some((p) => !before.has(p));

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 6 }}>
        <T variant="heading">{`${m.firstName} ${m.lastName}`}</T>
        <T variant="caption">
          Diese Rechte gelten zusätzlich zu den Rollen und immer für den ganzen Verein. Für ein
          Recht nur in einer Mannschaft oder einem Bereich lieber eine Rolle mit Geltungsbereich
          vergeben.
        </T>
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {PERMISSION_GROUPS.map((group) => (
        <Section key={group.title} title={group.title}>
          <Card>
            {group.keys.map((key: Permission, i) => (
              <ListRow
                key={key}
                first={i === 0}
                title={PERMISSIONS[key]}
                trailing={
                  <View>
                    <Toggle
                      label={PERMISSIONS[key]}
                      value={selected.has(key)}
                      onChange={(on) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(key);
                          else next.delete(key);
                          return next;
                        })
                      }
                    />
                  </View>
                }
              />
            ))}
          </Card>
        </Section>
      ))}
      <Button
        label="Speichern"
        icon="checkmark"
        disabled={!changed}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
