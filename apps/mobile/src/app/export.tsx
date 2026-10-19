/**
 * Exporte (Paket IMPORT-EXPORT, Stufe 3): Mitglieder, Kader, Termine, Anwesenheit, Kasse, Gesamtexport und „Meine
 * Daten“. Welche Bereiche zu sehen sind, bestimmt der Server nach den Rechten der Person.
 */
import {
  type ExportAreaInfo,
  type ExportAreasResponse,
  type ExportFile,
  type ExportFormat,
} from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
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
  type IconName,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

const ICON: Record<ExportAreaInfo['area'], IconName> = {
  me: 'person-circle',
  roster: 'shirt',
  events: 'calendar',
  attendance: 'checkmark-done',
  members: 'people',
  cash: 'wallet',
  fees: 'receipt',
  club: 'archive',
};

/** Datei im Browser speichern; auf dem Handy als Text teilen (Tabellen und ZIP bitte am Computer laden). */
async function saveFile(file: ExportFile): Promise<boolean> {
  if (Platform.OS === 'web') {
    const bytes = Uint8Array.from(atob(file.dataBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: file.contentType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }
  if (file.contentType.startsWith('text/')) {
    await Share.share({ message: atob(file.dataBase64), title: file.name });
    return true;
  }
  return false;
}

export default function ExportScreen() {
  const { api } = useSignedIn();
  const areas = useQuery({
    queryKey: ['export', 'areas'],
    queryFn: () => api<ExportAreasResponse>('/export/areas'),
  });
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [teamOf, setTeamOf] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (a: ExportAreaInfo) => {
    const teamId = a.teams ? (teamOf[a.area] ?? a.teams[0]?.id) : undefined;
    setBusy(a.area);
    setMessage(null);
    try {
      const file = await api<ExportFile>(
        `/export/${a.area}?format=${a.zip ? 'csv' : format}${teamId ? `&teamId=${teamId}` : ''}`,
      );
      const saved = await saveFile(file);
      setMessage(
        saved
          ? { ok: true, text: t('Export erstellt.') }
          : { ok: false, text: t('Diese Datei lädst du am Computer herunter (Excel oder ZIP).') },
      );
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof RequestError ? e.message : t('Der Export hat nicht geklappt.'),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={[]} refreshing={areas.isRefetching} onRefresh={() => areas.refetch()}>
      {areas.isPending ? <Loading /> : null}
      {areas.error ? <ErrorNotice error={areas.error} onRetry={() => areas.refetch()} /> : null}
      {areas.data ? (
        <>
          <T color="muted">
            Lade Daten als Excel- oder CSV-Datei herunter. Du siehst nur, wofür du Rechte hast;
            jeder Export wird im Protokoll des Vereins festgehalten.
          </T>
          <ChoiceChips
            label="Format"
            options={[
              { value: 'xlsx', label: 'Excel' },
              { value: 'csv', label: 'CSV' },
            ]}
            selected={[format]}
            onToggle={setFormat}
          />
          {message ? (
            <Chip
              tone={message.ok ? 'success' : 'urgent'}
              icon={message.ok ? 'checkmark-circle' : 'alert-circle'}
              label={message.text}
            />
          ) : null}
          <Section title="Exporte">
            {areas.data.areas.map((a) => (
              <Card key={a.area} style={{ gap: 10 }}>
                <T variant="label" style={{ fontWeight: '700' }}>
                  {a.label}
                </T>
                <T variant="caption">{a.description}</T>
                {a.teams && a.teams.length > 1 ? (
                  <ChoiceChips
                    scroll
                    options={a.teams.map((tm) => ({ value: tm.id, label: tm.badge }))}
                    selected={[teamOf[a.area] ?? a.teams[0]!.id]}
                    onToggle={(id) => setTeamOf({ ...teamOf, [a.area]: id })}
                  />
                ) : null}
                <View style={{ alignItems: 'flex-start' }}>
                  <Button
                    label={a.zip ? 'ZIP herunterladen' : 'Herunterladen'}
                    icon={ICON[a.area]}
                    loading={busy === a.area}
                    onPress={() => void run(a)}
                  />
                </View>
              </Card>
            ))}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
