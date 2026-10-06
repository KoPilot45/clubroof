import { PERMISSIONS, type MemberListItem, type RoleCatalog, type ScopeType } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
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
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

const key = (sc: { type: ScopeType; id: string | null }) => `${sc.type}:${sc.id ?? ''}`;

/** Eine Rolle mit allen Personen: durchsuchen, entziehen und neue Personen hinzufügen. */
export default function RoleScreen() {
  const { key: roleKey, add } = useLocalSearchParams<{ key: string; add?: string }>();
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(add === '1');
  const [rights, setRights] = useState(false);
  const catalog = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api<RoleCatalog>('/admin/roles'),
  });
  const revoke = useMutation({
    mutationFn: (v: { personId: string; assignmentId: string }) =>
      api(`/admin/members/${v.personId}/roles/${v.assignmentId}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
  if (catalog.isPending) return <Loading />;
  if (catalog.error) return <ErrorNotice error={catalog.error} onRetry={() => catalog.refetch()} />;
  const role = catalog.data.roles.find((r) => r.key === roleKey);
  if (!role) return <ErrorNotice message="Diese Rolle gibt es nicht." />;
  const manage = me.admin.manageRoles;
  const q = filter.trim().toLowerCase();
  const holders = role.holders.filter(
    (h) => !q || h.name.toLowerCase().includes(q) || h.scopeLabel.toLowerCase().includes(q),
  );

  return (
    <Screen edges={[]} refreshing={catalog.isRefetching} onRefresh={() => catalog.refetch()}>
      <Stack.Screen options={{ title: role.name }} />
      <Card style={{ gap: 8 }}>
        {role.description ? <T variant="caption">{role.description}</T> : null}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip tone="neutral" label={`${role.permissions.length} Rechte`} />
          <Chip
            tone="neutral"
            icon="people"
            label={`${role.holders.length} ${role.holders.length === 1 ? 'Person' : 'Personen'}`}
          />
        </View>
        <Button
          label={rights ? 'Rechte ausblenden' : 'Enthaltene Rechte anzeigen'}
          variant="outline"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => setRights(!rights)}
        />
        {rights
          ? role.permissions.map((p) => (
              <T key={p} variant="caption">
                • {PERMISSIONS[p as keyof typeof PERMISSIONS] ?? p}
              </T>
            ))
          : null}
      </Card>

      {manage ? (
        adding ? (
          <AddHolder
            role={role}
            catalog={catalog.data}
            onDone={() => setAdding(false)}
            onAdded={() => void queryClient.invalidateQueries({ queryKey: ['admin'] })}
          />
        ) : (
          <Button
            label={`${role.name} hinzufügen`}
            icon="person-add-outline"
            onPress={() => setAdding(true)}
          />
        )
      ) : null}

      <Section title={`${role.name} (${role.holders.length})`}>
        {role.holders.length > 6 ? (
          <TextField
            label="Suchen"
            value={filter}
            onChangeText={setFilter}
            placeholder="Name oder Bereich …"
          />
        ) : null}
        <Card>
          {holders.length === 0 ? (
            <Empty
              icon="people-outline"
              text={role.holders.length ? 'Niemand gefunden.' : 'Noch niemand.'}
            />
          ) : null}
          {holders.map((h, i) => (
            <ListRow
              key={h.assignmentId}
              first={i === 0}
              title={h.name}
              subtitle={h.scopeLabel}
              onPress={() => router.push(`/admin/member/${h.personId}`)}
              trailing={
                manage ? (
                  <Button
                    label="Entziehen"
                    size="sm"
                    variant="danger"
                    loading={revoke.isPending && revoke.variables?.assignmentId === h.assignmentId}
                    onPress={() => revoke.mutate(h)}
                  />
                ) : null
              }
            />
          ))}
        </Card>
        {revoke.error ? (
          <Chip
            tone="urgent"
            icon="alert-circle"
            label={
              revoke.error instanceof RequestError
                ? revoke.error.message
                : 'Das hat nicht geklappt.'
            }
          />
        ) : null}
      </Section>
    </Screen>
  );
}

/** Person suchen, Geltungsbereich wählen, Rolle vergeben. */
function AddHolder({
  role,
  catalog,
  onDone,
  onAdded,
}: {
  role: RoleCatalog['roles'][number];
  catalog: RoleCatalog;
  onDone: () => void;
  onAdded: () => void;
}) {
  const { api } = useSignedIn();
  const [q, setQ] = useState('');
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const term = q.trim();
  const found = useQuery({
    queryKey: ['admin', 'members', 'search', term],
    queryFn: () =>
      api<MemberListItem[]>(`/admin/members?status=active&q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2 && !person,
  });
  const scopes = catalog.scopes.filter(
    (sc) =>
      (sc.type === 'club' && role.key !== 'coach') ||
      (role.key !== 'fulladmin' && sc.type === role.defaultScope),
  );
  const chosen =
    scopes.find((sc) => key(sc) === scope) ?? (scopes.length === 1 ? scopes[0] : undefined);
  const assign = useMutation({
    mutationFn: () =>
      api(`/admin/members/${person!.id}/roles`, {
        method: 'POST',
        body: { roleKey: role.key, scopeType: chosen!.type, scopeId: chosen!.id },
      }),
    onSuccess: () => {
      onAdded();
      setPerson(null);
      setQ('');
      setScope(null);
    },
  });
  return (
    <Card style={{ gap: 12 }}>
      <T variant="section">{role.name} hinzufügen</T>
      {person ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip tone="primary" icon="person" label={person.name} />
          <Button
            label="Andere Person"
            size="sm"
            variant="outline"
            onPress={() => setPerson(null)}
          />
        </View>
      ) : (
        <>
          <TextField
            label="Person suchen"
            value={q}
            onChangeText={setQ}
            placeholder="Name oder Mitgliedsnummer (mind. 2 Zeichen)"
          />
          {found.isFetching ? <Loading /> : null}
          {found.data?.length === 0 ? <T variant="caption">Niemand gefunden.</T> : null}
          {found.data?.slice(0, 8).map((m, i) => (
            <ListRow
              key={m.id}
              first={i === 0}
              title={`${m.firstName} ${m.lastName}`}
              subtitle={
                [
                  m.memberNumber ? `Nr. ${m.memberNumber}` : null,
                  m.teams.map((t) => t.badge).join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
              onPress={() => setPerson({ id: m.id, name: `${m.firstName} ${m.lastName}` })}
            />
          ))}
        </>
      )}
      {scopes.length > 1 ? (
        <ChoiceChips
          label="Gilt für"
          options={scopes.map((sc) => ({ value: key(sc), label: sc.label }))}
          selected={chosen ? [key(chosen)] : []}
          onToggle={setScope}
        />
      ) : null}
      {assign.error ? (
        <Chip
          tone="urgent"
          icon="alert-circle"
          label={
            assign.error instanceof RequestError ? assign.error.message : 'Das hat nicht geklappt.'
          }
        />
      ) : null}
      {assign.isSuccess && !person ? (
        <Chip tone="success" icon="checkmark" label="Hinzugefügt – weitere Person möglich" />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Fertig" variant="outline" style={{ flex: 1 }} onPress={onDone} />
        <Button
          label="Hinzufügen"
          icon="checkmark"
          style={{ flex: 1 }}
          disabled={!person || !chosen}
          loading={assign.isPending}
          onPress={() => assign.mutate()}
        />
      </View>
    </Card>
  );
}
