/**
 * Ziehen und Ablegen für den Aufstellungsplaner (Paket AUF) mit Zeiger-Ereignissen (Maus, Finger, Stift), ohne
 * HTML5-Drag. Leisten scrollen seitlich: Auf Touch-Geräten hebt erst eine überwiegend senkrechte Bewegung ab ca.
 * 8 px den Spieler heraus (`touch-action: pan-x` auf Leisten, `none` auf Feldspielern); die Maus beginnt ab 6 px.
 * Am Rand einer Leiste blättert sie beim Ziehen weiter. Antippen funktioniert als Alternative (siehe `onPress`).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  PanResponder,
  Platform,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { hapticSelect } from '@/lib/haptics';

/** Was gerade gezogen wird: Herkunft (z. B. `s:3`, `b:1`, `pool`), Spieler und Beschriftung der Ziehfigur. */
export type DragData = { src: string; personId: string; number: string; name: string };

type Rect = { x: number; y: number; w: number; h: number };
type StripHandle = { scrollBy: (dx: number) => void };

type Dnd = {
  hover: string | null;
  dragging: DragData | null;
  registerZone: (id: string, ref: View | null) => void;
  registerStrip: (id: string, ref: View | null, handle: StripHandle) => void;
  begin: (data: DragData, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (x: number, y: number, cancelled: boolean) => void;
};

const DndContext = createContext<Dnd | null>(null);
const useDnd = () => useContext(DndContext);

const measure = (ref: View | null): Promise<Rect | null> =>
  new Promise((resolve) => {
    if (!ref?.measureInWindow) return resolve(null);
    ref.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
  });
const inside = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Zeigerposition (Fenster) aus einem Responder-Ereignis. */
function pointer(e: GestureResponderEvent, g: PanResponderGestureState) {
  const n = e.nativeEvent;
  return { x: n.pageX ?? g.moveX, y: n.pageY ?? g.moveY };
}

export function DndProvider({
  onDrop,
  renderGhost,
  children,
}: {
  /** `target`: Id der Zielfläche oder null (daneben losgelassen / abgebrochen) */
  onDrop: (data: DragData, target: string | null) => void;
  renderGhost: (data: DragData) => ReactNode;
  children: ReactNode;
}) {
  const zones = useRef(new Map<string, View | null>());
  const strips = useRef(new Map<string, { ref: View | null; handle: StripHandle }>());
  const zoneRects = useRef(new Map<string, Rect>());
  const stripRects = useRef(new Map<string, Rect>());
  const root = useRef<View>(null);
  const rootOffset = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const data = useRef<DragData | null>(null);
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const refresh = useCallback(async () => {
    await Promise.all([
      ...[...zones.current].map(async ([id, ref]) => {
        const r = await measure(ref);
        if (r) zoneRects.current.set(id, r);
        else zoneRects.current.delete(id);
      }),
      ...[...strips.current].map(async ([id, s]) => {
        const r = await measure(s.ref);
        if (r) stripRects.current.set(id, r);
      }),
    ]);
  }, []);

  const hit = (x: number, y: number) => {
    let found: string | null = null;
    for (const [id, r] of zoneRects.current) if (inside(r, x, y)) found = id;
    return found;
  };

  const dnd = useMemo<Dnd>(
    () => ({
      hover,
      dragging,
      registerZone: (id, ref) => {
        if (ref) zones.current.set(id, ref);
        else {
          zones.current.delete(id);
          zoneRects.current.delete(id);
        }
      },
      registerStrip: (id, ref, handle) => {
        if (ref) strips.current.set(id, { ref, handle });
        else {
          strips.current.delete(id);
          stripRects.current.delete(id);
        }
      },
      begin: (d, x, y) => {
        data.current = d;
        last.current = { x, y };
        setDragging(d);
        setPos({ x, y });
        hapticSelect();
        void (async () => {
          const r = await measure(root.current);
          if (r) rootOffset.current = { x: r.x, y: r.y };
          await refresh();
          setHover(hit(last.current.x, last.current.y));
        })();
      },
      move: (x, y) => {
        last.current = { x, y };
        setPos({ x, y });
        setHover(hit(x, y));
      },
      end: (x, y, cancelled) => {
        const d = data.current;
        data.current = null;
        void (async () => {
          // Rechtecke frisch lesen: die Leisten können beim Ziehen weitergeblättert sein
          await refresh();
          const target = cancelled ? null : hit(x, y);
          setDragging(null);
          setHover(null);
          if (d) {
            hapticSelect();
            onDropRef.current(d, target);
          }
        })();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hover, dragging, refresh],
  );

  // Während des Ziehens: Leisten am Rand weiterblättern und die Rechtecke aktuell halten
  useEffect(() => {
    if (!dragging) return;
    const timer = setInterval(() => {
      const { x, y } = last.current;
      for (const [id, r] of stripRects.current) {
        if (y < r.y || y > r.y + r.h || x < r.x || x > r.x + r.w) continue;
        const handle = strips.current.get(id)?.handle;
        if (x > r.x + r.w - 36) handle?.scrollBy(10);
        else if (x < r.x + 36) handle?.scrollBy(-10);
      }
      void refresh().then(() => setHover(hit(x, y)));
    }, 80);
    return () => clearInterval(timer);
  }, [dragging, refresh]);

  return (
    <DndContext.Provider value={dnd}>
      <View ref={root} collapsable={false} style={{ flex: 1 }}>
        {children}
        {dragging ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: pos.x - rootOffset.current.x - 26,
              top: pos.y - rootOffset.current.y - 58,
              zIndex: 100,
            }}
          >
            {renderGhost(dragging)}
          </View>
        ) : null}
      </View>
    </DndContext.Provider>
  );
}

