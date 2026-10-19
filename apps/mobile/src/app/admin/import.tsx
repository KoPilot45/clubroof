/**
 * Import-Assistent (Paket IM): Bereich wählen und Vorlage laden · Datei · Spalten zuordnen · Prüfen und Verhalten
 * bei Dubletten · Ergebnis mit „Rückgängig“ (24 Stunden). Die Prüfung macht der Server; die App schickt bei jedem
 * Schritt dieselben Angaben, damit nur übernommen wird, was zuletzt in der Vorschau stand.
 */
import {
  IMPORT_AREAS,
  type ImportArea,
  type ImportAreasResponse,
  type ImportDuplicateMode,
  type ImportPreview,
  type ImportRequest,
  type ImportRow,
  type ImportRunInfo,
  type ImportTemplateFile,
} from '@clubroof/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Loading,
  Section,
  Sheet,
  T,
  TextField,
  type IconName,
} from '@/components/ui';
import { ChoiceCard, WizardShell } from '@/components/wizard';
import { RequestError } from '@/lib/api';
import { readSetting, writeSetting } from '@/lib/flags';
import { formatDay, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { pickFile, type PickedFile } from '@/lib/upload';

const SHOWN = 150;
const TOTAL = 4;

const DUPLICATES: { value: ImportDuplicateMode; label: string; text: string }[] = [
  {
    value: 'skip',
    label: 'Überspringen',
    text: 'Vorhandene Einträge bleiben unverändert (empfohlen).',
  },
  {
    value: 'update',
    label: 'Aktualisieren',
    text: 'Vorhandene Einträge bekommen die Werte aus der Datei, leere Zellen ändern nichts.',
  },
  {
    value: 'create',
    label: 'Neu anlegen',
    text: 'Auch Dubletten werden als neue Einträge angelegt.',
  },
];

/** Vorlage im Browser als Datei speichern. */
function saveFile(file: ImportTemplateFile) {
  const bytes = Uint8Array.from(atob(file.dataBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: file.contentType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const AREA_ICON: Record<ImportArea, IconName> = {
  members: 'people',
  roster: 'shirt',
  events: 'calendar',
  sponsors: 'ribbon',
  facilities: 'location',
  equipment: 'construct',
  fee_types: 'pricetag',
  fee_assignments: 'people-circle',
  fee_dues: 'receipt',
  budget: 'stats-chart',
  cash_entries: 'wallet',
};

/** Wohin nach dem Import: die Seite, auf der die neuen Einträge stehen */
const AREA_TARGET: Record<ImportArea, { label: string; href: string }> = {
  members: { label: 'Zu den Mitgliedern', href: '/admin/members' },
  roster: { label: 'Zum Team', href: '/team' },
  events: { label: 'Zu den Terminen', href: '/termine' },
  sponsors: { label: 'Zu den Sponsoren', href: '/admin/sponsors' },
  facilities: { label: 'Zur Platzbelegung', href: '/facilities' },
  equipment: { label: 'Zu Anlage & Material', href: '/equipment' },
  fee_types: { label: 'Zu den Beitragsarten', href: '/club-cash/fee-setup' },
  fee_assignments: { label: 'Zu den Beitragsarten', href: '/club-cash/fee-setup' },
  fee_dues: { label: 'Zu den Beiträgen', href: '/club-cash/fees' },
  budget: { label: 'Zum Haushaltsplan', href: '/club-cash/budget' },
  cash_entries: { label: 'Zum Kassenbuch', href: '/club-cash/entries' },
};

const rank = (r: ImportRow) =>
  r.status === 'error' ? 0 : r.status === 'duplicate' ? 1 : r.status === 'update' ? 2 : 3;

export default function ImportScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const areas = useQuery({
    queryKey: ['import', 'areas'],
    queryFn: () => api<ImportAreasResponse>('/import/areas'),
  });
  const [step, setStep] = useState(1);
  const params = useLocalSearchParams<{ area?: string; teamId?: string }>();
  const [area, setArea] = useState<ImportArea | null>(
    (IMPORT_AREAS as readonly string[]).includes(params.area ?? '')
      ? (params.area as ImportArea)
      : null,
  );
  const [teamId, setTeamId] = useState<string | null>(params.teamId ?? null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [mapping, setMapping] = useState<(string | null)[] | null>(null);
  const [duplicates, setDuplicates] = useState<ImportDuplicateMode>('skip');
  const [excluded, setExcluded] = useState<number[]>([]);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState<ImportRow | null>(null);

  const info = areas.data?.areas.find((a) => a.area === area) ?? null;
  const request = (over: Partial<ImportRequest> = {}): ImportRequest => ({
    area: area!,
    teamId: info?.needsTeam ? teamId : null,
    file: { name: file!.name, dataBase64: file!.dataBase64 },
    sheet,
    mapping,
    duplicates,
    excluded,
    edits,
    ...over,
  });

  const run = async (
    path: 'preview' | 'commit',
    over: Partial<ImportRequest> = {},
  ): Promise<ImportPreview | null> => {
    setBusy(true);
    setError(null);
    try {
      return await api<ImportPreview>(`/import/${path}`, {
        method: 'POST',
        body: request(over),
      });
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Die Datei konnte nicht geprüft werden.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** Zuordnung je Quelle merken: gleiche Spaltenüberschriften → gleiche Zuordnung beim nächsten Mal */
  const mapKey = (p: ImportPreview) => `import.map.${p.area}.${p.header.join('|').slice(0, 200)}`;

  const choose = async () => {
    const picked = await pickFile('table');
    if (!picked || !area) return;
    setFile(picked);
    setSheet(null);
    setMapping(null);
    setExcluded([]);
    setEdits({});
    setBusy(true);
    setError(null);
    try {
      let p = await api<ImportPreview>('/import/preview', {
        method: 'POST',
        body: {
          area,
          teamId: info?.needsTeam ? teamId : null,
          file: { name: picked.name, dataBase64: picked.dataBase64 },
          duplicates,
        } satisfies ImportRequest,
      });
      const remembered = await readSetting(mapKey(p));
      if (remembered) {
        try {
          const m = JSON.parse(remembered) as (string | null)[];
          if (JSON.stringify(m) !== JSON.stringify(p.mapping)) {
            p = await api<ImportPreview>('/import/preview', {
              method: 'POST',
              body: {
                area,
                teamId: info?.needsTeam ? teamId : null,
                file: { name: picked.name, dataBase64: picked.dataBase64 },
                duplicates,
                mapping: m,
              } satisfies ImportRequest,
            });
            setMapping(m);
          }
        } catch {
          // beschädigte Merkung: automatisch erkannte Zuordnung bleibt
        }
      }
      setPreview(p);
      setStep(3);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Die Datei konnte nicht gelesen werden.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async (over: Partial<ImportRequest>) => {
    const p = await run('preview', over);
    if (p) setPreview(p);
  };

  const commit = async () => {
    if (preview) await writeSetting(mapKey(preview), JSON.stringify(preview.mapping));
    const p = await run('commit');
    if (p) {
      setDone(p);
      void queryClient.invalidateQueries({ queryKey: ['import', 'runs'] });
    }
  };

  if (areas.isPending) return <Loading />;
  const available = areas.data?.areas ?? [];

  // ── Ergebnis ──────────────────────────────────────────────────────────────
  if (done?.run)
    return (
      <Result
        done={done}
        area={area!}
        onAgain={() => {
          setDone(null);
          setPreview(null);
          setFile(null);
          setStep(1);
        }}
      />
    );

  // ── 1 Bereich ─────────────────────────────────────────────────────────────
  if (step === 1)
    return (
      <WizardShell
        title="Was möchtest du importieren?"
        explanation="Aus einer Excel- oder CSV-Datei. Du siehst zuerst eine Vorschau – übernommen wird erst nach deiner Bestätigung."
        step={1}
        total={TOTAL}
        onBack={() => router.back()}
        onNext={() => setStep(2)}
        nextDisabled={!area || (info?.needsTeam && !teamId) || false}
        hint="Neu angelegte Einträge kannst du 24 Stunden lang mit einem Tipp rückgängig machen."
      >
        {available.length === 0 ? (
          <Card>
            <T>Für den Import fehlen dir die Rechte.</T>
          </Card>
        ) : null}
        {available.map((a) => (
          <ChoiceCard
            key={a.area}
            icon={AREA_ICON[a.area]}
            title={a.label}
            text={a.text}
            selected={area === a.area}
            onPress={() => {
              setArea(a.area);
              if (!a.needsTeam) setTeamId(null);
            }}
          />
        ))}
        {info?.needsTeam ? (
          <ChoiceChips
            label="Mannschaft"
            options={(areas.data?.teams ?? [])
              .filter((x) => !info.teamIds || info.teamIds.includes(x.id))
              .map((x) => ({ value: x.id, label: x.badge }))}
            selected={teamId ? [teamId] : []}
            onToggle={setTeamId}
          />
        ) : null}
        {area ? <TemplateButtons area={area} /> : null}
        <RecentRuns />
      </WizardShell>
    );

  // ── 2 Datei ───────────────────────────────────────────────────────────────
  if (step === 2 || !preview || !info)
    return (
      <WizardShell
        title="Datei auswählen"
        explanation="Excel (.xlsx) oder CSV – auch aus der bisherigen Mitgliederverwaltung. Bis zu 5 MB und 5000 Zeilen."
        step={2}
        total={TOTAL}
        onBack={() => setStep(1)}
        onNext={() => void choose()}
        nextLabel={file ? 'Andere Datei wählen' : 'Datei auswählen'}
        busy={busy}
        error={error}
        hint="Die erste Zeile enthält die Spaltenüberschriften. Die Zuordnung zu den Feldern prüfst du im nächsten Schritt."
      >
        {file ? (
          <Card>
            <T variant="label" verbatim>
              {file.name}
            </T>
          </Card>
        ) : null}
      </WizardShell>
    );

  // ── 3 Zuordnung ───────────────────────────────────────────────────────────
  if (step === 3)
    return (
      <WizardShell
        title="Spalten zuordnen"
        explanation="Das Feld rechts bekommt seine Werte aus der Spalte der Datei. Passt eine Erkennung nicht, wähle das richtige Feld."
        step={3}
        total={TOTAL}
        onBack={() => setStep(2)}
        onNext={() => setStep(4)}
        nextDisabled={preview.missingRequired.length > 0 || busy}
        busy={busy}
        error={error}
        hint="Die Zuordnung merkt sich Clubroof für Dateien mit denselben Spaltenüberschriften."
      >
        {preview.sheets.length > 1 ? (
          <ChoiceChips
            label="Blatt der Excel-Datei"
            options={preview.sheets.map((s) => ({ value: s, label: s }))}
            selected={preview.sheet ? [preview.sheet] : []}
            onToggle={(s) => {
              setSheet(s);
              setMapping(null);
              void refresh({ sheet: s, mapping: null });
            }}
          />
        ) : null}
        {preview.missingRequired.length > 0 ? (
          <Chip
            tone="urgent"
            icon="alert-circle"
            label={`Noch nicht zugeordnet: ${preview.missingRequired.join(', ')}`}
          />
        ) : null}
        {preview.header.map((h, i) => (
          <Card key={`${i}${h}`} style={{ gap: 8 }}>
            <T variant="label" style={{ fontWeight: '700' }} verbatim>
              {h || `(${i + 1})`}
            </T>
            <T variant="caption" verbatim>
              {preview.sample
                .map((r) => r[i] ?? '')
                .filter(Boolean)
                .slice(0, 3)
                .join(' · ') || '–'}
            </T>
            <ChoiceChips
              scroll
              options={[
                ...info.fields.map((f) => ({ value: f.key, label: f.label })),
                { value: '-', label: 'Nicht verwenden' },
              ]}
              selected={[preview.mapping[i] ?? '-']}
              onToggle={(v) => {
                const next = preview.header.map((_, j) =>
                  j === i
                    ? v === '-'
                      ? null
                      : v
                    : preview.mapping[j] === v
                      ? null
                      : (preview.mapping[j] ?? null),
                );
                setMapping(next);
                void refresh({ mapping: next });
              }}
            />
          </Card>
        ))}
      </WizardShell>
    );

  // ── 4 Prüfen ──────────────────────────────────────────────────────────────
  const ordered = [...preview.rows].sort((a, b) => rank(a) - rank(b) || a.line - b.line);
  const importable = preview.summary.new + preview.summary.update;
  return (
    <WizardShell
      title="Prüfen und übernehmen"
      explanation="Jede Zeile ist grün (neu), blau (aktualisiert), gelb (Dublette) oder rot (Fehler). Abgewählte Zeilen werden nicht übernommen."
      step={4}
      total={TOTAL}
      onBack={() => setStep(3)}
      onNext={() => void commit()}
      nextLabel={importable === 1 ? '1 Eintrag übernehmen' : `${importable} Einträge übernehmen`}
      nextDisabled={importable === 0 || preview.summary.error > 0 || busy}
      busy={busy}
      error={error}
      hint={
        preview.summary.error > 0
          ? 'Fehlerhafte Zeilen korrigieren oder abwählen, dann lässt sich der Import übernehmen. Es wird alles oder nichts übernommen.'
          : 'Es wird alles oder nichts übernommen.'
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip tone="success" icon="person-add" label={`${preview.summary.new} neu`} />
        <Chip tone="info" icon="refresh" label={`${preview.summary.update} aktualisiert`} />
        <Chip tone="action" icon="copy-outline" label={`${preview.summary.duplicate} Dubletten`} />
        <Chip tone="urgent" icon="alert-circle" label={`${preview.summary.error} fehlerhaft`} />
        {preview.summary.excluded ? (
          <Chip tone="neutral" label={`${preview.summary.excluded} abgewählt`} />
        ) : null}
      </View>
      <Section title="Bei Dubletten">
        <ChoiceChips
          options={DUPLICATES.map((d) => ({ value: d.value, label: d.label }))}
          selected={[duplicates]}
          onToggle={(v) => {
            setDuplicates(v);
            void refresh({ duplicates: v });
          }}
        />
        <T variant="caption">{DUPLICATES.find((d) => d.value === duplicates)!.text}</T>
      </Section>
      <Section title={`Vorschau: ${file?.name ?? ''}`}>
        {ordered.slice(0, SHOWN).map((row) => (
          <PreviewRow
            key={row.line}
            row={row}
            onToggle={() => {
              const next = row.selected
                ? [...excluded, row.line]
                : excluded.filter((l) => l !== row.line);
              setExcluded(next);
              void refresh({ excluded: next });
            }}
            onFix={() => setFixing(row)}
          />
        ))}
        {ordered.length > SHOWN ? (
          <T variant="caption">{`… und ${ordered.length - SHOWN} weitere Zeilen.`}</T>
        ) : null}
      </Section>
      <FixSheet
        row={fixing}
        fields={info.fields}
        onClose={() => setFixing(null)}
        onSave={(values) => {
          const next = { ...edits, [String(fixing!.line)]: values };
          setEdits(next);
          setFixing(null);
          void refresh({ edits: next });
        }}
      />
    </WizardShell>
  );
}

function TemplateButtons({ area }: { area: ImportArea }) {
  const { api } = useSignedIn();
  const [busy, setBusy] = useState(false);
  if (Platform.OS !== 'web')
    return (
      <T variant="caption">
        Die Vorlage mit Beispielzeile und Spaltenerklärung lädst du in der Web-Verwaltung herunter.
      </T>
    );
  const load = async (format: 'xlsx' | 'csv') => {
    setBusy(true);
    try {
      saveFile(await api<ImportTemplateFile>(`/import/template/${area}?format=${format}`));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Button
        label="Vorlage für Excel"
        icon="download-outline"
        variant="outline"
        size="sm"
        loading={busy}
        onPress={() => void load('xlsx')}
      />
      <Button
        label="Vorlage als CSV"
        icon="download-outline"
        variant="outline"
        size="sm"
        loading={busy}
        onPress={() => void load('csv')}
      />
    </View>
  );
}

function RecentRuns() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const runs = useQuery({
    queryKey: ['import', 'runs'],
    queryFn: () => api<ImportRunInfo[]>('/import/runs'),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const list = (runs.data ?? []).slice(0, 5);
  if (list.length === 0) return null;
  const undo = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await api(`/import/runs/${id}/undo`, { method: 'POST' });
      void queryClient.invalidateQueries({ queryKey: ['import', 'runs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das Rückgängigmachen hat nicht geklappt.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Section title="Letzte Importe">
      {list.map((r) => (
        <Card key={r.id} style={{ gap: 6 }}>
          <T variant="label" style={{ fontWeight: '700' }}>
            {r.areaLabel}
          </T>
          <T variant="caption">
            {[
              `${formatDay(r.createdAt)}, ${formatTime(r.createdAt)}`,
              r.createdByName,
              t(`${r.summary.created} neu, ${r.summary.updated} aktualisiert`),
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
          {r.undone ? <Chip tone="archived" label="Rückgängig gemacht" /> : null}
          {r.canUndo ? (
            <Button
              label="Rückgängig machen"
              icon="arrow-undo"
              variant="outline"
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              loading={busy === r.id}
              onPress={() => void undo(r.id)}
            />
          ) : null}
        </Card>
      ))}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
    </Section>
  );
}

function PreviewRow({
  row,
  onToggle,
  onFix,
}: {
  row: ImportRow;
  onToggle: () => void;
  onFix: () => void;
}) {
  const { colors } = useTheme();
  const name = `${row.values.firstName || '–'} ${row.values.lastName ?? ''}`.trim();
  const status = row.status;
  return (
    <Card style={{ gap: 6, opacity: row.selected ? 1 : 0.55 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={t('Zeile übernehmen')}
          accessibilityState={{ checked: row.selected }}
          onPress={onToggle}
          style={{ minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons
            name={row.selected ? 'checkbox' : 'square-outline'}
            size={24}
            color={row.selected ? colors.primaryText : colors.onSurfaceMuted}
          />
        </Pressable>
        <T variant="label" style={{ fontWeight: '700', flex: 1 }} verbatim>
          {name}
        </T>
        <Chip
          tone={
            status === 'new'
              ? 'success'
              : status === 'update'
                ? 'info'
                : status === 'duplicate'
                  ? 'action'
                  : 'urgent'
          }
          label={
            status === 'new'
              ? 'Neu'
              : status === 'update'
                ? 'Aktualisiert'
                : status === 'duplicate'
                  ? 'Dublette'
                  : 'Fehler'
          }
        />
      </View>
      <T variant="caption" verbatim>
        {[
          t(`Zeile ${row.line}`),
          ...Object.entries(row.values)
            .filter(([k, v]) => v && k !== 'firstName' && k !== 'lastName')
            .map(([, v]) => v)
            .slice(0, 5),
        ].join(' · ')}
      </T>
      {row.match ? <T variant="caption">{`Entspricht: ${row.match}`}</T> : null}
      {row.errors.map((m) => (
        <T key={m} variant="caption" color={colors.status.urgent.onContainer}>{`• ${m}`}</T>
      ))}
      {row.warnings.map((m) => (
        <T key={m} variant="caption">{`• ${m}`}</T>
      ))}
      {row.status === 'error' ? (
        <Button
          label="Korrigieren"
          icon="create-outline"
          variant="outline"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          onPress={onFix}
        />
      ) : null}
    </Card>
  );
}

function FixSheet({
  row,
  fields,
  onClose,
  onSave,
}: {
  row: ImportRow | null;
  fields: { key: string; label: string }[];
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const line = useRef<number | null>(null);
  useEffect(() => {
    if (row && line.current !== row.line) {
      line.current = row.line;
      setValues({ ...row.values });
    }
    if (!row) line.current = null;
  }, [row]);
  return (
    <Sheet
      visible={!!row}
      onClose={onClose}
      title={row ? t(`Zeile ${row.line} korrigieren`) : undefined}
    >
      <View style={{ gap: 12 }}>
        {row?.errors.map((m) => (
          <Chip key={m} tone="urgent" icon="alert-circle" label={m} />
        ))}
        {fields.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={values[f.key] ?? ''}
            onChangeText={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
            maxLength={120}
          />
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} label="Abbrechen" variant="neutral" onPress={onClose} />
          <Button
            style={{ flex: 1 }}
            label="Übernehmen"
            icon="checkmark"
            onPress={() => onSave(values)}
          />
        </View>
      </View>
    </Sheet>
  );
}

function Result({
  done,
  area,
  onAgain,
}: {
  done: ImportPreview;
  area: ImportArea;
  onAgain: () => void;
}) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [undone, setUndone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = done.run!;
  const skipped = done.summary.duplicate + done.summary.excluded;
  const undo = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/import/runs/${run.id}/undo`, { method: 'POST' });
      setUndone(true);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['import', 'runs'] });
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das Rückgängigmachen hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <WizardShell
      title={undone ? 'Import rückgängig gemacht' : 'Import abgeschlossen'}
      onNext={() => router.replace(AREA_TARGET[area].href as never)}
      nextLabel={AREA_TARGET[area].label}
      error={error}
      hint={
        undone
          ? undefined
          : area === 'members'
            ? 'Einladungen verschickst du unter Verwaltung → Einladungen. Rückgängig geht 24 Stunden lang.'
            : 'Rückgängig geht 24 Stunden lang.'
      }
    >
      <Card style={{ gap: 8 }}>
        <T variant="figure">{undone ? 0 : run.created + run.updated}</T>
        <T>
          {undone
            ? 'Die importierten Einträge wurden wieder entfernt, aktualisierte Werte zurückgesetzt.'
            : t(
                `${run.created} neu angelegt, ${run.updated} aktualisiert, ${skipped} übersprungen.`,
              )}
        </T>
      </Card>
      {undone ? null : (
        <Button
          label="Rückgängig machen"
          icon="arrow-undo"
          variant="outline"
          loading={busy}
          onPress={() => void undo()}
        />
      )}
      <Button label="Weitere Datei importieren" variant="outline" onPress={onAgain} />
    </WizardShell>
  );
}
