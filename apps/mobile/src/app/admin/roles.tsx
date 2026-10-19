/**
 * Rollen und Rechte (Paket ROLLEN-VERWALTUNG): Umschalter Rollen · Personen · Matrix, Hinweise zum Stand (nur ein
 * Fulladmin, Mannschaften ohne Kassenwart), Rollenkarten mit „Standard“ oder „Eigene“, gelöschte Rollen zum
 * Wiederherstellen.
 */
import { type MemberListItem, type RoleCatalog } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Columns } from '@/components/columns';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  PageAction,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { ROLE_AREAS, coverage } from '@/lib/role-areas';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const SCOPE_HINT = { club: 'meist vereinsweit', org_unit: 'je Abteilung', team: 'je Mannschaft' };
/** So viele Personen zeigt die Übersicht je Rolle; der Rest steht hinter „Alle anzeigen“ */
const PREVIEW = 3;

type View3 = 'roles' | 'people' | 'matrix';

export default function RolesScreen() {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View3>('roles');
  const catalog = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api<RoleCatalog>('/admin/roles'),
  });
  const restore = useMutation({
    mutationFn: (key: string) =>
      api<RoleCatalog>(`/admin/roles/${key}/restore`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
  if (catalog.isPending) return <Loading />;
  if (catalog.error) return <ErrorNotice error={catalog.error} onRetry={() => catalog.refetch()} />;
  const manage = me.admin.manageRoles;
  const roles = catalog.data.roles.filter((r) => !r.archived);
  const deleted = catalog.data.roles.filter((r) => r.archived);
  const persons = new Set(roles.flatMap((r) => r.holders.map((h) => h.personId)));
  // Hinweise: nur ein Fulladmin, Mannschaften ohne Kassenwart
  const fulladmins = roles.find((r) => r.key === 'fulladmin')?.holders.length ?? 0;
  const treasurerScopes = new Set(
    (roles.find((r) => r.key === 'treasurer')?.holders ?? []).map((h) => h.scopeLabel),
  );
  const teamLabel = (x: { badge: string; name: string }) =>
    x.name.startsWith(x.badge) ? x.name : `${x.badge} · ${x.name}`;
  const noTreasurer = catalog.data.teams.filter(
    (x) => !x.name.includes('(Saison') && !treasurerScopes.has(teamLabel(x)),
  );
  const open = (key: string, add?: boolean) =>
    router.push(add ? `/admin/role/${key}?add=1` : `/admin/role/${key}`);

  return (
    <Screen edges={[]} refreshing={catalog.isRefetching} onRefresh={() => catalog.refetch()}>
      {manage ? (
        <PageAction>
          <Button label="Neue Rolle" icon="add" onPress={() => router.push('/admin/role-edit')} />
        </PageAction>
      ) : null}
      <T variant="caption">
        {[t(`${roles.length} Rollen`), t(`${persons.size} Personen`)].join(' · ')}
      </T>
      <T variant="caption">
        Rollen sind Rechtepakete: Sie werden zusätzlich zur Mannschaft vergeben – z. B. ist ein
        Spieler „Kassenwart“ seiner Mannschaft.
      </T>
      <ChoiceChips
        options={[
          { value: 'roles' as const, label: t('Rollen') },
          { value: 'people' as const, label: t('Personen') },
          { value: 'matrix' as const, label: t('Matrix') },
        ]}
        selected={[view]}
        onToggle={setView}
      />
      {fulladmins === 1 ? (
        <Chip
          tone="info"
          icon="information-circle"
          label="Es gibt nur einen Fulladmin – lege einen zweiten an."
        />
      ) : null}
      {noTreasurer.length > 0 ? (
        <Chip
          tone="info"
          icon="information-circle"
          label={t(`${noTreasurer.length} Mannschaften haben keinen Kassenwart.`)}
        />
      ) : null}

      {view === 'roles' ? (
        <>
          <Columns min={420}>
            {roles.map((r) => (
              <Card key={r.key} style={{ gap: 6 }}>
                <View
                  style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <T variant="heading">{r.name}</T>
                  <Chip
                    tone={r.isSystem ? 'neutral' : 'primary'}
                    label={r.isSystem ? 'Standard' : 'Eigene'}
                  />
                </View>
                {r.description ? <T variant="caption">{r.description}</T> : null}
                <Chip
                  tone="neutral"
                  label={`${r.permissions.length} Rechte · ${SCOPE_HINT[r.defaultScope]}`}
                />
                {r.newPermissions.length > 0 ? (
                  <Chip
                    tone="info"
                    icon="sparkles"
                    label={t(`Neues Recht verfügbar (${r.newPermissions.length})`)}
                  />
                ) : null}
                {r.holders.length === 0 ? <T variant="caption">Noch niemand.</T> : null}
                {r.holders.slice(0, PREVIEW).map((h, i) => (
                  <ListRow
                    key={h.assignmentId}
                    first={i === 0}
                    title={h.name}
                    subtitle={h.scopeLabel}
                    onPress={() => router.push(`/admin/member/${h.personId}`)}
                  />
                ))}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    label={
                      r.holders.length > PREVIEW
                        ? `Alle anzeigen (${r.holders.length})`
                        : r.holders.length
                          ? 'Rolle öffnen'
                          : 'Rolle ansehen'
                    }
                    icon="people-outline"
                    variant="outline"
                    size="sm"
                    onPress={() => open(r.key)}
                  />
                  {manage ? (
                    <Button
                      label={`${r.name} hinzufügen`}
                      icon="person-add-outline"
                      variant="tonal"
                      size="sm"
                      onPress={() => open(r.key, true)}
                    />
                  ) : null}
                </View>
              </Card>
            ))}
          </Columns>
          {deleted.length > 0 ? (
            <Section title="Gelöschte Rollen">
              <Card>
                {deleted.map((r, i) => (
                  <ListRow
                    key={r.key}
                    first={i === 0}
                    title={r.name}
                    subtitle="Gelöscht – lässt sich wiederherstellen"
                    trailing={
                      manage ? (
                        <Button
                          label="Wiederherstellen"
                          size="sm"
                          variant="outline"
                          loading={restore.isPending && restore.variables === r.key}
                          onPress={() => restore.mutate(r.key)}
                        />
                      ) : null
                    }
                  />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : view === 'people' ? (
        <PeopleView catalog={catalog.data} />
      ) : (
        <MatrixView catalog={catalog.data} />
      )}
    </Screen>
  );
}

/** Personen mit ihren Rollen und Geltungsbereichen; Filter nach Rolle oder „Ohne Rolle“. */
function PeopleView({ catalog }: { catalog: RoleCatalog }) {
  const { api } = useSignedIn();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const members = useQuery({
    queryKey: ['admin', 'members', 'roles-view'],
    queryFn: () => api<MemberListItem[]>('/admin/members?status=active'),
  });
  const roles = catalog.roles.filter((r) => !r.archived);
  const byPerson = new Map<
    string,
    { name: string; items: { role: string; key: string; scope: string }[] }
  >();
  for (const r of roles)
    for (const h of r.holders) {
      const e = byPerson.get(h.personId) ?? { name: h.name, items: [] };
      e.items.push({ role: r.name, key: r.key, scope: h.scopeLabel });
      byPerson.set(h.personId, e);
    }
  const withRoles = [...byPerson.entries()].map(([id, v]) => ({ id, ...v }));
  const without = (members.data ?? [])
    .filter((m) => !byPerson.has(m.id))
    .map((m) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      items: [] as (typeof withRoles)[number]['items'],
    }));
  const term = q.trim().toLowerCase();
  const rows = (
    filter === 'none'
      ? without
      : filter === 'all'
        ? withRoles
        : withRoles.filter((p) => p.items.some((i) => i.key === filter))
  )
    .filter((p) => !term || p.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 200);
  return (
    <>
      <TextField label="Suchen" value={q} onChangeText={setQ} placeholder={t('Name …')} />
      <ChoiceChips
        scroll
        options={[
          { value: 'all', label: t('Alle mit Rolle') },
          ...roles
            .filter((r) => r.holders.length > 0)
            .map((r) => ({ value: r.key, label: r.name })),
          { value: 'none', label: t('Ohne Rolle') },
        ]}
        selected={[filter]}
        onToggle={setFilter}
      />
      <Card>
        {rows.length === 0 ? <T variant="caption">Niemand gefunden.</T> : null}
        {rows.map((p, i) => (
          <ListRow
            key={p.id}
            first={i === 0}
            title={p.name}
            subtitle={p.items.map((x) => `${x.role} (${x.scope})`).join(' · ') || t('Keine Rolle')}
            onPress={() => router.push(`/admin/member/${p.id}`)}
          />
        ))}
      </Card>
    </>
  );
}

/** Rollen × Bereiche: voll, teilweise oder keine Rechte. */
function MatrixView({ catalog }: { catalog: RoleCatalog }) {
  const { colors } = useTheme();
  const roles = catalog.roles.filter((r) => !r.archived);
  const mark = { full: '●', partial: '◐', none: '○' } as const;
  const word = { full: 'voll', partial: 'teilweise', none: 'keine' } as const;
  return (
    <Card style={{ gap: 0, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', paddingVertical: 8, gap: 4 }}>
        <T variant="overline" style={{ flex: 2 }}>
          Rolle
        </T>
        {ROLE_AREAS.map((a) => (
          <T key={a.key} variant="overline" style={{ flex: 1, textAlign: 'center' }}>
            {a.label}
          </T>
        ))}
      </View>
      {roles.map((r) => (
        <View
          key={r.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            gap: 4,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <T style={{ flex: 2, fontWeight: '600' }} verbatim>
            {r.name}
          </T>
          {ROLE_AREAS.map((a) => {
            const c = coverage(r.permissions, a.key);
            return (
              <View
                key={a.key}
                accessible
                accessibilityLabel={`${r.name}, ${a.label}: ${t(word[c])}`}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <T
                  style={{
                    fontSize: 18,
                    color: c === 'none' ? colors.onSurfaceMuted : colors.primaryText,
                  }}
                  verbatim
                >
                  {mark[c]}
                </T>
              </View>
            );
          })}
        </View>
      ))}
      <T variant="caption" style={{ paddingTop: 10 }}>
        {['● alle Rechte des Bereichs', '◐ einige', '○ keine'].map((x) => t(x)).join(' · ')}
      </T>
    </Card>
  );
}
