import type { MemberListItem, RoleCatalog } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  SearchField,
  Sheet,
  T,
} from '@/components/ui';
import { Cell, DataTable } from '@/components/data-table';
import { useIsDesktop } from '@/lib/layout';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

type Filter = 'active' | 'inactive' | 'left' | 'withoutTeam' | 'all';
/** Rollenübersicht: `role:<Schlüssel>` für eine Rolle, sonst eine der festen Auswahlen */
type RoleFilter = string;

export default function MembersScreen() {
  const { api } = useSignedIn();
  const desktop = useIsDesktop();
  const params = useLocalSearchParams<{ withoutTeam?: string }>();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>(params.withoutTeam ? 'withoutTeam' : 'active');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const catalog = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api<RoleCatalog>('/admin/roles'),
  });
  const query = new URLSearchParams();
  if (filter === 'withoutTeam') {
    query.set('withoutTeam', 'true');
    query.set('status', 'active');
  } else if (filter !== 'all') query.set('status', filter);
  if (roleFilter === 'any') query.set('roleKey', 'any');
  else if (roleFilter === 'individual') query.set('roleKey', 'individual');
  else if (roleFilter === 'coaches') query.set('teamFunction', 'coaches');
  else if (roleFilter === 'noaccount') query.set('account', 'no');
  else if (roleFilter.startsWith('role:')) query.set('roleKey', roleFilter.slice(5));
  const members = useQuery({
    queryKey: ['admin', 'members', filter, roleFilter],
    queryFn: () => api<MemberListItem[]>(`/admin/members?${query.toString()}`),
  });
  const needle = q.trim().toLowerCase();
  const list = (members.data ?? []).filter(
    (m) =>
      !needle ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(needle) ||
      `${m.lastName} ${m.firstName}`.toLowerCase().includes(needle) ||
      (m.memberNumber ?? '').includes(needle),
  );

  // Rollen im Filterfenster nach Häufigkeit: „Alle“ zuerst, dann die häufigsten, besondere Auswahlen zuletzt
  const roleOptions: { value: RoleFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'Alle' },
    ...(catalog.data?.roles
      .filter((r) => r.holders.length > 0)
      .sort((a, b) => b.holders.length - a.holders.length)
      .map((r) => ({ value: `role:${r.key}`, label: r.name, count: r.holders.length })) ?? []),
    { value: 'any', label: 'Alle Rollenträger' },
    { value: 'coaches', label: 'Trainer und Co-Trainer' },
    { value: 'individual', label: 'Individuelle Rechte' },
    { value: 'noaccount', label: 'Ohne App-Zugang' },
  ];
  const activeFilters =
    (filter !== 'active' ? 1 : 0) + (roleFilter !== 'all' ? 1 : 0) + (needle ? 1 : 0);
  const roleLabel = roleOptions.find((o) => o.value === roleFilter)?.label;
  const reset = () => {
    setQ('');
    setFilter('active');
    setRoleFilter('all');
  };

  return (
    <Screen edges={[]} refreshing={members.isRefetching} onRefresh={() => members.refetch()}>
      <View style={{ gap: 12 }}>
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Name oder Nummer"
          filterCount={activeFilters}
          onFilter={() => setFilterOpen(true)}
        />
        <ChoiceChips
          scroll
          options={[
            { value: 'active', label: 'Aktiv' },
            { value: 'inactive', label: 'Passiv' },
            { value: 'withoutTeam', label: 'Ohne Mannschaft' },
            { value: 'left', label: 'Ausgetreten' },
            { value: 'all', label: 'Alle' },
          ]}
          selected={[filter]}
          onToggle={setFilter}
        />
        {activeFilters > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {roleFilter !== 'all' ? <Chip tone="primary" label={roleLabel ?? ''} /> : null}
            <Button label="Zurücksetzen" variant="neutral" size="sm" onPress={reset} />
          </View>
        ) : null}
      </View>
      <Sheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t('Rollen und Aufgaben')}
      >
        <ChoiceChips
          options={roleOptions.map((o) => ({
            value: o.value,
            label: o.count ? `${o.label} (${o.count})` : o.label,
          }))}
          selected={[roleFilter]}
          onToggle={(v) => {
            setRoleFilter(v);
            setFilterOpen(false);
          }}
        />
        {roleFilter !== 'all' ? (
          <Button
            label="Zurücksetzen"
            variant="neutral"
            onPress={() => {
              setRoleFilter('all');
              setFilterOpen(false);
            }}
          />
        ) : null}
      </Sheet>
      {members.isPending ? <Loading /> : null}
      {members.error ? (
        <ErrorNotice error={members.error} onRetry={() => members.refetch()} />
      ) : null}
      {members.data ? (
        <T variant="caption">
          {list.length} {list.length === 1 ? 'Person' : 'Personen'}
        </T>
      ) : null}
      {members.data && list.length === 0 ? (
        <Empty icon="people-outline" text="Keine passenden Mitglieder." />
      ) : null}
      {list.length && desktop ? (
        <DataTable
          rows={list}
          rowKey={(m) => m.id}
          exportName="mitglieder"
          onRowPress={(m) => router.push(`/admin/member/${m.id}`)}
          defaultSort={{ key: 'name', dir: 'asc' }}
          selectable
          columns={[
            {
              key: 'name',
              label: 'Name',
              flex: 2,
              sort: (a, b) =>
                `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
              csv: (m) => `${m.lastName}, ${m.firstName}`,
              render: (m) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={`${m.firstName} ${m.lastName}`} size={32} uri={m.avatarUrl} />
                  <Cell>{`${m.lastName}, ${m.firstName}`}</Cell>
                </View>
              ),
            },
            {
              key: 'nr',
              label: 'Nr.',
              width: 90,
              sort: (a, b) =>
                (a.memberNumber ?? '').localeCompare(b.memberNumber ?? '', 'de', { numeric: true }),
              csv: (m) => m.memberNumber ?? '',
              render: (m) => <Cell muted>{m.memberNumber ?? '–'}</Cell>,
            },
            {
              key: 'teams',
              label: 'Mannschaften',
              flex: 1.5,
              sort: (a, b) => a.teams.length - b.teams.length,
              csv: (m) =>
                m.teams
                  .map((t) => (t.function === 'player' ? t.badge : `${t.badge} (Trainerteam)`))
                  .join(', '),
              render: (m) => (
                <Cell>
                  {m.teams
                    .map((t) => (t.function === 'player' ? t.badge : `${t.badge} · Trainerteam`))
                    .join(', ') || '–'}
                </Cell>
              ),
            },
            {
              key: 'roles',
              label: 'Rollen',
              flex: 1.5,
              sort: (a, b) => a.roles.length - b.roles.length,
              csv: (m) => m.roles.join(', '),
              render: (m) =>
                m.roles.length ? (
                  <Chip tone="primary" label={m.roles.join(', ')} />
                ) : (
                  <Cell muted>–</Cell>
                ),
            },
            {
              key: 'app',
              label: 'App',
              width: 110,
              sort: (a, b) => Number(a.hasAccount) - Number(b.hasAccount),
              csv: (m) => (m.hasAccount ? 'ja' : 'nein'),
              render: (m) => <Cell muted={m.hasAccount}>{m.hasAccount ? 'ja' : 'ohne App'}</Cell>,
            },
          ]}
        />
      ) : list.length ? (
        <Card list>
          {list.map((m, i) => {
            const tag = m.roles[0] ?? (!m.hasAccount ? 'ohne App' : null);
            const sub = [
              ...m.teams.map((t) =>
                t.function === 'player' ? t.badge : `${t.badge} · Trainerteam`,
              ),
              ...m.roles.slice(1),
              m.roles.length > 0 && !m.hasAccount ? 'ohne App' : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <ListRow
                key={m.id}
                first={i === 0}
                leading={
                  <Avatar name={`${m.firstName} ${m.lastName}`} size={42} uri={m.avatarUrl} />
                }
                title={`${m.lastName}, ${m.firstName}`}
                subtitle={sub || undefined}
                trailing={
                  tag ? (
                    <Chip tone={m.roles.length > 0 ? 'primary' : 'neutral'} label={tag} />
                  ) : null
                }
                onPress={() => router.push(`/admin/member/${m.id}`)}
              />
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
