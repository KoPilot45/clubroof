import Svg, { G, Mask, Rect, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { FIGURE_FONT } from '@/lib/fonts';

/**
 * Plakat-Hintergrund (Paket AL): das Vereinskürzel als Wasserzeichen – Umriss 2,5 px bei 20 % Weiß plus 5 %
 * Füllung, leicht gedreht (−6°), immer auf dieselbe Breite gesetzt (ca. 320 von 390), die Höhe folgt der
 * Zeichenzahl. Ohne Kürzel erscheinen Rasenstreifen. Die Zeichnung liegt hinter dem Text.
 */
const SIZE_BY_LENGTH: Record<number, { size: number; width: number; x: number }> = {
  2: { size: 340, width: 300, x: 45 },
  3: { size: 270, width: 320, x: 35 },
  4: { size: 210, width: 320, x: 35 },
};

export function PosterMark({ code }: { code?: string | null }) {
  const c = (code ?? '').trim();
  const spec = SIZE_BY_LENGTH[c.length];
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 390 450"
      preserveAspectRatio="xMidYMax slice"
      style={{ position: 'absolute', left: 0, top: 0 }}
      aria-hidden
    >
      {spec ? (
        <G rotation={-6} origin="195, 240">
          <SvgText
            x={spec.x}
            y={365}
            textLength={spec.width}
            lengthAdjust="spacingAndGlyphs"
            fontFamily={FIGURE_FONT}
            fontSize={spec.size}
            fill="rgba(255,255,255,0.05)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={2.5}
          >
            {c}
          </SvgText>
        </G>
      ) : (
        <>
          <Defs>
            <LinearGradient id="stripeFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
              <Stop offset="0.8" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <Mask id="stripeMask">
              <Rect width="390" height="450" fill="url(#stripeFade)" />
            </Mask>
          </Defs>
          <G mask="url(#stripeMask)" rotation={-16} origin="195, 225">
            {Array.from({ length: 14 }, (_, i) => (
              <Rect key={i} x={-120 + i * 70} y={-140} width={35} height={760} fill="#FFFFFF" />
            ))}
          </G>
        </>
      )}
    </Svg>
  );
}
