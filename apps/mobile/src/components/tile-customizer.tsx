import type { MeResponse } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Button, Chip, IconTile, Sheet, T, type TileItem } from './ui';

type Prefs = NonNullable<MeResponse['user']['clubTiles']>;

/** Gespeicherte Reihenfolge anwenden und ausgeblendete Kacheln weglassen; Neues erscheint am Ende. */
export function applyTilePrefs(tiles: TileItem[], prefs: Prefs | null): TileItem[] {
  if (!prefs) return tiles;
  const rank = (key: string) => {
    const i = prefs.order.indexOf(key);
    return i === -1 ? prefs.order.length : i;
  };
  return tiles
    .filter((t) => !prefs.hidden.includes(t.key))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t.key) - rank(b.t.key) || a.i - b.i)
    .map(({ t }) => t);
}

/** Blatt „Kacheln anpassen“: ein- und ausblenden, mit Pfeilen verschieben, speichern oder zurücksetzen. */
export function TileCustomizeSheet({
  visible,
  onClose,
  tiles,
  prefs,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  /** alle verfügbaren Kacheln in Standardreihenfolge */
  tiles: TileItem[];
  prefs: Prefs | null;
  onSaved: () => Promise<void>;
}) {
  const { api } = useSignedIn();
  const { colors, sizes } = useTheme();
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Beim Öffnen mit der aktuellen Auswahl beginnen
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setWasVisible(true);
    const current = applyTilePrefs(tiles, prefs ? { ...prefs, hidden: [] } : null).map(
      (t) => t.key,
    );
    setOrder(current);
    setHidden(prefs?.hidden.filter((k) => current.includes(k)) ?? []);
  } else if (!visible && wasVisible) setWasVisible(false);

  const byKey = new Map(tiles.map((t) => [t.key, t]));
  const move = (index: number, delta: number) =>
    setOrder((cur) => {
      const next = [...cur];
      const target = index + delta;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  const toggle = (key: string) =>
    setHidden((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const run = async (clubTiles: Prefs | null) => {
    setSaving(true);
    setError(null);
    try {
      await api('/me/preferences', { method: 'PUT', body: { clubTiles } });
      await onSaved();
      onClose();
    } catch {
      setError('Die Auswahl konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };
  const arrow = (
    name: 'chevron-up' | 'chevron-down',
    label: string,
    onPress: () => void,
    off: boolean,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={off}
      onPress={onPress}
      style={{
        width: sizes.touchTarget,
        height: sizes.touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.3 : 1,
      }}
    >
      <Ionicons name={name} size={22} color={colors.onSurface} />
    </Pressable>
  );
  return (
    <Sheet visible={visible} onClose={onClose} title="Kacheln anpassen">
      <T variant="caption">
        Blende Kacheln aus, die du nicht brauchst, und schiebe die wichtigen nach oben. Neue
        Funktionen erscheinen am Ende.
      </T>
      <View>
        {order.map((key, i) => {
          const tile = byKey.get(key);
          if (!tile) return null;
          const off = hidden.includes(key);
          return (
            <View
              key={key}
              style={{
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !off }}
                accessibilityLabel={tile.label}
                onPress={() => toggle(key)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 56,
                  opacity: off ? 0.5 : 1,
                }}
              >
                <IconTile name={tile.icon} tone={tile.tint ?? 'primary'} />
                <T variant="label" style={{ flex: 1, fontWeight: '700' }} numberOfLines={2}>
                  {tile.label}
                </T>
                <Ionicons
                  name={off ? 'square-outline' : 'checkbox'}
                  size={24}
                  color={off ? colors.onSurfaceMuted : colors.primaryText}
                />
              </Pressable>
              {arrow('chevron-up', 'Nach oben', () => move(i, -1), i === 0)}
              {arrow('chevron-down', 'Nach unten', () => move(i, 1), i === order.length - 1)}
            </View>
          );
        })}
      </View>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          style={{ flex: 1 }}
          label="Zurücksetzen"
          variant="outline"
          disabled={saving || prefs === null}
          onPress={() => void run(null)}
        />
        <Button
          style={{ flex: 1 }}
          label="Speichern"
          loading={saving}
          onPress={() => void run({ order, hidden })}
        />
      </View>
    </Sheet>
  );
}
