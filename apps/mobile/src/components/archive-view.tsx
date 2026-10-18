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
import { Cell, DataTable } from '@/components/data-table';
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
import { useIsDesktop } from '@/lib/layout';
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
export function ArchiveView({ teamId }: { teamId?: string }) {
  const { api } = useSignedIn();
  const confirmDelete = useConfirmDelete();
  const queryClient = useQueryClient();
  const desktop = useIsDesktop();
  const [filter, setFilter] = useState<ArchiveKind | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<ArchiveEntry | null>(null);
  const scope = teamId ? '?teamId=' + teamId : '';
  const key = ['archive', teamId ?? 'club'];
  const data = useQuery({
    queryKey: key,
    queryFn: () => api<ArchiveOverview>(`/archive${scope}`),
  });

  const done = (d: ArchiveOverview) => {
    setError(null);
    queryClient.setQueryData(key, d);
    for (const k of ['wiki', 'exercises', 'tasks', 'equipment', 'sponsors', 'team'])
      void queryClient.invalidateQueries({ queryKey: [k] });
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
        body: {
          mode,
          ...(filter === 'all' ? {} : { kind: filter }),
          ...(teamId ? { teamId } : {}),
        },
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
    mutationFn: () => api<unknown>(`/archive/export${scope}`),
    onSuccess: (d) => saveJson('clubroof-archiv.json', d),
    onError: fail,
  });

  // Sammelaktionen der Tabelle (Desktop): nacheinander, damit Namenskonflikte einzeln gemeldet werden können
  const bulkRestore = async (rows: ArchiveEntry[]) => {
    let ok = 0;
    let conflicts = 0;
    for (const e of rows) {
      try {
        await api<ArchiveOverview>(`/archive/${e.id}/restore`, { method: 'POST', body: {} });
        ok++;
      } catch (err) {
        if (err instanceof RequestError && err.code === 'name_conflict') conflicts++;
        else setError(err instanceof RequestError ? err.message : t('Das hat nicht geklappt.'));
      }
    }
    setMessage(
      conflicts > 0
        ? t(
            `${ok} wiederhergestellt, ${conflicts} brauchen einen neuen Namen (einzeln wiederherstellen).`,
          )
        : t(`${ok} wiederhergestellt.`),
    );
    await queryClient.invalidateQueries({ queryKey: key });
    for (const k of ['wiki', 'exercises', 'tasks', 'equipment', 'sponsors', 'team'])
      void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const bulkPurge = async (rows: ArchiveEntry[]) => {
    for (const e of rows) {
      try {
        await api<ArchiveOverview>(`/archive/${e.id}`, { method: 'DELETE' });
      } catch (err) {
        setError(err instanceof RequestError ? err.message : t('Das hat nicht geklappt.'));
      }
    }
    setMessage(t(`${rows.length} Einträge endgültig gelöscht.`));
    await queryClient.invalidateQueries({ queryKey: key });
  };

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
        {desktop && shown.length > 0 ? (
          <DataTable
            rows={shown}
            rowKey={(e) => e.id}
            exportName="archiv"
            defaultSort={{ key: 'at', dir: 'desc' }}
            bulkActions={[
              {
                label: 'Wiederherstellen',
                icon: 'arrow-undo',
                onPress: (rows) => void bulkRestore(rows.filter((e) => e.canRestore)),
              },
              {
                label: 'Endgültig löschen',
                icon: 'trash-outline',
                onPress: (rows) => {
                  const doomed = rows.filter((e) => e.canPurge);
                  if (doomed.length === 0) return;
                  confirmDelete({
                    title: 'Endgültig löschen?',
                    confirmLabel: 'Endgültig löschen',
                    name: String(doomed.length),
                    text: t(
                      `${doomed.length} Einträge werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.`,
                    ),
                    onConfirm: () => bulkPurge(doomed),
                  });
                },
              },
            ]}
            columns={[
              {
                key: 'label',
                label: 'Name',
                flex: 2,
                sort: (a, b) => a.label.localeCompare(b.label),
                csv: (e) => e.label,
                render: (e) => <Cell>{e.label}</Cell>,
              },
              {
                key: 'kind',
                label: 'Art',
                width: 150,
                sort: (a, b) => a.kind.localeCompare(b.kind),
                csv: (e) => ARCHIVE_KIND_LABEL[e.kind],
                render: (e) => <Cell muted>{t(ARCHIVE_KIND_LABEL[e.kind])}</Cell>,
              },
              {
                key: 'team',
                label: 'Mannschaft',
                width: 130,
                sort: (a, b) => (a.teamName ?? '').localeCompare(b.teamName ?? ''),
                csv: (e) => e.teamName ?? '',
                render: (e) => <Cell muted>{e.teamName ?? '–'}</Cell>,
              },
              {
                key: 'at',
                label: 'Archiviert',
                width: 120,
                sort: (a, b) => a.archivedAt.localeCompare(b.archivedAt),
                csv: (e) => e.archivedAt,
                render: (e) => <Cell muted>{formatDay(e.archivedAt)}</Cell>,
              },
              {
                key: 'by',
                label: 'Von',
                width: 150,
                csv: (e) => e.archivedBy ?? '',
                render: (e) => <Cell muted>{e.archivedBy ?? '–'}</Cell>,
              },
              {
                key: 'status',
                label: 'Aufbewahrung',
                width: 170,
                sort: (a, b) => (a.lockedUntil ?? '').localeCompare(b.lockedUntil ?? ''),
                csv: (e) => e.lockedUntil ?? '',
                render: (e) =>
                  e.lockedUntil ? (
                    <Chip
                      tone="info"
                      icon="lock-closed"
                      label={`${t('bis')} ${formatDay(e.lockedUntil)}`}
                    />
                  ) : (
                    <Cell muted>–</Cell>
                  ),
              },
            ]}
          />
        ) : (
          <Card>
            {shown.length === 0 ? (
              <Empty icon="archive-outline" text="Das Archiv ist leer." />
            ) : null}
            {shown.map((e, i) => (
              <View key={e.id}>
                <ListRow
                  first={i === 0}
                  title={e.label}
                  subtitle={[
                    t(ARCHIVE_KIND_LABEL[e.kind]),
                    e.teamName,
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
        )}
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
