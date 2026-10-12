import { Ionicons } from '@expo/vector-icons';
import type { ClubCash, ClubSettings, OrgUnitKind } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ORG_UNIT_KIND_LABELS } from '@/components/club-color';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Notice,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/**
 * Abteilungen des Vereins (Paket K6; bisher „Bereiche“): anlegen, umbenennen, löschen. Nach dem
 * Anlegen fragt ein Hinweis, ob die Abteilung eine eigene Kasse bekommen soll.
 */
export default function DepartmentsScreen() {
  const { api, me, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin', 'club'],
    queryFn: () => api<ClubSettings>('/admin/club'),
  });
  const cash = useQuery({
    queryKey: ['club-cash'],
    queryFn: () => api<ClubCash>('/club-cash'),
    enabled: !!me.clubCash,
  });
  const [error, setError] = useState<string | null>(null);
  const [unitName, setUnitName] = useState('');
  const [unitKind, setUnitKind] = useState<OrgUnitKind>('youth');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  /** frisch angelegte Abteilung, zu der die Kassenfrage offen ist */
  const [askFund, setAskFund] = useState<{ id: string; name: string } | null>(null);
  const [pickExisting, setPickExisting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onError = (e: Error) =>
    setError(e instanceof RequestError ? e.message : 'Die Änderung hat nicht geklappt.');

  const unit = useMutation({
    mutationFn: async (v: { method: 'POST' | 'PATCH' | 'DELETE'; id?: string; body?: object }) => {
      const before = new Set(settings.data?.orgUnits.map((u) => u.id));
      const data = await api<ClubSettings>(v.id ? `/admin/org-units/${v.id}` : '/admin/org-units', {
        method: v.method,
        body: v.body,
      });
      const created = v.method === 'POST' ? data.orgUnits.find((u) => !before.has(u.id)) : null;
      return { data, created };
    },
    onSuccess: ({ data, created }) => {
      setError(null);
      queryClient.setQueryData(['admin', 'club'], data);
      void refresh();
      setUnitName('');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] });
      void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
      setNote(null);
      setPickExisting(false);
      // Kassenfrage nur für Nutzer, die Kassen anlegen dürfen
      setAskFund(created && cash.data?.canManageFunds ? created : null);
    },
    onError,
  });
  const fund = useMutation({
    mutationFn: (v: { method: 'POST' | 'PATCH'; path: string; body: object }) =>
      api<ClubCash>(v.path, { method: v.method, body: v.body }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['club-cash'], data);
      setNote(t('Kasse gespeichert.'));
      setAskFund(null);
      setPickExisting(false);
    },
    onError,
  });

  if (settings.isPending) return <Loading />;
  if (settings.error)
    return <ErrorNotice error={settings.error} onRetry={() => settings.refetch()} />;
  const s = settings.data;
  const funds = (cash.data?.funds ?? []).filter((f) => !f.archived);
  const fundsOf = (unitId: string) =>
    funds.filter((f) => f.units.some((u) => u.id === unitId)).map((f) => f.name);

  return (
    <Screen edges={[]}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {note ? <Chip tone="success" icon="checkmark-circle" label={note} /> : null}
      {askFund ? (
        <Notice
          tone="info"
          icon="wallet"
          title={t(`Soll ${askFund.name} eine eigene Kasse bekommen?`)}
          text="Bis dahin laufen Buchungen über die Hauptkasse."
          action={{
            label: 'Eigene Kasse anlegen',
            icon: 'add',
            onPress: () =>
              fund.mutate({
                method: 'POST',
                path: '/club-cash/funds',
                body: { name: `${askFund.name}-Kasse`, unitIds: [askFund.id] },
              }),
          }}
        />
      ) : null}
      {askFund ? (
        <View style={{ gap: 8 }}>
          {funds.length > 0 ? (
            <Button
              label="Bestehender Kasse zuordnen"
              icon="link"
              variant="outline"
              onPress={() => setPickExisting(!pickExisting)}
            />
          ) : null}
          {pickExisting ? (
            <Card style={{ gap: 8 }}>
              <ChoiceChips
                label="Welche Kasse?"
                options={funds.map((f) => ({ value: f.id, label: f.name }))}
                selected={[]}
                onToggle={(id) => {
                  const f = funds.find((x) => x.id === id)!;
                  fund.mutate({
                    method: 'PATCH',
                    path: `/club-cash/funds/${id}`,
                    body: { unitIds: [...f.units.map((u) => u.id), askFund.id] },
                  });
                }}
              />
            </Card>
          ) : null}
          <Button
            label="Später entscheiden"
            variant="tonal"
            onPress={() => {
              setAskFund(null);
              setPickExisting(false);
            }}
          />
        </View>
      ) : null}

      <Section title="Abteilungen">
        <Card>
          {s.orgUnits.map((u, i) =>
            editing?.id === u.id ? (
              <View key={u.id} style={{ gap: 8, paddingVertical: 8 }}>
                <TextField
                  label="Neuer Name"
                  value={editing.name}
                  onChangeText={(v) => setEditing({ id: u.id, name: v })}
                  maxLength={50}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    label="Übernehmen"
                    style={{ flex: 1 }}
                    disabled={editing.name.trim().length < 2}
                    loading={unit.isPending}
                    onPress={() =>
                      unit.mutate({
                        method: 'PATCH',
                        id: u.id,
                        body: { name: editing.name.trim() },
                      })
                    }
                  />
                  <Button
                    label="Abbrechen"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() => setEditing(null)}
                  />
                </View>
              </View>
            ) : (
              <ListRow
                key={u.id}
                first={i === 0}
                title={u.name}
                subtitle={[
                  ORG_UNIT_KIND_LABELS[u.kind],
                  u.teams === 1 ? t('1 Mannschaft') : t(`${u.teams} Mannschaften`),
                  cash.data
                    ? fundsOf(u.id).length
                      ? fundsOf(u.id).join(', ')
                      : t('Hauptkasse')
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <IconAction
                      icon="pencil"
                      label={`${u.name} umbenennen`}
                      onPress={() => setEditing({ id: u.id, name: u.name })}
                    />
                    {u.teams === 0 ? (
                      <IconAction
                        icon="trash-outline"
                        label={`${u.name} löschen`}
                        onPress={() => unit.mutate({ method: 'DELETE', id: u.id })}
                      />
                    ) : null}
                  </View>
                }
              />
            ),
          )}
        </Card>
        <Card style={{ gap: 12 }}>
          <T variant="label">Abteilung hinzufügen</T>
          <TextField
            label="Name"
            value={unitName}
            onChangeText={setUnitName}
            maxLength={50}
            placeholder={t('z. B. Walking Football')}
          />
          <ChoiceChips
            options={(Object.keys(ORG_UNIT_KIND_LABELS) as OrgUnitKind[]).map((k) => ({
              value: k,
              label: ORG_UNIT_KIND_LABELS[k],
            }))}
            selected={[unitKind]}
            onToggle={setUnitKind}
          />
          <Button
            label="Abteilung anlegen"
            icon="add"
            variant="outline"
            disabled={unitName.trim().length < 2}
            loading={unit.isPending && !editing}
            onPress={() =>
              unit.mutate({ method: 'POST', body: { name: unitName.trim(), kind: unitKind } })
            }
          />
        </Card>
      </Section>
    </Screen>
  );
}

function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: 'pencil' | 'trash-outline';
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{ padding: 6 }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={icon === 'pencil' ? colors.primaryText : colors.onSurfaceMuted}
      />
    </Pressable>
  );
}
