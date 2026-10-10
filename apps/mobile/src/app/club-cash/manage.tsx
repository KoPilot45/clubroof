import {
  CLUB_CASH_ACCOUNT_KINDS,
  CLUB_CASH_ACCOUNT_KIND_LABEL,
  CLUB_CASH_AREAS,
  CLUB_CASH_AREA_LABEL,
  CLUB_CASH_VISIBILITIES,
  CLUB_CASH_VISIBILITY_INFO,
  CLUB_COST_CENTER_KINDS,
  CLUB_COST_CENTER_KIND_LABEL,
  type ClubCash,
  type ClubCashAccountKind,
  type ClubCashArea,
  type ClubCashDirection,
  type ClubCashVisibility,
  type ClubCostCenterKind,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { ChoiceCard } from '@/components/wizard';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

/** Einrichtung der Vereinskasse: Konten, Kategorien nach den vier Bereichen, Kostenstellen, Einsicht. */
export default function ClubCashManageScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const [error, setError] = useState<string | null>(null);

  // Formularfelder
  const [accName, setAccName] = useState('');
  const [accKind, setAccKind] = useState<ClubCashAccountKind>('bank');
  const [accOpening, setAccOpening] = useState('');
  const [catName, setCatName] = useState('');
  const [catDirection, setCatDirection] = useState<ClubCashDirection>('expense');
  const [catArea, setCatArea] = useState<ClubCashArea>('ideal');
  const [ccName, setCcName] = useState('');
  const [ccKind, setCcKind] = useState<ClubCostCenterKind>('department');

  const run = useMutation({
    mutationFn: (job: { method: 'POST' | 'PATCH' | 'PUT'; path: string; body?: unknown }) =>
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

  const c = cash.data;
  if (cash.isPending) return <Loading />;
  if (cash.error || !c) return <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} />;
  const manage = c.canManage;

  return (
    <Screen edges={[]}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      <Section title="Wer darf die Kasse einsehen?">
        <View style={{ gap: 10 }}>
          {CLUB_CASH_VISIBILITIES.map((v) => (
            <ChoiceCard
              key={v}
              icon={
                v === 'treasury' ? 'lock-closed' : v === 'board_reports' ? 'stats-chart' : 'eye'
              }
              title={CLUB_CASH_VISIBILITY_INFO[v].name}
              text={CLUB_CASH_VISIBILITY_INFO[v].description}
              selected={c.visibility === v}
              onPress={() =>
                c.canChangeSettings && c.visibility !== v
                  ? run.mutate({
                      method: 'PUT',
                      path: '/club-cash/visibility',
                      body: { visibility: v as ClubCashVisibility },
                    })
                  : undefined
              }
            />
          ))}
          {!c.canChangeSettings ? (
            <T variant="caption">Das ändert nur die Vereinsadministration.</T>
          ) : null}
        </View>
      </Section>

      <Section title="Konten">
        <Card>
          {c.accounts.map((a, i) => (
            <ListRow
              key={a.id}
              first={i === 0}
              strike={a.archived}
              title={a.name}
              subtitle={`${CLUB_CASH_ACCOUNT_KIND_LABEL[a.kind]} · ${t('Anfangsbestand')} ${formatEuro(a.openingBalanceCents)}`}
              trailing={
                manage ? (
                  <Button
                    label={a.archived ? 'Aktivieren' : 'Archivieren'}
                    size="sm"
                    variant="tonal"
                    onPress={() =>
                      run.mutate({
                        method: 'PATCH',
                        path: `/club-cash/accounts/${a.id}`,
                        body: { archived: !a.archived },
                      })
                    }
                  />
                ) : undefined
              }
            />
          ))}
        </Card>
        {manage ? (
          <Card style={{ gap: 12 }}>
            <T variant="label" style={{ fontWeight: '700' }}>
              Konto anlegen
            </T>
            <TextField
              label="Name"
              value={accName}
              onChangeText={setAccName}
              placeholder={t('z. B. Girokonto Volksbank')}
              maxLength={60}
            />
            <ChoiceChips
              label="Art"
              options={CLUB_CASH_ACCOUNT_KINDS.map((k) => ({
                value: k,
                label: CLUB_CASH_ACCOUNT_KIND_LABEL[k],
              }))}
              selected={[accKind]}
              onToggle={setAccKind}
            />
            <TextField
              label="Anfangsbestand in €"
              value={accOpening}
              onChangeText={setAccOpening}
              placeholder={t('0,00')}
            />
            <Button
              label="Konto anlegen"
              icon="add"
              disabled={accName.trim().length < 2}
              loading={run.isPending}
              onPress={() => {
                run.mutate({
                  method: 'POST',
                  path: '/club-cash/accounts',
                  body: {
                    name: accName.trim(),
                    kind: accKind,
                    openingBalanceCents: parseEuro(accOpening) ?? 0,
                  },
                });
                setAccName('');
                setAccOpening('');
              }}
            />
          </Card>
        ) : null}
      </Section>

      <Section title="Kategorien">
        {c.categories.length === 0 && manage ? (
          <Card style={{ gap: 10 }}>
            <T>Noch keine Kategorien. Übernimm die Vorlage für Sportvereine und passe sie an.</T>
            <Button
              label="Vorlage übernehmen"
              icon="list"
              onPress={() => run.mutate({ method: 'POST', path: '/club-cash/categories/template' })}
            />
          </Card>
        ) : null}
        {CLUB_CASH_AREAS.map((area) => {
          const list = c.categories.filter((k) => k.area === area);
          if (list.length === 0) return null;
          return (
            <Card key={area}>
              <T variant="overline">{CLUB_CASH_AREA_LABEL[area]}</T>
              {list.map((k, i) => (
                <ListRow
                  key={k.id}
                  first={i === 0}
                  strike={k.archived}
                  title={k.name}
                  subtitle={k.direction === 'income' ? 'Einnahme' : 'Ausgabe'}
                  trailing={
                    manage ? (
                      <Button
                        label={k.archived ? 'Aktivieren' : 'Archivieren'}
                        size="sm"
                        variant="tonal"
                        onPress={() =>
                          run.mutate({
                            method: 'PATCH',
                            path: `/club-cash/categories/${k.id}`,
                            body: { archived: !k.archived },
                          })
                        }
                      />
                    ) : undefined
                  }
                />
              ))}
            </Card>
          );
        })}
        {manage ? (
          <Card style={{ gap: 12 }}>
            <T variant="label" style={{ fontWeight: '700' }}>
              Kategorie anlegen
            </T>
            <TextField label="Name" value={catName} onChangeText={setCatName} maxLength={60} />
            <ChoiceChips
              label="Art"
              options={[
                { value: 'income', label: 'Einnahme' },
                { value: 'expense', label: 'Ausgabe' },
              ]}
              selected={[catDirection]}
              onToggle={setCatDirection}
            />
            <ChoiceChips
              label="Steuerlicher Bereich"
              options={CLUB_CASH_AREAS.map((a) => ({ value: a, label: CLUB_CASH_AREA_LABEL[a] }))}
              selected={[catArea]}
              onToggle={setCatArea}
            />
            <Button
              label="Kategorie anlegen"
              icon="add"
              disabled={catName.trim().length < 2}
              loading={run.isPending}
              onPress={() => {
                run.mutate({
                  method: 'POST',
                  path: '/club-cash/categories',
                  body: { name: catName.trim(), direction: catDirection, area: catArea },
                });
                setCatName('');
              }}
            />
          </Card>
        ) : null}
      </Section>

      <Section title="Kostenstellen">
        <Card>
          {c.costCenters.length === 0 ? <T variant="caption">Noch keine Kostenstellen.</T> : null}
          {c.costCenters.map((k, i) => (
            <ListRow
              key={k.id}
              first={i === 0}
              strike={k.archived}
              title={k.name}
              subtitle={CLUB_COST_CENTER_KIND_LABEL[k.kind]}
              trailing={
                manage ? (
                  <Button
                    label={k.archived ? 'Aktivieren' : 'Archivieren'}
                    size="sm"
                    variant="tonal"
                    onPress={() =>
                      run.mutate({
                        method: 'PATCH',
                        path: `/club-cash/cost-centers/${k.id}`,
                        body: { archived: !k.archived },
                      })
                    }
                  />
                ) : undefined
              }
            />
          ))}
        </Card>
        {manage ? (
          <Card style={{ gap: 12 }}>
            <T variant="label" style={{ fontWeight: '700' }}>
              Kostenstelle anlegen
            </T>
            <TextField label="Name" value={ccName} onChangeText={setCcName} maxLength={60} />
            <ChoiceChips
              label="Art"
              options={CLUB_COST_CENTER_KINDS.map((k) => ({
                value: k,
                label: CLUB_COST_CENTER_KIND_LABEL[k],
              }))}
              selected={[ccKind]}
              onToggle={setCcKind}
            />
            <Button
              label="Kostenstelle anlegen"
              icon="add"
              disabled={ccName.trim().length < 2}
              loading={run.isPending}
              onPress={() => {
                run.mutate({
                  method: 'POST',
                  path: '/club-cash/cost-centers',
                  body: { name: ccName.trim(), kind: ccKind },
                });
                setCcName('');
              }}
            />
          </Card>
        ) : null}
      </Section>
    </Screen>
  );
}
