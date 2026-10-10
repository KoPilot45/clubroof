import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import type { IconName } from './ui';

/** Deutsche Mobilnummern (015x, 016x, 017x bzw. +4915…) – nur dort ist WhatsApp sinnvoll. */
function whatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  const international = digits.startsWith('+')
    ? digits.slice(1)
    : digits.startsWith('00')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? `49${digits.slice(1)}`
        : null;
  return international && /^491[567]\d{7,}$/.test(international) ? international : null;
}

function ActionButton({ icon, label, href }: { icon: IconName; label: string; href: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(href)}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.surfaceVariant : colors.primaryContainer,
      })}
    >
      <Ionicons name={icon} size={19} color={colors.onPrimaryContainer} />
    </Pressable>
  );
}

/** Runde Knöpfe zum Anrufen, Schreiben und für WhatsApp. */
export function ContactActions({
  name,
  phone,
  email,
}: {
  name: string;
  phone?: string | null;
  email?: string | null;
}) {
  const wa = phone ? whatsAppNumber(phone) : null;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {phone ? (
        <ActionButton
          icon="call"
          label={`${name} anrufen`}
          href={`tel:${phone.replace(/\s/g, '')}`}
        />
      ) : null}
      {wa ? (
        <ActionButton
          icon="logo-whatsapp"
          label={`${name} per WhatsApp`}
          href={`https://wa.me/${wa}`}
        />
      ) : null}
      {email ? (
        <ActionButton icon="mail" label={`E-Mail an ${name}`} href={`mailto:${email}`} />
      ) : null}
    </View>
  );
}
