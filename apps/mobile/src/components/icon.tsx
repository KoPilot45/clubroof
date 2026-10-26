import { Ionicons as Base } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRtl } from '@/lib/i18n';

/** Symbole, die eine Richtung zeigen und in rechts-nach-links-Sprachen gespiegelt werden. */
const DIRECTIONAL =
  /^(chevron|arrow|caret|return)-(forward|back|up-forward)|^(play|log-in|log-out)(-|$)|-forward(-|$)|-back(-|$)/;

/** `Ionicons` mit Spiegelung der Richtungspfeile bei Arabisch. */
export function Ionicons({ style, ...props }: ComponentProps<typeof Base>) {
  const rtl = useRtl();
  const mirror = rtl && DIRECTIONAL.test(String(props.name));
  return <Base {...props} style={mirror ? [style, { transform: [{ scaleX: -1 }] }] : style} />;
}
Ionicons.glyphMap = Base.glyphMap;
