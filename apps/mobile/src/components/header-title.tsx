import { Text } from '@/components/app-text';
import { HEADING_FONT } from '@/lib/fonts';

/** Kopfzeilentitel in Oswald; der Titel wird in der gewählten Sprache angezeigt. */
export const headerTitle =
  (color: string) =>
  ({ children }: { children: string }) => (
    <Text
      numberOfLines={1}
      accessibilityRole="header"
      style={{ color, fontFamily: HEADING_FONT, fontWeight: '400', fontSize: 20 }}
    >
      {children}
    </Text>
  );
