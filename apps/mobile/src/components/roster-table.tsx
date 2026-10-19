/**
 * Kadertabelle der Desktop-Ansicht (Paket DT): Nummer, Spieler, Position, Verfügbarkeit. Die Beteiligung der letzten
 * vier Wochen steht im Aufstellungsplaner (Kader im Detail); hier gibt es dafür keine eigenen Daten.
 */
import type { RosterEntry } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { formatShortDate } from '@/lib/format';
import { useIsCompactDesktop } from '@/lib/layout';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { webState } from '@/lib/web-state';
import { Text } from './app-text';
import { Avatar, Card, Chip, T } from './ui';

const COLS = { nr: 56, position: 180, status: 220 };

export function RosterTable({ teamId }: { teamId: string }) {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const roster = useQuery({
    queryKey: ['roster', teamId],
    queryFn: () => api<RosterEntry[]>(`/teams/${teamId}/roster`),
  });
  const compact = useIsCompactDesktop();
  const players = (roster.data ?? []).filter((r) => r.function === 'player');
  if (players.length === 0) return null;
  const head = (label: string, width?: number) => (
    <T variant="overline" style={width ? { width } : { flex: 1 }}>
      {label}
    </T>
  );
  return (
    <Card style={{ paddingVertical: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.anstoss.divider,
        }}
      >
        {head('Nr.', COLS.nr)}
        {head('Spieler')}
        {compact ? null : head('Position', COLS.position)}
        {head('Status', COLS.status)}
      </View>
      {players.map((p) => (
        <Pressable
          key={p.personId}
          accessibilityRole="link"
          accessibilityLabel={p.name}
          onPress={() => router.push(`/profile/${p.personId}`)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.anstoss.divider,
            backgroundColor: webState(state).hovered ? colors.anstoss.overlay : 'transparent',
          })}
        >
          <Text
            style={{ width: COLS.nr, fontSize: 15, fontWeight: '800', color: colors.primaryText }}
            verbatim
          >
            {p.jerseyNumber ?? '–'}
          </Text>
          <View
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 }}
          >
            <Avatar name={p.name} uri={p.avatarUrl} size={32} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.onSurface }}
              verbatim
            >
              {p.name}
            </Text>
          </View>
          {compact ? null : (
            <Text style={{ width: COLS.position, fontSize: 13, color: colors.onSurfaceMuted }}>
              {p.position ?? '–'}
            </Text>
          )}
          <View style={{ width: COLS.status, alignItems: 'flex-start' }}>
            {p.unavailable ? (
              <Chip
                tone="info"
                label={
                  p.unavailableReason
                    ? `${p.unavailableReason}${p.unavailableUntil ? ` bis ${formatShortDate(p.unavailableUntil)}` : ''}`
                    : 'Nicht verfügbar'
                }
              />
            ) : (
              <Chip tone="success" label="Verfügbar" />
            )}
          </View>
        </Pressable>
      ))}
    </Card>
  );
}
