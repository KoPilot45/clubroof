import type { CreateTeamTaskInput, TeamTask, TeamTaskList } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  Loading,
  MoreMenu,
  Screen,
  Section,
  T,
  TextField,
  type IconName,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import { useConfirmDelete } from '@/lib/confirm';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { dateFormat } from '@/lib/i18n';

const eventLabel = (e: { title: string; startsAt: string }) =>
  `${dateFormat({ weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(e.startsAt))} · ${e.title}`;

export default function TasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const key = ['tasks', id];
  const list = useQuery({ queryKey: key, queryFn: () => api<TeamTaskList>(`/teams/${id}/tasks`) });
  const run = useMutation({
    mutationFn: (v: { path: string; method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }) =>
      api<TeamTaskList>(v.path, { method: v.method, body: v.body }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(key, data);
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    },
    onError: (e) => {
      setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
    },
  });

  // Personen, über die ich zur Mannschaft gehöre (ich selbst oder meine Kinder)
  const mine = [...new Set(me.teams.filter((t) => t.id === id).map((t) => t.personId))].map((pid) =>
    me.managedPersons.find((p) => p.id === pid)!,
  );

  if (list.isPending) return <Loading />;
  if (list.error) return <ErrorNotice error={list.error} onRetry={() => list.refetch()} />;
  const l = list.data;

  return (
    <Screen edges={[]} refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {l.canManage ? (
        creating ? (
          <NewTask
            list={l}
            busy={run.isPending}
            onCancel={() => setCreating(false)}
            onSave={(body) =>
              run.mutate(
                { path: `/teams/${id}/tasks`, method: 'POST', body },
                { onSuccess: () => setCreating(false) },
              )
            }
          />
        ) : (
          <Button label="Aufgabe anlegen" icon="add" onPress={() => setCreating(true)} />
        )
      ) : null}

      <Section title={`Offen (${l.open.length})`}>
        {l.open.length === 0 ? (
          <Card>
            <Empty icon="checkmark-done-outline" text="Keine offenen Aufgaben." />
          </Card>
        ) : null}
        {l.open.map((task) => {
          const take = task.can.take
            ? mine.map((p) => ({
                label: p.relation === 'child' ? `Übernimmt ${p.firstName}` : 'Ich übernehme',
                run: () =>
                  run.mutate({
                    path: `/tasks/${task.id}/take`,
                    method: 'POST',
                    body: { personId: p.id },
                  }),
              }))
            : [];
          const complete = task.can.complete
            ? () => run.mutate({ path: `/tasks/${task.id}/done`, method: 'POST' })
            : null;
          // Ein Hauptknopf: Übernehmen, sonst Erledigt; alles Weitere im „…“-Menü
          const main = take[0]
            ? { label: take[0].label, icon: 'hand-left-outline' as const, run: take[0].run }
            : complete
              ? { label: 'Erledigt', icon: 'checkmark' as const, run: complete }
              : null;
          const menu = [
            ...take.slice(1).map((x) => ({
              label: x.label,
              icon: 'hand-left-outline' as const,
              onPress: x.run,
            })),
            ...(take[0] && complete
              ? [{ label: 'Als erledigt markieren', icon: 'checkmark' as const, onPress: complete }]
              : []),
            ...(task.can.manage && task.assignee
              ? [
                  {
                    label: 'Freigeben',
                    icon: 'swap-horizontal-outline' as const,
                    onPress: () =>
                      run.mutate({
                        path: `/tasks/${task.id}`,
                        method: 'PATCH',
                        body: { assigneePersonId: null },
                      }),
                  },
                ]
              : []),
            ...(task.can.manage
              ? [
                  {
                    label: 'Löschen',
                    icon: 'trash-outline' as const,
                    danger: true,
                    onPress: () =>
                      confirmDelete({
                        name: task.title,
                        onConfirm: () =>
                          run.mutate({ path: `/tasks/${task.id}`, method: 'DELETE' }),
                      }),
                  },
                ]
              : []),
          ];
          return (
            <TaskCard key={task.id} task={task} main={main} menu={menu} busy={run.isPending} />
          );
        })}
      </Section>

      {l.done.length ? (
        <Section title="Erledigt">
          {l.done.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              busy={run.isPending}
              main={
                task.can.manage
                  ? {
                      label: 'Wieder öffnen',
                      icon: 'checkmark-circle-outline',
                      neutral: true,
                      run: () =>
                        run.mutate({
                          path: `/tasks/${task.id}`,
                          method: 'PATCH',
                          body: { reopen: true },
                        }),
                    }
                  : null
              }
              menu={
                task.can.manage
                  ? [
                      {
                        label: 'Löschen',
                        icon: 'trash-outline',
                        danger: true,
                        onPress: () =>
                          confirmDelete({
                            name: task.title,
                            onConfirm: () =>
                              run.mutate({ path: `/tasks/${task.id}`, method: 'DELETE' }),
                          }),
                      },
                    ]
                  : []
              }
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

function TaskCard({
  task,
  main,
  menu,
  busy,
}: {
  task: TeamTask;
  main: { label: string; icon: IconName; run: () => void; neutral?: boolean } | null;
  menu?: { label: string; icon: IconName; onPress: () => void; danger?: boolean }[];
  busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 10, opacity: task.doneAt ? 0.85 : 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T
          variant="label"
          color={task.doneAt ? colors.anstoss.textTertiary : undefined}
          style={{ fontWeight: '700', fontSize: 15, flex: 1 }}
        >
          {task.title}
        </T>
        {task.doneAt ? (
          task.assignee ? (
            <Chip tone="neutral" label={task.assignee.name} />
          ) : (
            <Chip tone="success" icon="checkmark-circle" label="Erledigt" />
          )
        ) : task.assignee ? (
          <Chip tone="neutral" label={task.assignee.name} />
        ) : (
          <Chip tone="action" label="Freiwillige gesucht" />
        )}
      </View>
      {task.note ? <T variant="caption">{task.note}</T> : null}
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {task.dueOn ? (
          <Chip tone="neutral" icon="time-outline" label={`bis ${formatShortDate(task.dueOn)}`} />
        ) : null}
        {task.event ? (
          <Chip tone="neutral" icon="calendar-outline" label={eventLabel(task.event)} />
        ) : null}
      </View>
      {main || (menu && menu.length > 0) ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {main ? (
            <Button
              style={{ flex: 1 }}
              label={main.label}
              icon={main.icon}
              variant={main.neutral ? 'neutral' : 'primary'}
              disabled={busy}
              onPress={main.run}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <MoreMenu title={task.title} actions={menu ?? []} />
        </View>
      ) : null}
    </Card>
  );
}

const SUGGESTIONS = ['Fahrdienst', 'Trikots waschen', 'Kuchen backen', 'Getränke mitbringen'];

function NewTask({
  list,
  busy,
  onSave,
  onCancel,
}: {
  list: TeamTaskList;
  busy: boolean;
  onSave: (body: CreateTeamTaskInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string>('none');
  const [assignee, setAssignee] = useState<string>('open');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card style={{ gap: 12 }}>
      <T variant="section">Neue Aufgabe</T>
      <ChoiceChips
        options={SUGGESTIONS.map((s) => ({ value: s, label: s }))}
        selected={[title]}
        onToggle={setTitle}
      />
      <TextField label="Aufgabe" value={title} onChangeText={setTitle} maxLength={100} />
      <TextField
        label="Hinweis (optional)"
        value={note}
        onChangeText={setNote}
        maxLength={500}
        multiline
      />
      {due ? (
        <>
          <DateStepper label="Fällig am" value={due} min={today} onChange={setDue} />
          <Button label="Ohne Fälligkeit" variant="outline" onPress={() => setDue(null)} />
        </>
      ) : (
        <Button
          label="Fälligkeit festlegen"
          variant="outline"
          icon="time-outline"
          onPress={() => setDue(today)}
        />
      )}
      {list.events.length ? (
        <ChoiceChips
          label="Zu einem Termin (optional)"
          options={[
            { value: 'none', label: 'Kein Termin' },
            ...list.events.slice(0, 8).map((e) => ({ value: e.id, label: eventLabel(e) })),
          ]}
          selected={[eventId]}
          onToggle={setEventId}
        />
      ) : null}
      <ChoiceChips
        label="Wer übernimmt?"
        options={[
          { value: 'open', label: 'Freiwillige gesucht' },
          ...list.members.map((m) => ({ value: m.personId, label: m.name })),
        ]}
        selected={[assignee]}
        onToggle={setAssignee}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Abbrechen" variant="outline" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label="Anlegen"
          icon="checkmark"
          style={{ flex: 1 }}
          loading={busy}
          disabled={title.trim().length < 2}
          onPress={() =>
            onSave({
              title: title.trim(),
              note: note.trim() || null,
              dueOn: due,
              eventId: eventId === 'none' ? null : eventId,
              assigneePersonId: assignee === 'open' ? null : assignee,
            })
          }
        />
      </View>
    </Card>
  );
}