/** Fläche, auf die Spieler abgelegt werden; `children` bekommt, ob gerade etwas darüber schwebt. */
export function DropZone({
  id,
  style,
  children,
  accessible,
  ...rest
}: {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode | ((over: boolean) => ReactNode);
  accessible?: boolean;
}) {
  const dnd = useDnd();
  const ref = useRef<View>(null);
  useEffect(() => {
    dnd?.registerZone(id, ref.current);
    return () => dnd?.registerZone(id, null);
    // nur bei Änderung der Id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const over = dnd?.hover === id;
  return (
    <View ref={ref} collapsable={false} style={style} accessible={accessible} {...rest}>
      {typeof children === 'function' ? children(over) : children}
    </View>
  );
}

/** Seitlich scrollende Leiste: meldet sich zum automatischen Weiterblättern am Rand an. */
export function useStrip(id: string) {
  const dnd = useDnd();
  const view = useRef<View>(null);
  const scroller = useRef<{ scrollTo: (o: { x: number; animated: boolean }) => void } | null>(null);
  const offset = useRef(0);
  useEffect(() => {
    dnd?.registerStrip(id, view.current, {
      scrollBy: (dx) =>
        scroller.current?.scrollTo({ x: Math.max(0, offset.current + dx), animated: false }),
    });
    return () => dnd?.registerStrip(id, null, { scrollBy: () => undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return { view, scroller, offset };
}

/** Ziehbarer Spieler. Ohne Ziehen bleibt das Antippen (`onPress`) beim Inhalt. */
export function Draggable({
  data,
  disabled,
  inStrip,
  style,
  children,
}: {
  data: DragData;
  disabled?: boolean;
  /** liegt in einer seitlich scrollenden Leiste */
  inStrip?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const dnd = useDnd();
  const latest = useRef({ data, dnd, inStrip, disabled });
  latest.current = { data, dnd, inStrip, disabled };
  const active = useRef(false);
  const [lifted, setLifted] = useState(false);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => {
          const l = latest.current;
          if (l.disabled || !l.dnd) return false;
          const dx = Math.abs(g.dx);
          const dy = Math.abs(g.dy);
          // Touch in einer Leiste: seitliches Wischen scrollt die Leiste, senkrechtes Ziehen hebt heraus
          const coarse =
            Platform.OS !== 'web' ||
            (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
          if (l.inStrip && coarse) return dy > 8 && dy > dx;
          return Math.hypot(dx, dy) > 6;
        },
        onPanResponderTerminationRequest: () => !active.current,
        onPanResponderGrant: (e, g) => {
          const l = latest.current;
          active.current = true;
          setLifted(true);
          const p = pointer(e, g);
          l.dnd?.begin(l.data, p.x, p.y);
        },
        onPanResponderMove: (e, g) => {
          const p = pointer(e, g);
          latest.current.dnd?.move(p.x, p.y);
        },
        onPanResponderRelease: (e, g) => {
          const p = pointer(e, g);
          active.current = false;
          setLifted(false);
          latest.current.dnd?.end(p.x, p.y, false);
        },
        onPanResponderTerminate: (e, g) => {
          const p = pointer(e, g);
          active.current = false;
          setLifted(false);
          latest.current.dnd?.end(p.x, p.y, true);
        },
      }),
    [],
  );
  return (
    <View
      {...responder.panHandlers}
      collapsable={false}
      style={[
        style,
        { opacity: lifted ? 0.35 : 1 },
        // Browser: bei Leisten nur seitliches Wischen selbst behandeln, auf dem Feld gar nichts
        ...(Platform.OS === 'web'
          ? [{ touchAction: inStrip ? 'pan-x' : 'none', userSelect: 'none' } as object]
          : []),
      ]}
    >
      {children}
    </View>
  );
}
