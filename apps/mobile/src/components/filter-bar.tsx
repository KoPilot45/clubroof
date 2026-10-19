/**
 * Filterleiste (Paket DT3): Auf dem Desktop steht die Suche in einer Zeile mit einem Knopf „Filter“, der die
 * weiteren Filter aufklappt; aktive Filter erscheinen als Chips zum Entfernen, damit die Tabelle ohne Scrollen
 * beginnt. Auf dem Handy bleibt alles in einer Karte untereinander.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Chip } from '@/components/ui';
import { useIsDesktop } from '@/lib/layout';
import { t } from '@/lib/i18n';

export function FilterBar({
  search,
  active,
  children,
}: {
  search: ReactNode;
  /** aktive Filter als Chips; Antippen entfernt den Filter */
  active: { label: string; onRemove: () => void }[];
  children: ReactNode;
}) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  if (!desktop)
    return (
      <Card style={{ gap: 12 }}>
        {search}
        {children}
      </Card>
    );
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ flex: 1 }}>{search}</View>
        <Button
          label={active.length > 0 ? `${t('Filter')} (${active.length})` : 'Filter'}
          icon={open ? 'chevron-up' : 'options-outline'}
          variant="tonal"
          onPress={() => setOpen(!open)}
        />
      </View>
      {active.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {active.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={t(`${a.label} entfernen`)}
              onPress={a.onRemove}
            >
              <Chip tone="primary" icon="close" label={a.label} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {open ? <Card style={{ gap: 12 }}>{children}</Card> : null}
    </View>
  );
}
