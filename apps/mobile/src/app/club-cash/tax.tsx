import type { ClubTaxInfo } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  ErrorNotice,
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

/**
 * Steuerdaten für Zuwendungsbestätigungen (Paket K4). Die Administration trägt sie ein und gibt die Vorlage
 * erst frei, wenn sie rechtlich bzw. steuerlich geprüft wurde. Jede Änderung setzt die Freigabe zurück.
 */
export default function TaxInfoScreen() {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['club-tax'],
    queryFn: () => api<ClubTaxInfo>('/club-cash/tax'),
  });
  const [error, setError] = useState<string | null>(null);
  const [office, setOffice] = useState('');
  const [number, setNumber] = useState('');
  const [kind, setKind] = useState<'freistellung' | 'feststellung'>('freistellung');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState('');
  const [purposes, setPurposes] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const d = data.data;
    if (!d) return;
    setOffice(d.taxOffice ?? '');
    setNumber(d.taxNumber ?? '');
    setKind(d.exemptionKind ?? 'freistellung');
    if (d.exemptionDate) setDate(d.exemptionDate);
    setPeriod(d.exemptionPeriod ?? '');
    setPurposes(d.purposes ?? '');
  }, [data.data]);

  const done = (d: ClubTaxInfo) => {
    setError(null);
    queryClient.setQueryData(['club-tax'], d);
    void queryClient.invalidateQueries({ queryKey: ['club-donations'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const save = useMutation({
    mutationFn: () =>
      api<ClubTaxInfo>('/club-cash/tax', {
        method: 'PUT',
        body: {
          taxOffice: office.trim(),
          taxNumber: number.trim(),
          exemptionKind: kind,
          exemptionDate: date,
          exemptionPeriod: period.trim(),
          purposes: purposes.trim(),
        },
      }),
    onSuccess: done,
    onError: fail,
  });
  const approve = useMutation({
    mutationFn: () =>
      api<ClubTaxInfo>('/club-cash/tax/approve', { method: 'POST', body: { note: note.trim() } }),
    onSuccess: (d) => {
      done(d);
      setNote('');
    },
    onError: fail,
  });

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const admin = me.canManageClub;
  const filled =
    office.trim().length >= 2 &&
    number.trim().length >= 3 &&
    period.trim().length >= 4 &&
    purposes.trim().length >= 3;

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {d.reviewed ? (
        <Chip
          tone="success"
          icon="checkmark-circle"
          label={`${t('Vorlage freigegeben')}: ${d.reviewed.note ?? ''}${d.reviewed.byName ? ` (${d.reviewed.byName})` : ''}`}
        />
      ) : (
        <Notice
          tone="info"
          icon="information-circle"
          title="Vorlage noch nicht freigegeben"
          text="Zuwendungsbestätigungen haben gesetzliche Pflichtangaben und Formulierungen. Lass die Vorlage von deiner Steuerberatung oder deinem Verband prüfen, bevor du sie freigibst. Die App ersetzt keine Steuerberatung."
        />
      )}

      <Section title="Steuerangaben">
        {!admin ? (
          <Card style={{ gap: 6 }}>
            <T>
              {d.taxOffice ? `${d.taxOffice}, StNr. ${d.taxNumber ?? ''}` : t('Noch nicht erfasst')}
            </T>
            <T variant="caption">
              {[d.purposes, d.exemptionPeriod].filter(Boolean).join(' · ') || ' '}
            </T>
            <T variant="caption">Die Steuerdaten pflegt die Vereinsadministration.</T>
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <TextField label="Finanzamt" value={office} onChangeText={setOffice} maxLength={120} />
            <TextField
              label="Steuernummer"
              value={number}
              onChangeText={setNumber}
              maxLength={40}
            />
            <ChoiceChips
              label="Nachweis"
              selected={[kind]}
              onToggle={setKind}
              options={[
                { value: 'freistellung', label: t('Freistellungsbescheid') },
                { value: 'feststellung', label: t('Feststellung nach § 60a AO') },
              ]}
            />
            <DateStepper label="Datum des Bescheids" value={date} onChange={setDate} />
            <TextField
              label="Zeitraum (z. B. 2022 bis 2024)"
              value={period}
              onChangeText={setPeriod}
              maxLength={40}
            />
            <TextField
              label="Begünstigter Zweck"
              value={purposes}
              onChangeText={setPurposes}
              maxLength={200}
              placeholder={t('z. B. Förderung des Sports')}
            />
            <Button
              label="Speichern"
              icon="checkmark"
              disabled={!filled}
              loading={save.isPending}
              onPress={() => save.mutate()}
            />
            <T variant="caption">Jede Änderung setzt die Freigabe der Vorlage zurück.</T>
          </Card>
        )}
      </Section>

      {admin && d.complete && !d.reviewed ? (
        <Section title="Vorlage freigeben">
          <Card style={{ gap: 12 }}>
            <T variant="caption">
              Bestätige, dass die Vorlage rechtlich bzw. steuerlich geprüft wurde, und nenne die
              prüfende Stelle.
            </T>
            <TextField
              label="Geprüft von (z. B. Steuerberatung Muster)"
              value={note}
              onChangeText={setNote}
              maxLength={200}
            />
            <Button
              label="Vorlage freigeben"
              icon="shield-checkmark"
              disabled={note.trim().length < 3}
              loading={approve.isPending}
              onPress={() => approve.mutate()}
            />
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
