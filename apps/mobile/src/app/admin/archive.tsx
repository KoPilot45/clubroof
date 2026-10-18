import {
  ARCHIVE_KIND_LABEL,
  type ArchiveEntry,
  type ArchiveKind,
  type ArchiveOverview,
  type PurgeArchiveResult,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { EditSheet } from '@/components/edit-sheet';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useConfirmDelete } from '@/lib/confirm';
import { formatDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

/** Das Archiv als Datei speichern (Datenübergabe); im Browser, in der App steht der Export in der Web-Verwaltung. */
function saveJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Archiv (Paket AR): gelöschte Einträge ansehen, wiederherstellen und – nur auf Anstoß – endgültig löschen.
 * Fristen sind die Standardfristen des Betreibers; automatisch wird nie gelöscht.
 */
export default function ArchiveScreen() {
  const { api } = useSignedIn();
  const confirmDelete = useConfirmDelete();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ArchiveKind | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<ArchiveEntry | null>(null);
  const data = useQuery({ queryKey: ['archive'], queryFn: () => api<ArchiveOverview>('/archive') });

  const done = (d: ArchiveOverview) => {
    setError(null);
    queryClient.setQueryData(['archive'], d);
    for (const key of ['wiki', 'exercises'])
      void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const restore = useMutation({
    mutationFn: (v: { id: string; newName?: string }) =>
      api<ArchiveOverview>(`/archive/${v.id}/restore`, {
        method: 'POST',
        body: v.newName ? { newName: v.newName } : {},
      }),
    onSuccess: (d) => {
      setMessage('Wiederhergestellt.');
      done(d);
    },
    onError: (e, v) => {
      // Name inzwischen vergeben: nachfragen statt selbst umzubenennen
      if (e instanceof RequestError && e.code === 'name_conflict') {
        setRenaming(data.data?.entries.find((x) => x.id === v.id) ?? null);
        setError(null);
      } else fail(e);
    },
  });
  const purgeOne = useMutation({
    mutationFn: (id: string) => api<ArchiveOverview>(`/archive/${id}`, { method: 'DELETE' }),
    onSuccess: (d) => {
      setMessage(null);
      done(d);
    },
    onError: fail,
  });
  const purge = useMutation({
    mutationFn: (mode: 'due' | 'all') =>
      api<PurgeArchiveResult>('/archive/purge', {
        method: 'POST',
        body: { mode, ...(filter === 'all' ? {} : { kind: filter }) },
      }),
    onSuccess: (r) => {
      setMessage(
        r.kept > 0
          ? `${r.deleted} Einträge endgültig gelöscht, ${r.kept} bleiben wegen laufender Aufbewahrungsfrist.`
          : `${r.deleted} Einträge endgültig gelöscht.`,
      );
      done(r.overview);
    },
    onError: fail,
  });
  const exportAll = useMutation({
    mutationFn: () => api<unknown>('/archive/export'),
    onSuccess: (d) => saveJson('clubroof-archiv.json', d),
    onError: fail,
  });

  if (data.isPending) return <Loading />;
  if (data.error || !data.data)
    return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const d = data.data;
  const shown = d.entries.filter((e) => filter === 'all' || e.kind === filter);
  const due = d.kinds
    .filter((k) => filter === 'all' || k.kind === filter)
    .reduce((sum, k) => sum + k.due, 0);
  const canPurge = d.entries.some((e) => e.canPurge);
  const years =
    filter === 'all' ? Math.min(...Object.values(d.retentionYears)) : d.retentionYears[filter];

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      <T variant="caption">
        Gelöschte Einträge liegen hier und lassen sich wiederherstellen. Endgültig gelöscht wird nie
        automatisch, sondern nur auf deinen Anstoß.
      </T>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {message ? <Chip tone="success" icon="checkmark-circle" label={message} /> : null}
      <ChoiceChips
        options={[
          { value: 'all' as const, label: 'Alle' },
          ...d.kinds.map((k) => ({
            value: k.kind,
            label: `${t(ARCHIVE_KIND_LABEL[k.kind])} (${k.count})`,
          })),
        ]}
        selected={[filter]}
        onToggle={setFilter}
      />
      {due > 0 && canPurge ? (
        <Card style={{ gap: 8 }}>
          <Chip
            tone="action"
            icon="time"
            label={t(`${due} archivierte Einträge älter als ${years} Jahre`)}
          />
          <Button
            label="Bereinigen"
            icon="trash-bin-outline"
            variant="outline"
            loading={purge.isPending}
            onPress={() =>
              confirmDelete({
                title: 'Bereinigen?',
                confirmLabel: 'Bereinigen',
                name: String(due),
                text: t(
                  `${due} Einträge werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.`,
                ),
                onConfirm: () => purge.mutateAsync('due'),
              })
            }
          />
        </Card>
      ) : null}
      <Section title="Archivierte Einträge">
        <Card>
          {shown.length === 0 ? <Empty icon="archive-outline" text="Das Archiv ist leer." /> : null}
          {shown.map((e, i) => (
            <View key={e.id}>
              <ListRow
                first={i === 0}
                title={e.label}
                subtitle={[
                  t(ARCHIVE_KIND_LABEL[e.kind]),
                  e.detail,
                  `${t('archiviert')} ${formatDay(e.archivedAt)}`,
                  e.archivedBy,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10, flexWrap: 'wrap' }}>
                {e.canRestore ? (
                  <Button
                    label="Wiederherstellen"
                    icon="arrow-undo"
                    size="sm"
                    variant="tonal"
                    loading={restore.isPending && restore.variables?.id === e.id}
                    onPress={() => restore.mutate({ id: e.id })}
                  />
                ) : null}
                {e.canPurge ? (
                  <Button
                    label="Endgültig löschen"
                    icon="trash-outline"
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      confirmDelete({
                        name: e.label,
                        text: t(
                          `„${e.label}“ wird endgültig gelöscht. Das lässt sich nicht rückgängig machen.`,
                        ),
                        onConfirm: () => purgeOne.mutateAsync(e.id),
                      })
                    }
                  />
                ) : null}
                {e.lockedUntil ? (
                  <Chip
                    tone="info"
                    icon="lock-closed"
                    label={`${t('Aufbewahrung bis')} ${formatDay(e.lockedUntil)}`}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      </Section>
      <Section title="Datenübergabe und Leeren">
        <Card style={{ gap: 10 }}>
          {Platform.OS === 'web' ? (
            <Button
              label="Archiv exportieren"
              icon="download-outline"
              variant="outline"
              loading={exportAll.isPending}
              onPress={() => exportAll.mutate()}
            />
          ) : (
            <T variant="caption">Der Export des Archivs steht in der Web-Verwaltung bereit.</T>
          )}
          {canPurge && shown.length > 0 ? (
            <Button
              label="Archiv leeren"
              icon="trash-bin-outline"
              variant="danger"
              loading={purge.isPending}
              onPress={() =>
                confirmDelete({
                  title: 'Archiv leeren?',
                  confirmLabel: 'Archiv leeren',
                  name: String(shown.length),
                  text: t(
                    `Alle ${shown.length} archivierten Einträge werden endgültig gelöscht (Einträge mit laufender Aufbewahrungsfrist bleiben). Das lässt sich nicht rückgängig machen.`,
                  ),
                  onConfirm: () => purge.mutateAsync('all'),
                })
              }
            />
          ) : null}
        </Card>
      </Section>
      <EditSheet
        visible={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Neuer Name"
        fields={[
          {
            key: 'name',
            label: 'Der Name ist inzwischen vergeben. Neuer Name',
            value: renaming?.label ?? '',
            maxLength: 120,
          },
        ]}
        onSave={async (v) => {
          const next = await api<ArchiveOverview>(`/archive/${renaming!.id}/restore`, {
            method: 'POST',
            body: { newName: v.name!.trim() },
          });
          setMessage('Wiederhergestellt.');
          done(next);
        }}
      />
    </Screen>
  );
}
