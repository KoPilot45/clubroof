/**
 * Prüfung hochgeladener Dateien. Der Dateityp wird aus dem Inhalt (Signatur) bestimmt, nicht aus
 * Dateiname oder Angabe des Geräts. SVG, HTML und ausführbare Formate werden nie angenommen.
 */
import { HttpError } from '../errors';

export type FileKind = 'document' | 'image';

type Detected = { mimeType: string; ext: string };

const MB = 1024 * 1024;
export const UPLOAD_LIMITS: Record<FileKind, number> = { document: 10 * MB, image: 5 * MB };

const startsWith = (data: Buffer, bytes: number[], offset = 0) =>
  bytes.every((b, i) => data[offset + i] === b);

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function detect(data: Buffer, fileName: string): Detected | null {
  if (startsWith(data, ascii('%PDF-'))) return { mimeType: 'application/pdf', ext: 'pdf' };
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mimeType: 'image/png', ext: 'png' };
  if (startsWith(data, [0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg', ext: 'jpg' };
  if (startsWith(data, ascii('RIFF')) && startsWith(data, ascii('WEBP'), 8))
    return { mimeType: 'image/webp', ext: 'webp' };
  // Office-Dateien sind ZIP-Container; Typ nur für die bekannten Endungen übernehmen
  if (startsWith(data, [0x50, 0x4b, 0x03, 0x04])) {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'docx')
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext,
      };
    if (ext === 'xlsx')
      return { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext };
  }
  return null;
}

const ALLOWED: Record<FileKind, string[]> = {
  document: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  image: ['image/png', 'image/jpeg', 'image/webp'],
};

/** Dateiname ohne Pfadanteile und Steuerzeichen, mit zum Inhalt passender Endung. */
export function safeFileName(name: string, ext: string): string {
  const base = [...(name.split(/[\\/]/).pop() ?? 'datei')]
    // Steuerzeichen und in Dateinamen problematische Zeichen entfernen
    .filter((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) !== 0x7f && !'"<>|:*?'.includes(c))
    .join('')
    .replace(/\.[^.]*$/, '')
    .trim()
    .slice(0, 100);
  return `${base || 'datei'}.${ext}`;
}

export function checkUpload(
  kind: FileKind,
  dataBase64: string,
  fileName: string,
): { data: Buffer; mimeType: string; ext: string; fileName: string } {
  const data = Buffer.from(dataBase64, 'base64');
  if (data.length === 0) throw new HttpError(400, 'empty_file', 'Die Datei ist leer.');
  if (data.length > UPLOAD_LIMITS[kind]) {
    throw new HttpError(
      413,
      'file_too_large',
      `Die Datei ist zu groß (höchstens ${UPLOAD_LIMITS[kind] / MB} MB).`,
    );
  }
  const detected = detect(data, fileName);
  if (!detected || !ALLOWED[kind].includes(detected.mimeType)) {
    throw new HttpError(
      415,
      'file_type',
      kind === 'image'
        ? 'Bitte ein Bild im Format JPG, PNG oder WebP hochladen.'
        : 'Erlaubt sind PDF, Word (.docx), Excel (.xlsx), JPG und PNG.',
    );
  }
  return { data, ...detected, fileName: safeFileName(fileName, detected.ext) };
}
