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
  Sheet,
  T,
  TextField,
} from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

type Filter = 'active' | 'inactive' | 'left' | 'withoutTeam' | 'all';
/** Rollenübersicht: `role:<Schlüssel>` für eine Rolle, sonst eine der festen Auswahlen */
type RoleFilter = string;

export default function MembersScreen() {
  const { api } = useSignedIn();
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
        <TextField
          label="Suche"
          value={q}
          onChangeText={setQ}
          placeholder={t('Name oder Mitgliedsnummer')}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Button
            label={
              roleFilter === 'all' ? 'Rollen und Aufgaben' : (roleLabel ?? 'Rollen und Aufgaben')
            }
            icon="options-outline"
            variant={roleFilter === 'all' ? 'outline' : 'tonal'}
            size="sm"
            onPress={() => setFilterOpen(true)}
          />
          {activeFilters > 0 ? (
            <>
              <Chip tone="primary" label={t(`${activeFilters} Filter aktiv`)} />
              <Button label="Zurücksetzen" variant="neutral" size="sm" onPress={reset} />
            </>
          ) : null}
        </View>
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
      {list.length ? (
        <Card>
          {list.map((m, i) => (
            <ListRow
              key={m.id}
              first={i === 0}
              leading={<Avatar name={`${m.firstName} ${m.lastName}`} />}
              title={`${m.lastName}, ${m.firstName}`}
              subtitle={
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {m.teams.map((t) => (
                    <Chip
                      key={t.badge + t.function}
                      tone="neutral"
                      label={t.function === 'player' ? t.badge : `${t.badge} · Trainerteam`}
                    />
                  ))}
                  {m.roles.map((r) => (
                    <Chip key={r} label={r} />
                  ))}
                  {!m.hasAccount ? (
                    <Chip tone="neutral" icon="phone-portrait-outline" label="ohne App" />
                  ) : null}
                </View>
              }
              onPress={() => router.push(`/admin/member/${m.id}`)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
