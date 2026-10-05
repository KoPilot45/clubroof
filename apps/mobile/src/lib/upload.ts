import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { API_URL } from './api';

export type PickedFile = {
  name: string;
  size: number | null;
  dataBase64: string;
  previewUri: string;
};

const TYPES = {
  document: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  image: ['image/png', 'image/jpeg', 'image/webp'],
  csv: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'],
};

/** Datei auswählen und als Base64 lesen. `null`, wenn abgebrochen. Prüfung erfolgt auf dem Server. */
export async function pickFile(kind: keyof typeof TYPES): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: TYPES[kind],
    copyToCacheDirectory: true,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  let data: string;
  if (Platform.OS === 'web') {
    // Im Browser liefert die Auswahl eine Data-URL („data:…;base64,XXXX“)
    data = (asset.base64 ?? '').replace(/^data:[^,]*,/, '');
  } else {
    data = await new File(asset.uri).base64();
  }
  return { name: asset.name, size: asset.size ?? null, dataBase64: data, previewUri: asset.uri };
}

/** Bildlinks der API sind relativ (`/files/…`); daraus wird eine vollständige Adresse. */
export const mediaUri = (url: string | null) =>
  url && url.startsWith('/') ? `${API_URL}${url}` : url;
