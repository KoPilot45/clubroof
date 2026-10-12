import { useId, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, Mask, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Waben-Muster (Stil „Anstoß“, Entwurf `DarkBg4`): Sechsecke mit Umkreisradius 26, Linie weiß 2 px.
 * Oben rechts am deutlichsten, nach links und unten ausgeblendet. Liegt hinter dem Inhalt eines Heros,
 * nie hinter Listen, Feldern oder Fließtext. `poster`: Deckkraft 0,24, sonst (Hero-Block) 0,18.
 */
const R = 26;

function cells(width: number, height: number) {
  const out: string[] = [];
  const cols = Math.ceil(width / (1.5 * R)) + 2;
  const rows = Math.ceil(height / (2 * 0.866 * R)) + 2;
  for (let i = -1; i < cols; i++) {
    for (let j = -1; j < rows; j++) {
      const cx = -19 + 1.5 * R * i;
      const cy = -22.5 + 2 * 0.866 * R * j + (i % 2 ? 0.866 * R : 0);
      const pts = [
        [cx + R, cy],
        [cx + R / 2, cy + 0.866 * R],
        [cx - R / 2, cy + 0.866 * R],
        [cx - R, cy],
        [cx - R / 2, cy - 0.866 * R],
        [cx + R / 2, cy - 0.866 * R],
      ];
      out.push(pts.map(([x, y]) => `${x!.toFixed(1)},${y!.toFixed(1)}`).join(' '));
    }
  }
  return out;
}

export function Honeycomb({ poster }: { poster?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} aria-hidden>
          <Defs>
            <RadialGradient id={`${id}g`} cx="1" cy="0" r="0.9" gradientTransform="scale(1 1.2778)">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.35} />
              <Stop offset="0.78" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            <Mask id={`${id}m`}>
              <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id}g)`} />
            </Mask>
          </Defs>
          <G mask={`url(#${id}m)`} opacity={poster ? 0.24 : 0.18}>
            {cells(size.w, size.h).map((points, i) => (
              <Polygon key={i} points={points} fill="none" stroke="#FFFFFF" strokeWidth={2} />
            ))}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
