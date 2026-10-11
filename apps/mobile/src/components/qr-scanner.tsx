/** QR-Scanner für Einladungen (Paket LG): Kamera mit Rahmen; erkennt nur QR-Codes und meldet den ersten Treffer. */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { View } from 'react-native';
import { Button, T } from '@/components/ui';
import { useTheme } from '@/lib/theme';

export function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (data: string) => void;
  onClose: () => void;
}) {
  const { colors, radii } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={{ gap: 12 }}>
        <T>Zum Scannen braucht Clubroof Zugriff auf die Kamera. Das Bild wird nicht gespeichert.</T>
        <Button
          label="Kamera erlauben"
          icon="camera-outline"
          onPress={() => void requestPermission()}
        />
        <Button label="Stattdessen Code eingeben" variant="outline" onPress={onClose} />
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          aspectRatio: 1,
          borderRadius: radii.xl,
          overflow: 'hidden',
          backgroundColor: '#000',
          borderWidth: 3,
          borderColor: colors.primary,
        }}
      >
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(result) => {
            if (done.current) return;
            done.current = true;
            onScan(result.data);
          }}
        />
      </View>
      <T variant="caption" style={{ textAlign: 'center' }}>
        Halte die Kamera auf den QR-Code deiner Einladung.
      </T>
      <Button label="Abbrechen" variant="outline" onPress={onClose} />
    </View>
  );
}
