import type { ChangingRoomPlan } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  T,
  TeamBadge,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ChangingRoomsScreen() {
  const { api, me } = useSignedIn();
  const time = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: me.club.timezone,
  });
  const queryClient = useQueryClient();
  const [date, setDate] = useState(localDay);
  const key = ['changing-rooms', date];
  const plan = useQuery({
    queryKey: key,
    queryFn: () => api<ChangingRoomPlan>(`/equipment/changing-rooms?date=${date}`),
  });
  const assign = useMutation({
    mutationFn: (v: { eventId: string; roomId: string | null }) =>
      api<ChangingRoomPlan>(`/events/${v.eventId}/changing-room`, {
        method: 'PUT',
        body: { roomId: v.roomId, date },
      }),
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });
  const p = plan.data;
  const myTeams = new Set(
    me.teams.filter((t) => t.functions.some((f) => f !== 'player')).map((t) => t.badge),
  );
  return (
    <Screen edges={[]} refreshing={plan.isRefetching} onRefresh={() => plan.refetch()}>
      <DateStepper label="Tag" value={date} onChange={setDate} />
      {plan.isPending ? <Loading /> : null}
      {plan.error ? (
        <ErrorNotice message={plan.error.message} onRetry={() => plan.refetch()} />
      ) : null}
      {assign.error ? (
        <Chip
          tone="urgent"
          icon="alert-circle"
          label={assign.error instanceof RequestError ? assign.error.message : 'Nicht gespeichert.'}
        />
      ) : null}
      {p && p.events.length === 0 ? (
        <Card>
          <Empty icon="shirt-outline" text="Keine Trainings oder Heimspiele an diesem Tag." />
        </Card>
      ) : null}
      {p?.events.map((e) => {
        const room = p.rooms.find((r) => r.id === e.changingRoomId);
        const editable = p.canAssign || (e.badge !== null && myTeams.has(e.badge));
        return (
          <Card key={e.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {e.badge ? <TeamBadge badge={e.badge} /> : null}
              <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
                {`${time.format(new Date(e.startsAt))}–${time.format(new Date(e.endsAt))} · ${e.title}`}
              </T>
            </View>
            {e.location ? <T variant="caption">{e.location}</T> : null}
            {e.conflict ? (
              <Chip tone="urgent" icon="warning" label="Kabine doppelt belegt" />
            ) : null}
            {editable ? (
              <ChoiceChips
                options={[
                  { value: 'none', label: 'Keine' },
                  ...p.rooms.map((r) => ({ value: r.id, label: r.name })),
                ]}
                selected={[e.changingRoomId ?? 'none']}
                onToggle={(v) => assign.mutate({ eventId: e.id, roomId: v === 'none' ? null : v })}
              />
            ) : (
              <Chip
                tone={room ? 'info' : 'neutral'}
                icon="shirt-outline"
                label={room ? room.name : 'Noch keine Kabine'}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
