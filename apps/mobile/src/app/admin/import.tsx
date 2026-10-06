import {
  MEMBER_IMPORT_TEMPLATE,
  type MemberImportResult,
  type MemberImportRow,
} from '@clubroof/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Card, Chip, Screen, Section, T } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { toGermanDate } from '@/lib/dates';
import { useSignedIn } from '@/lib/session';
import { pickFile, type PickedFile } from '@/lib/upload';

const COLUMNS = MEMBER_IMPORT_TEMPLATE.split('\n')[0]!.split(';');
const SHOWN = 150;

/** Vorlage im Browser als Datei speichern (in der App genügt die Spaltenliste). */
function downloadTemplate() {
  const blob = new Blob(['﻿' + MEMBER_IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clubroof-mitglieder-vorlage.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ImportScreen() {
  const { api } = useSignedIn();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [result, setResult] = useState<MemberImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (picked: PickedFile, commit: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<MemberImportResult>('/admin/import/members', {
          method: 'POST',
          body: { dataBase64: picked.dataBase64, commit },
        }),
      );
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Die Datei konnte nicht geprüft werden.');
      if (!commit) setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    const picked = await pickFile('csv');
    if (!picked) return;
    setFile(picked);
    await run(picked, false);
  };

  if (result?.imported != null) {
    return (
      <Screen edges={[]}>
        <Card style={{ gap: 10, alignItems: 'center', paddingVertical: 24 }}>
          <T variant="heading">{`${result.imported} Mitglieder übernommen`}</T>
          <T variant="caption" style={{ textAlign: 'center' }}>
            {result.summary.duplicate + result.summary.error > 0
              ? `${result.summary.duplicate} Dubletten und ${result.summary.error} fehlerhafte Zeilen wurden übersprungen.`
              : 'Alle Zeilen wurden übernommen.'}{' '}
            Einladungen verschickst du unter Verwaltung → Einladungen.
          </T>
        </Card>
        <Button
          label="Zu den Mitgliedern"
          icon="people"
          onPress={() => router.replace('/admin/members')}
        />
        <Button
          label="Weitere Datei importieren"
          variant="outline"
          onPress={() => {
            setResult(null);
            setFile(null);
          }}
        />
      </Screen>
    );
  }

  const ordered = result
    ? [...result.rows].sort((a, b) => rank(a) - rank(b) || a.line - b.line)
    : [];

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 10 }}>
        <T>
          Lade eine CSV-Datei (z. B. aus Excel „CSV UTF-8“ oder aus der bisherigen
          Mitgliederverwaltung). Du siehst zuerst eine Vorschau – übernommen wird erst nach deiner
          Bestätigung.
        </T>
        <T variant="label">Erkannte Spalten</T>
        <T variant="caption" verbatim>
          {COLUMNS.join(' · ')}
        </T>
        <T variant="caption">
          Pflicht sind nur Vorname und Nachname. Datum als TT.MM.JJJJ, Mannschaft als Kürzel (z. B.
          C1). Ohne Funktion wird „Spieler“ angenommen.
        </T>
        {Platform.OS === 'web' ? (
          <Button
            label="Vorlage herunterladen"
            icon="download-outline"
            variant="outline"
            onPress={downloadTemplate}
          />
        ) : null}
      </Card>
      <Button
        label={file ? 'Andere Datei wählen' : 'CSV-Datei auswählen'}
        icon="document-attach-outline"
        variant={result ? 'outline' : 'primary'}
        loading={busy && !result}
        onPress={() => void choose()}
      />
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      {result ? (
        <>
          <Section title={`Vorschau: ${file?.name ?? ''}`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip tone="success" icon="person-add" label={`${result.summary.new} neu`} />
              <Chip
                tone="info"
                icon="copy-outline"
                label={`${result.summary.duplicate} Dubletten`}
              />
              <Chip
                tone="urgent"
                icon="alert-circle"
                label={`${result.summary.error} fehlerhaft`}
              />
            </View>
            {result.ignoredColumns.length ? (
              <T variant="caption">{`Nicht verwendet: ${result.ignoredColumns.join(', ')}`}</T>
            ) : null}
            {ordered.slice(0, SHOWN).map((row) => (
              <ImportRow key={row.line} row={row} />
            ))}
            {ordered.length > SHOWN ? (
              <T variant="caption">{`… und ${ordered.length - SHOWN} weitere Zeilen.`}</T>
            ) : null}
          </Section>
          <Button
            label={`${result.summary.new} Mitglieder übernehmen`}
            icon="checkmark"
            disabled={result.summary.new === 0}
            loading={busy}
            onPress={() => file && void run(file, true)}
          />
          {result.summary.error > 0 ? (
            <T variant="caption">
              Fehlerhafte Zeilen werden übersprungen. Du kannst sie in der Datei korrigieren und
              danach erneut importieren – bereits übernommene Mitglieder werden als Dublette
              erkannt.
            </T>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const rank = (r: MemberImportRow) => (r.status === 'error' ? 0 : r.status === 'duplicate' ? 1 : 2);

function ImportRow({ row }: { row: MemberImportRow }) {
  const details = [
    row.birthDate ? `geb. ${toGermanDate(row.birthDate)}` : null,
    row.team && row.function
      ? `${row.team.badge} · ${TEAM_FUNCTION_LABELS[row.function]}${row.jerseyNumber ? ` #${row.jerseyNumber}` : ''}`
      : null,
    row.email,
  ].filter(Boolean);
  return (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
          {`${row.firstName || '–'} ${row.lastName}`}
        </T>
        <Chip
          tone={row.status === 'new' ? 'success' : row.status === 'duplicate' ? 'info' : 'urgent'}
          label={row.status === 'new' ? 'Neu' : row.status === 'duplicate' ? 'Dublette' : 'Fehler'}
        />
      </View>
      <T variant="caption">{[`Zeile ${row.line}`, ...details].join(' · ')}</T>
      {row.messages.map((m) => (
        <T key={m} variant="caption">{`• ${m}`}</T>
      ))}
    </Card>
  );
}
