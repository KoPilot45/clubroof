import { TextField, T } from '@/components/ui';
import { View } from 'react-native';

/** Optionaler Maps-Link oder Koordinaten des Spielorts; der Button „Route“ im Termin öffnet damit die Karten-App. */
export function MapLinkField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <TextField
        label="Maps-Link oder Koordinaten (optional)"
        value={value}
        onChangeText={onChange}
        placeholder="https://maps.app.goo.gl/… oder 50.1234, 8.5678"
        maxLength={400}
        kind="url"
      />
      <T variant="caption">
        Tipp: Ort in der Karten-App suchen, „Teilen“ wählen und den Link hier einfügen. Ohne Link
        nutzt „Route“ die eingetragene Adresse.
      </T>
    </View>
  );
}
