/**
 * Sortierbare Liste per Drag & Drop (Anfasser ziehen). Funktioniert mit Finger und Maus; für
 * Bildschirmleser gibt es „nach oben“/„nach unten“ als Aktionen am Anfasser.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, View, type GestureResponderHandlers } from 'react-native';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

type Drag = { key: string; from: number; to: number; dy: number };

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item!);
  return next;
}

export function ReorderList({
  keys,
  onChange,
  rowHeight,
  renderRow,
}: {
  keys: string[];
  onChange: (keys: string[]) => void;
  rowHeight: number;
  /** Zeile ohne Anfasser; `handle` wird vom Aufrufer an gewünschter Stelle eingesetzt */
  renderRow: (key: string, handle: ReactNode) => ReactNode;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const latest = useRef({ keys, onChange, rowHeight });
  latest.current = { keys, onChange, rowHeight };
  const dragRef = useRef<Drag | null>(null);
  const responders = useRef(new Map<string, GestureResponderHandlers>());

  const responderFor = (key: string) => {
    let handlers = responders.current.get(key);
    if (!handlers) {
      handlers = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const from = latest.current.keys.indexOf(key);
          dragRef.current = { key, from, to: from, dy: 0 };
          setDrag(dragRef.current);
        },
        onPanResponderMove: (_e, g) => {
          const d = dragRef.current;
          if (!d) return;
          const { keys: list, rowHeight: h } = latest.current;
          const to = Math.max(0, Math.min(list.length - 1, Math.round(d.from + g.dy / h)));
          dragRef.current = { ...d, to, dy: g.dy };
          setDrag(dragRef.current);
        },
        onPanResponderRelease: () => finish(),
        onPanResponderTerminate: () => finish(),
      }).panHandlers;
      responders.current.set(key, handlers);
    }
    return handlers;
  };
  const finish = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (d && d.to !== d.from) latest.current.onChange(moveItem(latest.current.keys, d.from, d.to));
  };

  // Während des Ziehens zeigt die Liste schon die neue Reihenfolge
  const shown = useMemo(() => (drag ? moveItem(keys, drag.from, drag.to) : keys), [keys, drag]);
  return (
    <View>
      {shown.map((key, i) => {
        const dragging = drag?.key === key;
        // gezogene Zeile folgt dem Finger: Versatz relativ zu ihrem aktuellen Platz
        const offset = dragging ? drag!.dy - (drag!.to - drag!.from) * rowHeight : 0;
        return (
          <View
            key={key}
            style={{
              height: rowHeight,
              zIndex: dragging ? 2 : 0,
              transform: [{ translateY: offset }],
              opacity: dragging ? 0.92 : 1,
            }}
          >
            {renderRow(
              key,
              <Handle
                handlers={responderFor(key)}
                canUp={i > 0}
                canDown={i < shown.length - 1}
                onMove={(delta) => onChange(moveItem(keys, i, i + delta))}
              />,
            )}
          </View>
        );
      })}
    </View>
  );
}

function Handle({
  handlers,
  canUp,
  canDown,
  onMove,
}: {
  handlers: GestureResponderHandlers;
  canUp: boolean;
  canDown: boolean;
  onMove: (delta: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      {...handlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('Reihenfolge ändern')}
      accessibilityActions={[
        ...(canUp ? [{ name: 'decrement', label: t('Nach oben') }] : []),
        ...(canDown ? [{ name: 'increment', label: t('Nach unten') }] : []),
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'decrement') onMove(-1);
        if (e.nativeEvent.actionName === 'increment') onMove(1);
      }}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        // verhindert, dass der Browser beim Ziehen scrollt
        ...({ touchAction: 'none', cursor: 'grab' } as object),
      }}
    >
      <Ionicons name="reorder-three" size={26} color={colors.onSurfaceMuted} />
    </View>
  );
}
