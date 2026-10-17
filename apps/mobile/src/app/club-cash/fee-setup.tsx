import {
  CLUB_FEE_INTERVALS,
  CLUB_FEE_INTERVAL_LABEL,
  type ClubCash,
  type ClubFeeAssignment,
  type ClubFeeInterval,
  type ClubFeeType,
  type ClubFees,
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
  DateStepper,
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

type Candidate = { personId: string; name: string; memberNumber: string | null };

/** Beitragsarten anlegen und Mitgliedern zuordnen (Paket K2). */
export default function FeeSetupScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const fees = useQuery({
    queryKey: ['club-fees', 'setup'],
    queryFn: () => api<ClubFees>('/club-cash/fees?status=all&q=%20'),
  });
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const [q, setQ] = useState('');
  const assignments = useQuery({
    queryKey: ['club-fees', 'assignments', q.trim()],
    queryFn: () =>
      api<ClubFeeAssignment[]>(`/club-cash/fees/assignments?q=${encodeURIComponent(q.trim())}`),
  });
  const [error, setError] = useState<string | null>(null);

  // Beitragsart anlegen
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState<ClubFeeInterval>('quarterly');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [fundId, setFundId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClubFeeType | null>(null);
  // Zuordnen
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState<Candidate | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [override, setOverride] = useState('');
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));

  const candidates = useQuery({
    queryKey: ['club-fees', 'members', search.trim()],
    queryFn: () =>
      api<Candidate[]>(`/club-cash/fees/members?q=${encodeURIComponent(search.trim())}`),
    enabled: search.trim().length >= 2 && !person,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['club-fees'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );

  const addType = useMutation({
    mutationFn: () =>
      editing
        ? api(`/club-cash/fees/types/${editing.id}`, {
            method: 'PATCH',
            body: { name: name.trim(), amountCents: parseEuro(amount), categoryId, fundId },
          })
        : api('/club-cash/fees/types', {
            method: 'POST',
            body: {
              name: name.trim(),
              amountCents: parseEuro(amount),
              interval,
              categoryId,
              fundId,
            },
          }),
    onSuccess: () => {
      setError(null);
      setName('');
      setAmount('');
      setEditing(null);
      refresh();
    },
    onError: fail,
  });
  const archive = useMutation({
    mutationFn: (v: { id: string; archived: boolean }) =>
      api(`/club-cash/fees/types/${v.id}`, { method: 'PATCH', body: { archived: v.archived } }),
    onSuccess: refresh,
    onError: fail,
  });
  const assign = useMutation({
    mutationFn: () =>
      api('/club-cash/fees/assignments', {
        method: 'POST',
        body: {
          personId: person!.personId,
          feeTypeId: typeId,
          amountOverrideCents: override.trim() ? parseEuro(override) : null,
          validFrom,
        },
      }),
    onSuccess: () => {
      setError(null);
      setPerson(null);
      setSearch('');
      setOverride('');
      refresh();
    },
    onError: fail,
  });
  const end = useMutation({
    mutationFn: (id: string) =>
      api(`/club-cash/fees/assignments/${id}/end`, {
        method: 'POST',
        body: { validTo: new Date().toISOString().slice(0, 10) },
      }),
    onSuccess: refresh,
    onError: fail,
  });

  if (fees.isPending || cash.isPending) return <Loading />;
  if (fees.error || !fees.data)
    return <ErrorNotice error={fees.error} onRetry={() => fees.refetch()} />;
  const types = fees.data.types;
  const activeTypes = types.filter((x) => !x.archived);
  const funds = (cash.data?.funds ?? []).filter((f) => !f.archived);
  const incomeCategories = (cash.data?.categories ?? []).filter(
    (c) => !c.archived && c.direction === 'income',
  );
  const chosenType = typeId ?? activeTypes[0]?.id ?? null;

  return (
    <Screen edges={[]}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      <Section title="Beitragsarten">
        <Card>
          {types.length === 0 ? <T variant="caption">Noch keine Beitragsarten.</T> : null}
          {types.map((x, i) => (
            <ListRow
              key={x.id}
              first={i === 0}
              strike={x.archived}
              title={x.name}
              subtitle={[
                t(
                  `${formatEuro(x.amountCents)} ${t(CLUB_FEE_INTERVAL_LABEL[x.interval])} · ${x.members} Mitglieder`,
                ),
                funds.length > 1 ? x.fundName : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {x.archived ? null : (
                    <Button
                      label="Bearbeiten"
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setEditing(x);
                        setName(x.name);
                        setAmount((x.amountCents / 100).toFixed(2).replace('.', ','));
                        setInterval(x.interval);
                        setCategoryId(x.categoryId);
                        setFundId(x.fundId);
                      }}
                    />
                  )}
                  <Button
                    label={x.archived ? 'Aktivieren' : 'Archivieren'}
                    size="sm"
                    variant="tonal"
                    onPress={() => archive.mutate({ id: x.id, archived: !x.archived })}
                  />
                </View>
              }
            />
          ))}
        </Card>
        <Card style={{ gap: 12 }}>
          <T variant="label" style={{ fontWeight: '700' }}>
            {editing ? 'Beitragsart bearbeiten' : 'Beitragsart anlegen'}
          </T>
          {editing ? (
            <Chip
              tone="info"
              icon="information-circle"
              label="Ein geänderter Betrag gilt für künftige Beiträge; bereits erzeugte Forderungen bleiben unverändert. Der Rhythmus lässt sich nicht ändern."
            />
          ) : null}
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder={t('z. B. Erwachsene')}
            maxLength={60}
          />
          <TextField
            label="Betrag in €"
            value={amount}
            onChangeText={setAmount}
            placeholder={t('0,00')}
          />
          {editing ? null : (
            <ChoiceChips
              label="Rhythmus"
              options={CLUB_FEE_INTERVALS.map((v) => ({
                value: v,
                label: CLUB_FEE_INTERVAL_LABEL[v],
              }))}
              selected={[interval]}
              onToggle={setInterval}
            />
          )}
          {incomeCategories.length > 0 ? (
            <ChoiceChips
              label="Einnahmekategorie (optional)"
              options={incomeCategories.map((c) => ({ value: c.id, label: c.name }))}
              selected={categoryId ? [categoryId] : []}
              onToggle={(v) => setCategoryId(categoryId === v ? null : v)}
            />
          ) : null}
          {funds.length > 1 ? (
            <ChoiceChips
              label="Zielkasse"
              options={funds.map((f) => ({
                value: f.id,
                label: f.isMain ? `${f.name} (${t('Hauptkasse')})` : f.name,
              }))}
              selected={[fundId ?? funds.find((f) => f.isMain)?.id ?? '']}
              onToggle={(v) => setFundId(funds.find((f) => f.id === v)?.isMain ? null : v)}
            />
          ) : null}
          <Button
            label={editing ? 'Änderungen speichern' : 'Beitragsart anlegen'}
            icon={editing ? 'checkmark' : 'add'}
            disabled={name.trim().length < 2 || !parseEuro(amount)}
            loading={addType.isPending}
            onPress={() => addType.mutate()}
          />
          {editing ? (
            <Button
              label="Abbrechen"
              variant="outline"
              onPress={() => {
                setEditing(null);
                setName('');
                setAmount('');
              }}
            />
          ) : null}
        </Card>
      </Section>

      <Section title="Mitglied zuordnen">
        <Card style={{ gap: 12 }}>
          {person ? (
            <ChoiceCard
              icon="person"
              title={person.name}
              text={person.memberNumber ?? undefined}
              selected
              onPress={() => setPerson(null)}
            />
          ) : (
            <>
              <TextField
                label="Mitglied suchen"
                value={search}
                onChangeText={setSearch}
                placeholder={t('Name oder Mitgliedsnummer')}
              />
              {(candidates.data ?? []).map((c) => (
                <ChoiceCard
                  key={c.personId}
                  icon="person-add"
                  title={c.name}
                  text={c.memberNumber ?? undefined}
                  selected={false}
                  onPress={() => setPerson(c)}
                />
              ))}
            </>
          )}
          {activeTypes.length > 0 ? (
            <ChoiceChips
              label="Beitragsart"
              options={activeTypes.map((x) => ({ value: x.id, label: x.name }))}
              selected={chosenType ? [chosenType] : []}
              onToggle={setTypeId}
            />
          ) : null}
          <TextField
            label="Abweichender Betrag in € (optional)"
            value={override}
            onChangeText={setOverride}
          />
          <DateStepper label="Gilt ab" value={validFrom} onChange={setValidFrom} />
          <Button
            label="Zuordnen"
            icon="checkmark"
            disabled={!person || !chosenType}
            loading={assign.isPending}
            onPress={() => {
              setTypeId(chosenType);
              assign.mutate();
            }}
          />
        </Card>
      </Section>

      <Section title="Laufende Zuordnungen">
        <TextField
          label="Suchen"
          value={q}
          onChangeText={setQ}
          placeholder={t('Name oder Mitgliedsnummer')}
        />
        <Card>
          {(assignments.data ?? []).map((a, i) => (
            <ListRow
              key={a.id}
              first={i === 0}
              title={a.personName}
              subtitle={t(
                a.overridden
                  ? `${a.feeTypeName} · ${formatEuro(a.amountCents)} (abweichend) · ab ${a.validFrom.split('-').reverse().join('.')}`
                  : `${a.feeTypeName} · ${formatEuro(a.amountCents)} · ab ${a.validFrom.split('-').reverse().join('.')}`,
              )}
              trailing={
                <View>
                  <Button
                    label="Beenden"
                    size="sm"
                    variant="tonal"
                    onPress={() => end.mutate(a.id)}
                  />
                </View>
              }
            />
          ))}
          {assignments.data?.length === 0 ? (
            <T variant="caption">Keine Zuordnungen gefunden.</T>
          ) : null}
        </Card>
      </Section>
    </Screen>
  );
}
