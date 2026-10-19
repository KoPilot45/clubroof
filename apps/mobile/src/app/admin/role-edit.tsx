/**
 * Eigene Rolle anlegen oder ändern (Paket ROLLEN-VERWALTUNG): Name, Beschreibung, Geltungsbereich und Rechte in
 * Klartext nach Gruppen. Sensible Rechte tragen ein Schloss und einen Warnhinweis; vereinsweite Rechte sind für
 * Abteilungs- und Mannschaftsrollen gesperrt. Standardrollen sind schreibgeschützt und werden nur kopiert.
 */
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_GROUPS,
  isClubOnlyPermission,
  isSensitivePermission,
  type RoleCatalog,
  type RoleInput,
  type ScopeType,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TextField,
  Toggle,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useConfirmDelete } from '@/lib/confirm';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

const SCOPES: { value: ScopeType; label: string }[] = [
  { value: 'club', label: 'Verein' },
  { value: 'org_unit', label: 'Abteilung' },
  { value: 'team', label: 'Mannschaft' },
];

export default function RoleEditScreen() {
  const { key, copy } = useLocalSearchParams<{ key?: string; copy?: string }>();
  const { api, me } = useSignedIn();
  const catalog = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api<RoleCatalog>('/admin/roles'),
  });
  if (catalog.isPending) return <Loading />;
  if (catalog.error) return <ErrorNotice error={catalog.error} onRetry={() => catalog.refetch()} />;
  if (!me.admin.manageRoles) return <ErrorNotice message="Rollen ändern nur Admins." />;
  const existing = key ? catalog.data.roles.find((r) => r.key === key) : undefined;
  const source = copy ? catalog.data.roles.find((r) => r.key === copy) : undefined;
  return <Form catalog={catalog.data} existing={existing} source={source} />;
}

