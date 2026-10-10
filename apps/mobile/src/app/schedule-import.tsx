import {
  SCHEDULE_FIELDS,
  type ScheduleField,
  type SchedulePreview,
  type SchedulePreviewRow,
} from '@clubroof/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ChoiceChips, Chip, Screen, Section, T } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { MATCH_KIND_LABELS } from '@/lib/labels';
import { dateFormat } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { pickFile, type PickedFile } from '@/lib/upload';

const SHOWN = 120;
const FIELD_LABELS: Record<ScheduleField, string> = {
  matchId: 'Spielkennung',
  kickoff: 'Anstoß (Datum und Uhrzeit)',
  date: 'Datum',
  time: 'Uhrzeit',
  home: 'Heimmannschaft',
  away: 'Gastmannschaft',
  competition: 'Spielklasse',
  status: 'Status',
};
const STATUS: Record<SchedulePreviewRow['status'], { label: string; tone: 'success' | 'info' | 'neutral' | 'action' }> = {
  new: { label: 'Neu', tone: 'success' },
  changed: { label: 'Geändert', tone: 'info' },
  unchanged: { label: 'Unverändert', tone: 'neutral' },
  skipped: { label: 'Übersprungen', tone: 'action' },
};

/**
 * Spielplan-Import aus dem DFBnet (CSV). Verwaltung: Vereinsspielplan für alle Mannschaften;
 * Trainer: Mannschaftsspielplan (`teamId`). Erst Vorschau, übernommen wird nach Bestätigung.
 */
