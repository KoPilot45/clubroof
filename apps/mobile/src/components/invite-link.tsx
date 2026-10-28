import type { InviteLink } from '@clubroof/core';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Button, T } from '@/components/ui';
import { toGermanDate } from '@/lib/dates';
import { t } from '@/lib/i18n';

async function share(url: string, title: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
    return 'Link kopiert';
  }
  await Share.share({ message: `${title}: ${url}` });
  return null;
}

/** Einladungslink mit QR-Code, zum Kopieren oder Teilen. */
export function LinkCard({ link, title }: { link: InviteLink; title: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <View style={{ gap: 10, alignItems: 'center' }}>
      <View
        style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: 12 }}
        accessibilityLabel={t(`QR-Code: ${title}`)}
      >
        <SvgXml xml={link.qrSvg} width={200} height={200} />
      </View>
      <T variant="caption" style={{ textAlign: 'center' }}>
        {link.url}
      </T>
      {link.code ? (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T variant="caption">Oder in der App den Code eingeben:</T>
          <T variant="figure" selectable>
            {link.code}
          </T>
        </View>
      ) : null}
      <T variant="caption">gültig bis {toGermanDate(link.expiresAt.slice(0, 10))}</T>
      <Button
        label={copied ?? (Platform.OS === 'web' ? 'Link kopieren' : 'Link teilen')}
        variant="outline"
        icon="share-outline"
        onPress={() => void share(link.url, title).then(setCopied)}
      />
    </View>
  );
}
