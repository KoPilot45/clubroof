import type { ClubCash, ClubCashFund } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
  Toggle,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

/** Kassen des Vereins (Paket K6) – gemeinsam für Admin-Verwaltung und Vereinskasse. */
export function useFunds() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (job: { method: 'POST' | 'PATCH'; path: string; body: unknown }) =>
      api<ClubCash>(job.path, { method: job.method, body: job.body }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['club-cash'], data);
      void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
      ),
  });
  return { cash, run, error, setError };
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Eine Kasse bearbeiten: Name, Abteilungen, Hauptkasse, Stilllegen. */
function FundEditor({
  fund,
  units,
  busy,
  onSave,
}: {
  fund: ClubCashFund;
  units: ClubCash['units'];
  busy: boolean;
  onSave: (body: object) => void;
}) {
  const [name, setName] = useState(fund.name);
  const [unitIds, setUnitIds] = useState(fund.units.map((u) => u.id));
  const same =
    name.trim() === fund.name &&
    unitIds.length === fund.units.length &&
    unitIds.every((id) => fund.units.some((u) => u.id === id));
  return (
    <View style={{ gap: 12, paddingVertical: 10 }}>
      <TextField label="Name der Kasse" value={name} onChangeText={setName} maxLength={60} />
      {units.length > 0 ? (
        <ChoiceChips
          label="Abteilungen dieser Kasse"
          options={units.map((u) => ({ value: u.id, label: u.name }))}
          selected={unitIds}
          onToggle={(id) => setUnitIds(toggle(unitIds, id))}
          check
        />
      ) : null}
      <Button
        label="Speichern"
        icon="checkmark"
        disabled={same || name.trim().length < 2}
        loading={busy}
        onPress={() => onSave({ name: name.trim(), unitIds })}
      />
      {!fund.isMain && !fund.archived ? (
        <Button
          label="Als Hauptkasse festlegen"
          icon="star-outline"
          variant="tonal"
          onPress={() => onSave({ isMain: true })}
        />
      ) : null}
      {!fund.isMain ? (
        <Button
          label={fund.archived ? 'Wieder aktivieren' : 'Stilllegen'}
          icon={fund.archived ? 'refresh' : 'archive-outline'}
          variant="outline"
          onPress={() => onSave({ archived: !fund.archived })}
        />
      ) : (
        <T variant="caption">
          Die Hauptkasse nimmt Buchungen ohne Abteilungsbezug auf und kann nicht stillgelegt werden.
          Lege eine andere Kasse als Hauptkasse fest, um zu wechseln.
        </T>
      )}
    </View>
  );
}

/** Bildschirm „Kassen“: Übersicht, Zuordnung zu Abteilungen, neue Kasse. */
export function FundsScreenBody() {
  const { cash, run, error } = useFunds();
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [main, setMain] = useState(false);

  const c = cash.data;
  if (cash.isPending) return <Loading />;
  if (cash.error || !c) return <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} />;
  const manage = c.canManageFunds;
  const active = c.funds.filter((f) => !f.archived);
  const archived = c.funds.filter((f) => f.archived);

  const row = (f: ClubCashFund, i: number) => (
    <View key={f.id}>
      <ListRow
        first={i === 0}
        strike={f.archived}
        leading={<IconTile name="wallet" tone={f.isMain ? 'violet' : 'blue'} />}
        title={f.name}
        subtitle={[
          f.isMain ? t('Hauptkasse') : null,
          f.units.length ? f.units.map((u) => u.name).join(', ') : t('Keine Abteilung zugeordnet'),
          f.accountCount === 1 ? t('1 Konto') : t(`${f.accountCount} Konten`),
        ]
          .filter(Boolean)
          .join(' · ')}
        trailing={<Chip tone="neutral" label={formatEuro(f.balanceCents)} />}
        onPress={manage ? () => setOpen(open === f.id ? null : f.id) : undefined}
      />
      {manage && open === f.id ? (
        <FundEditor
          fund={f}
          units={c.units}
          busy={run.isPending}
          onSave={(body) => run.mutate({ method: 'PATCH', path: `/club-cash/funds/${f.id}`, body })}
        />
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]} refreshing={cash.isRefetching} onRefresh={() => cash.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Card style={{ gap: 6 }}>
        <T variant="caption">
          Jede Kasse hat eigene Konten, Beiträge und Auswertung. Ohne Zuordnung läuft eine Abteilung
          über die Hauptkasse. Der Jahresabschluss gilt immer für den ganzen Verein.
        </T>
      </Card>

      <Section title="Kassen">
        <Card>
          {active.length === 0 ? <Empty icon="wallet-outline" text="Noch keine Kasse." /> : null}
          {active.map(row)}
        </Card>
      </Section>

      {archived.length > 0 ? (
        <Section title="Stillgelegt">
          <Card>{archived.map(row)}</Card>
        </Section>
      ) : null}

      {manage ? (
        <Section title="Kasse anlegen">
          <Card style={{ gap: 12 }}>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder={t('z. B. Jugendkasse')}
            />
            {c.units.length > 0 ? (
              <ChoiceChips
                label="Für welche Abteilungen?"
                options={c.units.map((u) => ({ value: u.id, label: u.name }))}
                selected={unitIds}
                onToggle={(id) => setUnitIds(toggle(unitIds, id))}
                check
              />
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <T style={{ flex: 1 }}>Als Hauptkasse festlegen</T>
              <Toggle label="Als Hauptkasse festlegen" value={main} onChange={setMain} />
            </View>
            <Button
              label="Kasse anlegen"
              icon="add"
              disabled={name.trim().length < 2}
              loading={run.isPending}
              onPress={() => {
                run.mutate({
                  method: 'POST',
                  path: '/club-cash/funds',
                  body: { name: name.trim(), unitIds, isMain: main },
                });
                setName('');
                setUnitIds([]);
                setMain(false);
              }}
            />
          </Card>
        </Section>
      ) : (
        <T variant="caption">Kassen legt die Kassenführung des ganzen Vereins an.</T>
      )}
    </Screen>
  );
}
