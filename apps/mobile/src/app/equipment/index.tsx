import type { EquipmentOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Card, Chip, ListRow, Screen, Section, T, TileGrid, type TileItem } from '@/components/ui';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

/** Einstieg „Anlage & Material“: Kabinen, Material/Schlüssel, Schäden. */
export default function EquipmentHome() {
  const { api, me } = useSignedIn();
  const equipment = useQuery({
    queryKey: ['equipment'],
    queryFn: () => api<EquipmentOverview>('/equipment'),
  });
  const tiles: TileItem[] = [
    {
      key: 'rooms',
      label: 'Kabinenplan',
      icon: 'shirt',
      onPress: () => router.push('/equipment/rooms'),
    },
    ...(me.equipment.manage
      ? [
          {
            key: 'items',
            label: 'Material & Schlüssel',
            icon: 'key' as const,
            onPress: () => router.push('/equipment/items'),
          },
        ]
      : []),
    {
      key: 'damages',
      label: 'Schaden melden',
      icon: 'construct',
      onPress: () => router.push('/equipment/damages'),
    },
  ];
  const mine = equipment.data?.mine ?? [];
  return (
    <Screen edges={[]}>
      <TileGrid items={tiles} />
      {mine.length ? (
        <Section title="Bei dir">
          <Card>
            {mine.map((i, n) => (
              <ListRow
                key={i.id}
                first={n === 0}
                title={i.name}
                subtitle={[
                  i.kind === 'key' ? 'Schlüssel' : 'Material',
                  i.handedOutAt ? `ausgegeben ${formatAgo(i.handedOutAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  i.holder && i.holder.personId !== me.person.id ? (
                    <Chip tone="neutral" label={i.holder.name} />
                  ) : null
                }
              />
            ))}
          </Card>
          <T variant="caption">Zurückgeben bitte bei den Platzverantwortlichen.</T>
        </Section>
      ) : null}
    </Screen>
  );
}