export default function ScheduleImportScreen() {
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  const { api, me } = useSignedIn();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [columns, setColumns] = useState<Partial<Record<ScheduleField, string | null>>>({});
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const run = useRef(0);

  const call = async (commit: boolean, picked = file) => {
    if (!picked) return null;
    const ticket = ++run.current;
    setBusy(true);
    setError(null);
    try {
      const result = await api<SchedulePreview>('/schedule-import', {
        method: 'POST',
        body: { dataBase64: picked.dataBase64, teamId: teamId ?? null, columns, mapping, commit },
      });
      if (ticket === run.current) setPreview(result);
      return result;
    } catch (e) {
      if (ticket === run.current) {
        setError(e instanceof RequestError ? e.message : 'Die Datei konnte nicht geprüft werden.');
        if (e instanceof RequestError && e.code === 'import_header') setShowColumns(true);
      }
      return null;
    } finally {
      if (ticket === run.current) setBusy(false);
    }
  };

  // Vorschau neu berechnen, wenn Spalten oder Zuordnungen geändert werden
  useEffect(() => {
    if (file) void call(false);
    // eslint-disable-next-line
  }, [file, columns, mapping]);

  const choose = async () => {
    const picked = await pickFile('csv');
    if (!picked) return;
    setPreview(null);
    setUndone(null);
    setFile(picked);
  };

  const when = (iso: string | null) =>
    iso
      ? dateFormat({
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: me.club.timezone,
        }).format(new Date(iso))
      : '–';

  if (preview?.result && !undone) {
    const r = preview.result;
    return (
      <Screen edges={[]}>
        <Card style={{ gap: 10, alignItems: 'center', paddingVertical: 24 }}>
          <T variant="heading">{`${r.created} Spiele angelegt`}</T>
          <T variant="caption" style={{ textAlign: 'center' }}>
            {r.updated > 0 ? `${r.updated} bestehende Spiele wurden angepasst. ` : ''}
            Die Mannschaften wurden mit einer Sammelmeldung informiert.
          </T>
        </Card>
        <Button label="Zum Kalender" icon="calendar" onPress={() => router.replace('/calendar')} />
        <Button
          label="Import rückgängig machen (neu angelegte Spiele)"
          variant="outline"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const out = await api<{ removed: number; kept: number }>(
                `/schedule-import/${r.batchId}/undo`,
                { method: 'POST' },
              );
              setUndone(`${out.removed} Spiele entfernt${out.kept ? `, ${out.kept} bleiben (Spielbericht vorhanden)` : ''}.`);
            } catch (e) {
              setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
            } finally {
              setBusy(false);
            }
          }}
        />
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      </Screen>
    );
  }
  if (undone) {
    return (
      <Screen edges={[]}>
        <Card style={{ gap: 10, alignItems: 'center', paddingVertical: 24 }}>
          <T variant="heading">Import rückgängig gemacht</T>
          <T variant="caption" style={{ textAlign: 'center' }}>
            {undone}
          </T>
        </Card>
        <Button
          label="Neue Datei importieren"
          variant="outline"
          onPress={() => {
            setFile(null);
            setPreview(null);
            setUndone(null);
          }}
        />
      </Screen>
    );
  }

  const ordered = preview
    ? [...preview.rows].sort(
        (a, b) => rank(a.status) - rank(b.status) || a.line - b.line,
      )
    : [];
  const importable = preview ? preview.summary.new + preview.summary.changed : 0;

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 10 }}>
        <T>
          Lade den Spielplan als CSV-Datei aus dem DFBnet (Meisterschaft › Vereinsspielplan bzw.
          Mannschaftsspielplan › Export). Du siehst zuerst eine Vorschau – übernommen wird erst nach
          deiner Bestätigung. Ein erneuter Import aktualisiert bestehende Spiele, statt sie doppelt
          anzulegen.
        </T>
        <T variant="caption">
          Pokal-, Liga- und Testspiele werden erkannt (Spalte „Spielklasse“). Treffzeit und Treffpunkt
          kommen aus den Regeln der Mannschaft. Vergangene und abgesetzte Spiele werden übersprungen.
        </T>
      </Card>
      <Button
        label={file ? 'Andere Datei wählen' : 'CSV-Datei auswählen'}
        icon="document-attach-outline"
        variant={preview ? 'outline' : 'primary'}
        loading={busy && !preview}
        onPress={() => void choose()}
      />
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      {preview ? (
        <>
          <Section title={`Vorschau: ${file?.name ?? ''}`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip tone="success" icon="add-circle" label={`${preview.summary.new} neu`} />
              <Chip tone="info" icon="create-outline" label={`${preview.summary.changed} geändert`} />
              <Chip tone="neutral" icon="checkmark" label={`${preview.summary.unchanged} unverändert`} />
              <Chip tone="action" icon="remove-circle-outline" label={`${preview.summary.skipped} übersprungen`} />
            </View>
          </Section>

          {preview.unmapped.length > 0 ? (
            <Section title="Mannschaften zuordnen">
              <Card style={{ gap: 14 }}>
                <T variant="caption">
                  Diese Namen aus dem DFBnet gehören vermutlich zu eurem Verein. Wähle die passende
                  Mannschaft – die Schreibweise wird gemerkt. Gegner mit ähnlichem Namen kannst du
                  überspringen.
                </T>
                {preview.unmapped.map((u) => (
                  <ChoiceChips
                    key={u.name}
                    label={`${u.name} (${u.count} Zeilen)`}
                    options={[
                      ...preview.teams.map((t) => ({ value: t.id, label: t.label })),
                      { value: 'skip', label: 'Keine eigene Mannschaft' },
                    ]}
                    selected={mapping[u.name] === undefined ? [] : [mapping[u.name] || 'skip']}
                    onToggle={(v) =>
                      setMapping((m) => ({ ...m, [u.name]: v === 'skip' ? '' : v }))
                    }
                  />
                ))}
              </Card>
            </Section>
          ) : null}

          <Button
            label={showColumns ? 'Spaltenzuordnung ausblenden' : 'Spaltenzuordnung prüfen'}
            variant="outline"
            icon="options-outline"
            onPress={() => setShowColumns((v) => !v)}
          />
          {showColumns ? (
            <Card style={{ gap: 14 }}>
              {SCHEDULE_FIELDS.map((f) => (
                <ChoiceChips
                  key={f}
                  label={FIELD_LABELS[f]}
                  options={[
                    ...preview.headers.map((h) => ({ value: h, label: h })),
                    { value: '', label: '— nicht vorhanden —' },
                  ]}
                  selected={[preview.columns[f] ?? '']}
                  onToggle={(v) => setColumns((c) => ({ ...c, [f]: v || null }))}
                />
              ))}
            </Card>
          ) : null}

          <Section title="Spiele">
            <Card>
              {ordered.slice(0, SHOWN).map((r, i) => (
                <View key={`${r.line}-${r.teamId}`} style={{ paddingVertical: 10, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(128,128,128,0.25)' }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <Chip tone={STATUS[r.status].tone} label={STATUS[r.status].label} />
                    {r.teamLabel ? <Chip tone="neutral" label={r.teamLabel} /> : null}
                    {r.kind ? <Chip tone="neutral" label={MATCH_KIND_LABELS[r.kind]} /> : null}
                  </View>
                  <T variant="label">
                    {r.opponent ? `${r.isHome === false ? '@ ' : ''}${r.opponent}` : `Zeile ${r.line}`}
                  </T>
                  <T variant="caption">{[r.startsAt ? when(r.startsAt) : null, r.competition].filter(Boolean).join(' · ')}</T>
                  {r.changes.map((c) => (
                    <T key={c} variant="caption">{c}</T>
                  ))}
                  {r.reason ? <T variant="caption">{r.reason}</T> : null}
                </View>
              ))}
            </Card>
            {ordered.length > SHOWN ? (
              <T variant="caption">{`Es werden ${SHOWN} von ${ordered.length} Zeilen angezeigt.`}</T>
            ) : null}
          </Section>

          {preview.unmapped.length > 0 ? (
            <Chip tone="action" label="Bitte zuerst alle Mannschaften zuordnen." />
          ) : null}
          <Button
            label={`${importable} Spiele übernehmen`}
            icon="checkmark"
            disabled={importable === 0 || preview.unmapped.length > 0}
            loading={busy}
            onPress={() => void call(true)}
          />
        </>
      ) : null}
    </Screen>
  );
}

const rank = (s: SchedulePreviewRow['status']) =>
  ({ new: 0, changed: 1, skipped: 2, unchanged: 3 })[s];
