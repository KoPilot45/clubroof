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
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

const eventLabel = (e: { title: string; startsAt: string }) =>
  `${new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(e.startsAt))} · ${e.title}`;

export default function TasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
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
    onError: (e) => setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.'),
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
        {l.open.map((task) => (
          <TaskCard key={task.id} task={task}>
            {task.can.take
              ? mine.map((p) => (
                  <Button
                    key={p.id}
                    label={p.relation === 'child' ? `Übernimmt ${p.firstName}` : 'Ich übernehme'}
                    icon="hand-left-outline"
                    variant="tonal"
                    size="sm"
                    onPress={() =>
                      run.mutate({
                        path: `/tasks/${task.id}/take`,
                        method: 'POST',
                        body: { personId: p.id },
                      })
                    }
                  />
                ))
              : null}
            {task.can.complete ? (
              <Button
                label="Erledigt"
                icon="checkmark"
                variant={task.can.take ? 'outline' : 'tonal'}
                size="sm"
                onPress={() => run.mutate({ path: `/tasks/${task.id}/done`, method: 'POST' })}
              />
            ) : null}
            {task.can.manage && task.assignee ? (
              <Button
                label="Freigeben"
                variant="outline"
                size="sm"
                onPress={() =>
                  run.mutate({
                    path: `/tasks/${task.id}`,
                    method: 'PATCH',
                    body: { assigneePersonId: null },
                  })
                }
              />
            ) : null}
            {task.can.manage ? (
              <Button
                label="Löschen"
                icon="trash-outline"
                variant="danger"
                size="sm"
                onPress={() => run.mutate({ path: `/tasks/${task.id}`, method: 'DELETE' })}
              />
            ) : null}
          </TaskCard>
        ))}
      </Section>

      {l.done.length ? (
        <Section title="Erledigt">
          {l.done.map((task) => (
            <TaskCard key={task.id} task={task}>
              {task.can.manage ? (
                <Button
                  label="Wieder öffnen"
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    run.mutate({
                      path: `/tasks/${task.id}`,
                      method: 'PATCH',
                      body: { reopen: true },
                    })
                  }
                />
              ) : null}
            </TaskCard>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

function TaskCard({ task, children }: { task: TeamTask; children?: React.ReactNode }) {
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
          {task.title}
        </T>
        {task.doneAt ? (
          <Chip tone="success" icon="checkmark-circle" label="Erledigt" />
        ) : task.assignee ? (
          <Chip tone="info" icon="person" label={task.assignee.name} />
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
        {task.doneAt && task.assignee ? <Chip tone="neutral" label={task.assignee.name} /> : null}
      </View>
      {children ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{children}</View>
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