function Form({
  catalog,
  existing,
  source,
}: {
  catalog: RoleCatalog;
  existing?: RoleCatalog['roles'][number];
  source?: RoleCatalog['roles'][number];
}) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const base = existing ?? source;
  const [name, setName] = useState(
    existing ? existing.name : source ? `${source.name} (Kopie)` : '',
  );
  const [description, setDescription] = useState(base?.description ?? '');
  const [scope, setScope] = useState<ScopeType>(base?.defaultScope ?? 'team');
  const [perms, setPerms] = useState<string[]>(base?.permissions ?? []);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readOnly = !!existing?.isSystem;

  const body: RoleInput = {
    name: name.trim(),
    description: description.trim() || null,
    defaultScope: scope,
    permissions: perms,
  };
  const save = useMutation({
    mutationFn: () =>
      existing
        ? api<RoleCatalog>(`/admin/roles/${existing.key}`, { method: 'PUT', body })
        : api<RoleCatalog>('/admin/roles', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      router.replace('/admin/roles');
    },
    onError: (e) => setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.'),
  });
  const remove = useMutation({
    mutationFn: () =>
      api<RoleCatalog>(`/admin/roles/${existing!.key}${moveTo ? `?moveTo=${moveTo}` : ''}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      router.replace('/admin/roles');
    },
    onError: (e) => setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.'),
  });

  const toggle = (p: string) =>
    setPerms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const clubOnlyBlocked = (p: string) => scope !== 'club' && isClubOnlyPermission(p);
  const holders = existing?.holders.length ?? 0;
  const others = catalog.roles.filter((r) => !r.archived && r.key !== existing?.key);
  const total = ALL_PERMISSIONS.length;

  return (
    <Screen edges={[]} wide>
      <Stack.Screen
        options={{ title: existing ? (readOnly ? existing.name : 'Rolle ändern') : 'Neue Rolle' }}
      />
      {readOnly ? (
        <Card style={{ gap: 10 }}>
          <T>
            Standardrollen sind geschützt, damit Updates sie sicher mitführen können. Kopiere die
            Rolle und passe die Kopie an.
          </T>
          <Button
            label="Kopie anpassen"
            icon="copy-outline"
            onPress={() => router.replace(`/admin/role-edit?copy=${existing!.key}`)}
          />
        </Card>
      ) : null}
      {existing && existing.newPermissions.length > 0 ? (
        <Chip
          tone="info"
          icon="sparkles"
          label={t(
            `Neue Rechte aus Updates (zunächst aus): ${existing.newPermissions.map((p) => PERMISSIONS[p as keyof typeof PERMISSIONS] ?? p).join(' · ')}`,
          )}
        />
      ) : null}
      <Card style={{ gap: 12 }}>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={40}
          editable={!readOnly}
        />
        <TextField
          label="Beschreibung"
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          editable={!readOnly}
        />
        {!existing && !source ? (
          <ChoiceChips
            label="Start als Kopie von"
            scroll
            options={[
              { value: '', label: t('Leer') },
              ...catalog.roles
                .filter((r) => !r.archived)
                .map((r) => ({ value: r.key, label: r.name })),
            ]}
            selected={['']}
            onToggle={(k) => {
              if (!k) return;
              const r = catalog.roles.find((x) => x.key === k)!;
              setPerms(r.permissions);
              setScope(r.defaultScope);
              setDescription(r.description ?? '');
            }}
          />
        ) : null}
        <ChoiceChips
          label="Gilt standardmäßig für"
          options={SCOPES.map((s) => ({ value: s.value, label: t(s.label) }))}
          selected={[scope]}
          onToggle={(v) => {
            if (readOnly) return;
            setScope(v);
            if (v !== 'club') setPerms((cur) => cur.filter((p) => !isClubOnlyPermission(p)));
          }}
        />
        <T variant="caption">{`${perms.length} von ${total} Rechten`}</T>
      </Card>

      {PERMISSION_GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <Card style={{ gap: 14 }}>
            {g.keys.map((p) => {
              const blocked = clubOnlyBlocked(p);
              const sensitive = isSensitivePermission(p);
              return (
                <View key={p} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <T style={{ flex: 1, fontWeight: '600' }} verbatim>
                      {`${sensitive ? '🔒 ' : ''}${t(PERMISSIONS[p])}`}
                    </T>
                    <Toggle
                      label={t(PERMISSIONS[p])}
                      value={perms.includes(p)}
                      disabled={readOnly || blocked}
                      onChange={() => toggle(p)}
                    />
                  </View>
                  {blocked ? (
                    <T variant="caption">Nur für vereinsweite Rollen.</T>
                  ) : sensitive && perms.includes(p) ? (
                    <T variant="caption">
                      Sensibles Recht: gibt Zugriff auf besonders geschützte Daten.
                    </T>
                  ) : null}
                </View>
              );
            })}
          </Card>
        </Section>
      ))}

      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {!readOnly ? (
        <Button
          label={existing ? 'Speichern' : 'Rolle anlegen'}
          icon="checkmark"
          loading={save.isPending}
          disabled={name.trim().length < 3}
          onPress={() => {
            setError(null);
            save.mutate();
          }}
        />
      ) : null}

      {existing && !readOnly ? (
        <Section title="Rolle löschen">
          <Card style={{ gap: 12 }}>
            <T variant="caption">
              {holders > 0
                ? `${holders} Personen haben diese Rolle. Stelle sie auf eine andere Rolle um oder lass sie ihnen entziehen. Gelöschte Rollen lassen sich wiederherstellen.`
                : 'Gelöschte Rollen lassen sich wiederherstellen.'}
            </T>
            {holders > 0 ? (
              <ChoiceChips
                label="Personen umstellen auf"
                scroll
                options={[
                  { value: '', label: t('Nur entziehen') },
                  ...others.map((r) => ({ value: r.key, label: r.name })),
                ]}
                selected={[moveTo ?? '']}
                onToggle={(k) => setMoveTo(k || null)}
              />
            ) : null}
            <Button
              label="Rolle löschen"
              variant="danger"
              icon="trash-outline"
              loading={remove.isPending}
              onPress={() =>
                confirmDelete({
                  title: 'Rolle wirklich löschen?',
                  confirmLabel: 'Löschen',
                  name: existing.name,
                  text: 'Die Rolle wird archiviert und kann wiederhergestellt werden.',
                  onConfirm: () => remove.mutate(),
                })
              }
            />
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
