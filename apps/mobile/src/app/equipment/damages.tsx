import type { DamageOverview, DamageStatus } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

const STATUS: Record<DamageStatus, { label: string; tone: 'urgent' | 'action' | 'success' }> = {
  open: { label: 'Offen', tone: 'urgent' },
  in_progress: { label: 'In Arbeit', tone: 'action' },
  done: { label: 'Erledigt', tone: 'success' },
};

export default function DamagesScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [facility, setFacility] = useState('none');
  const list = useQuery({ queryKey: ['damages'], queryFn: () => api<DamageOverview>('/damages') });
  const change = useMutation({
    mutationFn: (v: { path: string; method: 'POST' | 'PATCH'; body: unknown }) =>
      api<DamageOverview>(v.path, { method: v.method, body: v.body }),
    onSuccess: (data) => {
      queryClient.setQueryData(['damages'], data);
      setTitle('');
      setDescription('');
    },
  });
  if (list.isPending) return <Loading />;
  if (list.error) return <ErrorNotice error={list.error} onRetry={() => list.refetch()} />;
  const d = list.data;
  return (
    <Screen edges={[]} refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      <Card style={{ gap: 10 }}>
        <T variant="section">Schaden melden</T>
        <TextField
          label="Was ist kaputt?"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder={t('z. B. Tornetz gerissen')}
        />
        <ChoiceChips
          label="Wo?"
          options={[
            { value: 'none', label: 'Sonstiges' },
            ...d.facilities.map((f) => ({ value: f.id, label: f.name })),
          ]}
          selected={[facility]}
          onToggle={setFacility}
        />
        <TextField
          label="Details (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
          multiline
        />
        {change.error ? (
          <Chip
            tone="urgent"
            icon="alert-circle"
            label={change.error instanceof RequestError ? change.error.message : 'Nicht gesendet.'}
          />
        ) : null}
        <Button
          label="Melden"
          icon="send"
          loading={change.isPending}
          disabled={title.trim().length < 3}
          onPress={() =>
            change.mutate({
              path: '/damages',
              method: 'POST',
              body: {
                title: title.trim(),
                description: description.trim() || null,
                facilityId: facility === 'none' ? null : facility,
              },
            })
          }
        />
      </Card>
      <Section title={d.canManage ? 'Meldungen' : 'Bekannte Schäden'}>
        {d.reports.length === 0 ? (
          <Card>
            <Empty icon="checkmark-done-outline" text="Keine offenen Meldungen." />
          </Card>
        ) : null}
        {d.reports.map((r) => (
          <Card key={r.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
                {r.title}
              </T>
              <Chip tone={STATUS[r.status].tone} label={STATUS[r.status].label} />
            </View>
            {r.description ? <T variant="caption">{r.description}</T> : null}
            <T variant="caption">
              {[
                r.facility,
                r.mine ? 'von dir' : r.reportedBy ? `von ${r.reportedBy}` : null,
                formatAgo(r.createdAt),
              ]
                .filter(Boolean)
                .join(' · ')}
            </T>
            {r.resolution ? <T>{r.resolution}</T> : null}
            {d.canManage && r.status !== 'done' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {r.status === 'open' ? (
                  <Button
                    label="In Arbeit"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() =>
                      change.mutate({
                        path: `/damages/${r.id}`,
                        method: 'PATCH',
                        body: { status: 'in_progress' },
                      })
                    }
                  />
                ) : null}
                <Button
                  label="Erledigt"
                  icon="checkmark"
                  style={{ flex: 1 }}
                  onPress={() =>
                    change.mutate({
                      path: `/damages/${r.id}`,
                      method: 'PATCH',
                      body: { status: 'done' },
                    })
                  }
                />
              </View>
            ) : null}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
