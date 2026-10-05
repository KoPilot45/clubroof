import { Linking } from 'react-native';

/** Holt einen kurzlebigen Download-Link und öffnet das Dokument (Browser bzw. System-Viewer). */
export async function openDocument(
  api: <T>(path: string) => Promise<T>,
  documentId: string,
): Promise<void> {
  const { url } = await api<{ url: string }>(`/documents/${documentId}/link`);
  await Linking.openURL(url);
}
