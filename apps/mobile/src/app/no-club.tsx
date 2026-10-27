import type { AccountLinkCode } from '@clubroof/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { PublicShell } from '@/components/public-shell';
import { Button, Card, Chip, T } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';

/**
 * Konto ohne Verein: angemeldet, aber noch keinem Verein zugeordnet. Zwei Wege hinein: Einladungscode eingeben
 * oder scannen – oder sich vom Verein aufnehmen lassen (Code/QR-Code des Kontos, kurz gültig).
 */
export default function NoClubScreen() {
  const session = useSession();
  const [link, setLink] = useState<AccountLinkCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (session.status !== 'noClub') return null;
  const { account } = session;
  const showCode = async () => {
    setBusy(true);
    setError(null);
    try {
      setLink(await session.api<AccountLinkCode>('/account/link-code', { method: 'POST' }));
    } catch (e) {
      setError(e instanceof RequestError ? e.message : t('Das hat nicht geklappt.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <PublicShell
      title="Noch kein Verein"
      subtitle={t(`Das Konto ${account.user.email} ist keinem Verein zugeordnet.`)}
    >
      {account.requests.map((r) => (
        <Chip
          key={`${r.clubName}-${r.status}`}
          tone={r.status === 'pending' ? 'info' : 'urgent'}
          icon={r.status === 'pending' ? 'time-outline' : 'close-circle'}
          label={
            r.status === 'pending'
              ? t(`Deine Anfrage bei ${r.clubName} wartet auf Freigabe.`)
              : t(`Deine Anfrage bei ${r.clubName} wurde nicht freigegeben.`)
          }
        />
      ))}
      <Card style={{ gap: 10 }}>
        <T variant="label">Mit Einladung beitreten</T>
        <T variant="caption">
          Du hast von deinem Verein oder deiner Mannschaft einen Code oder QR-Code bekommen.
        </T>
        <Button
          label="Code eingeben oder scannen"
          icon="qr-code-outline"
          onPress={() => router.push('/join-code')}
        />
      </Card>
      <Card style={{ gap: 10 }}>
        <T variant="label">Vom Verein aufnehmen lassen</T>
        <T variant="caption">
          Zeige deinem Trainer oder der Vereinsverwaltung diesen Code. Sie nehmen dein Konto damit
          auf.
        </T>
        {link ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View
              style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: 12 }}
              accessibilityLabel={t('QR-Code zur Aufnahme in einen Verein')}
            >
              <SvgXml xml={link.qrSvg} width={200} height={200} />
            </View>
            <T variant="figure" selectable>
              {link.code}
            </T>
            <T variant="caption">{t(`Gültig bis ${formatTime(link.expiresAt)} Uhr`)}</T>
          </View>
        ) : (
          <Button
            label="Code anzeigen"
            variant="outline"
            icon="person-add-outline"
            loading={busy}
            onPress={() => void showCode()}
          />
        )}
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      </Card>
      {account.isOperator ? (
        <Button
          label="Betreiber-Konsole"
          variant="outline"
          icon="business-outline"
          onPress={() => router.push('/operator')}
        />
      ) : null}
      <Button label="Abmelden" variant="outline" onPress={() => void session.signOut()} />
    </PublicShell>
  );
}
