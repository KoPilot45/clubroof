import type { Absence } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  Loading,
  Screen,
  T,
  TeamBadge,
} from '@/components/ui';
import { ABSENCE_ICONS, ABSENCE_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

function AbsenceCard({ absence, showPerson }: { absence: Absence; showPerson: boolean }) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => api(`/absences/${absence.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      for (const key of ['absences', 'home', 'events', 'event']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
  const range =
    absence.startsOn === absence.endsOn
      ? formatDate(absence.startsOn)
      : `${formatDate(absence.startsOn)} – ${formatDate(absence.endsOn)}`;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <IconTile name={ABSENCE_ICONS[absence.kind]} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading">
            {ABSENCE_LABELS[absence.kind]}
            {showPerson ? ` · ${absence.personName.split(' ')[0]}` : ''}
          </T>
          <T variant="caption">{range}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {absence.teams.length === 0 ? (
          <Chip tone="neutral" label="Alle Mannschaften" />
        ) : (
          absence.teams.map((t) => <TeamBadge key={t.id} badge={t.badge} />)
        )}
        <Chip
          tone="info"
          label={
            absence.affectedEvents === 1
              ? '1 Termin abgesagt'
              : `${absence.affectedEvents} Termine abgesagt`
          }
        />
      </View>
      {absence.note ? <T variant="caption">„{absence.note}“</T> : null}
      {confirm ? (
        <View style={{ gap: 8 }}>
          <T variant="caption">
            Beim Löschen werden die automatischen Absagen zurückgenommen. Bei Mannschaften mit
            aktiver Zu-/Absage ist die Rückmeldung danach wieder offen.
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              style={{ flex: 1 }}
              label="Behalten"
              variant="outline"
              onPress={() => setConfirm(false)}
            />
            <Button
              style={{ flex: 1 }}
              label="Löschen"
              variant="danger"
              loading={remove.isPending}
              onPress={() => remove.mutate()}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Abwesenheit löschen"
          variant="outline"
          icon="trash-outline"
          onPress={() => setConfirm(true)}
        />
      )}
    </Card>
  );
}

export default function AbsencesScreen() {
  const { api, me } = useSignedIn();
  const absences = useQuery({ queryKey: ['absences'], queryFn: () => api<Absence[]>('/absences') });
  const hasChildren = me.managedPersons.length > 1;

  return (
    <Screen edges={[]} refreshing={absences.isRefetching} onRefresh={() => absences.refetch()}>
      <T variant="caption">
        Trage ein, wann du{hasChildren ? ' oder deine Kinder' : ''} nicht verfügbar bist. Betroffene
        Termine werden automatisch abgesagt, dein Trainerteam sieht es sofort.
      </T>
      <Button
        label="Abwesenheit eintragen"
        icon="add-circle-outline"
        onPress={() => router.push('/absences/new')}
      />
      {absences.isPending ? <Loading /> : null}
      {absences.error ? (
        <ErrorNotice message={absences.error.message} onRetry={() => absences.refetch()} />
      ) : null}
      {absences.data?.length === 0 ? (
        <Empty icon="calendar-clear-outline" text="Keine aktuellen oder geplanten Abwesenheiten." />
      ) : null}
      {absences.data?.map((a) => (
        <AbsenceCard key={a.id} absence={a} showPerson={hasChildren} />
      ))}
    </Screen>
  );
}
