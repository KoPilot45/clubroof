import type { EventDetail, LineupEntry, MatchIncident, MatchSheet } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Chip, Section, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export const INCIDENT_LABELS: Record<MatchIncident['kind'], string> = {
  goal: 'Tor',
  penalty_goal: 'Elfmetertor',
  own_goal: 'Eigentor des Gegners',
  yellow: 'Gelbe Karte',
  yellow_red: 'Gelb-Rote Karte',
  red: 'Rote Karte',
};

export function IncidentIcon({ kind }: { kind: MatchIncident['kind'] }) {
  const { colors } = useTheme();
  if (kind === 'goal' || kind === 'penalty_goal' || kind === 'own_goal')
    return (
      <Ionicons
        name="football"
        size={16}
        color={colors.primaryText}
        accessibilityLabel={INCIDENT_LABELS[kind]}
      />
    );
  const color = kind === 'yellow' ? '#F2C200' : kind === 'red' ? '#D32F2F' : '#E67E22';
  return (
    <View
      accessibilityLabel={INCIDENT_LABELS[kind]}
      style={{
        width: 11,
        height: 15,
        borderRadius: 2,
        backgroundColor: color,
        marginHorizontal: 2,
      }}
    />
  );
}

export function IncidentRow({ i }: { i: MatchIncident }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T variant="caption" style={{ width: 30, textAlign: 'right' }}>
        {i.minute != null ? `${i.minute}'` : ''}
      </T>
      <IncidentIcon kind={i.kind} />
      <View style={{ flex: 1 }}>
        <T variant="body">
          {i.person?.name ?? INCIDENT_LABELS[i.kind]}
          {i.kind === 'penalty_goal' ? ' (Elfmeter)' : ''}
        </T>
        {i.assist ? <T variant="caption">Vorlage: {i.assist.name}</T> : null}
      </View>
    </View>
  );
}

function LineupList({ title, entries }: { title: string; entries: LineupEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{title}</T>
      {entries.map((e) => (
        <View key={e.personId} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <T variant="caption" style={{ width: 24, textAlign: 'right' }}>
            {e.jerseyNumber ?? ''}
          </T>
          <T variant="body" style={{ flex: 1 }}>
            {e.name}
            {e.position ? ` · ${e.position}` : ''}
          </T>
          {e.guestFrom ? <Chip tone="info" label={`Gast ${e.guestFrom}`} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Aufstellung und Spielbericht im Termin (nur bei Spielen). */
export function MatchSection({ event }: { event: EventDetail }) {
  const { api } = useSignedIn();
  const sheet = useQuery({
    queryKey: ['match', event.id],
    queryFn: () => api<MatchSheet>(`/events/${event.id}/match`),
  });
  const m = sheet.data;
  if (!m) return null;
  const started = new Date(event.startsAt) <= new Date();
  const scheduled = event.status === 'scheduled';
  const starters = m.lineup?.entries.filter((e) => e.role === 'starter') ?? [];
  const bench = m.lineup?.entries.filter((e) => e.role === 'substitute') ?? [];

  return (
    <>
      {m.report && (m.report.completed || m.can.editReport) && started ? (
        <Section title="Spielbericht">
          <Card style={{ gap: 10 }}>
            {!m.report.completed ? (
              <Chip
                tone="action"
                label="Noch nicht abgeschlossen – nur für das Trainerteam sichtbar"
              />
            ) : null}
            {m.report.incidents.length === 0 ? (
              <T variant="caption">Keine Ereignisse erfasst.</T>
            ) : null}
            {m.report.incidents.map((i) => (
              <IncidentRow key={i.id} i={i} />
            ))}
            {m.can.editReport && scheduled ? (
              <Button
                label={m.report.completed ? 'Spielbericht bearbeiten' : 'Spielbericht erfassen'}
                variant="outline"
                icon="create-outline"
                onPress={() => router.push(`/match/${event.id}/report`)}
              />
            ) : null}
          </Card>
        </Section>
      ) : null}

      {m.lineup || (m.can.editLineup && scheduled) ? (
        <Section title="Aufstellung">
          <Card style={{ gap: 12 }}>
            {m.lineup && !m.lineup.published ? (
              <Chip tone="action" label="Entwurf – nur für das Trainerteam sichtbar" />
            ) : null}
            {!m.lineup || m.lineup.entries.length === 0 ? (
              <T variant="caption">Noch keine Aufstellung.</T>
            ) : null}
            <LineupList title={`Startelf (${starters.length})`} entries={starters} />
            <LineupList title={`Bank (${bench.length})`} entries={bench} />
            {m.can.editLineup && scheduled && !started ? (
              <Button
                label={
                  m.lineup?.entries.length ? 'Aufstellung bearbeiten' : 'Aufstellung erstellen'
                }
                variant="outline"
                icon="people-outline"
                onPress={() => router.push(`/match/${event.id}/lineup`)}
              />
            ) : null}
          </Card>
        </Section>
      ) : null}
    </>
  );
}
