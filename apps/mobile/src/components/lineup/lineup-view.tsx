/**
 * Aufstellung schreibgeschützt (Paket AUF): dasselbe Spielfeld ohne Kaderleiste, Beteiligungspunkte und Balken; die Bank
 * als Liste. Eigene Scheiben (ich und meine Kinder) stehen in Akzentfarbe. Für Spieler, Eltern und das Trainerteam im Termin.
 */
import { findFormation, type LineupEntry, type LineupSize } from '@clubroof/core';
import { View } from 'react-native';
import { Chip, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Disc, Pitch, initials, type PlannerPlayer } from './parts';

function toPlayer(e: LineupEntry): PlannerPlayer {
  const parts = e.name.split(' ');
  return {
    id: e.personId,
    name: e.name,
    last: parts.slice(1).join(' ') || e.name,
    number: e.jerseyNumber,
    abbr: null,
    position: e.position,
    status: 'yes',
    reason: null,
    attendance: null,
  };
}

export function LineupView({
  size,
  formation,
  entries,
}: {
  size: LineupSize;
  formation: string;
  entries: LineupEntry[];
}) {
  const { me } = useSignedIn();
  const { colors } = useTheme();
  const f = findFormation(size, formation);
  if (!f) return null;
  const mineIds = me.managedPersons.map((p) => p.id);
  const players = new Map(entries.map((e) => [e.personId, toPlayer(e)]));
  const slots = Array<string | null>(f.rows.flat().length).fill(null);
  for (const e of entries) if (e.role === 'starter' && e.slot !== null) slots[e.slot] = e.personId;
  const bench = entries.filter((e) => e.role === 'substitute');
  return (
    <View style={{ gap: 12 }}>
      <T variant="caption">{`${f.key} · ${size}er`}</T>
      <Pitch formation={f} slots={slots} players={players} readOnly mineIds={mineIds} />
      {bench.length ? (
        <View style={{ gap: 8 }}>
          <T variant="label">{`Bank (${bench.length})`}</T>
          {bench.map((e) => (
            <View key={e.personId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Disc
                size={28}
                number={e.jerseyNumber}
                text={initials(e.name)}
                mine={mineIds.includes(e.personId)}
              />
              <T verbatim style={{ flex: 1, color: colors.onSurface }}>
                {e.name}
              </T>
              {mineIds.includes(e.personId) ? <Chip tone="primary" label="Bank" /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
