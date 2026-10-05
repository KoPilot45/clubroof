/**
 * Dateispeicher. Aktuell auf der Festplatte des Servers (Verzeichnis `UPLOADS_DIR`);
 * später austauschbar gegen einen S3-kompatiblen Speicher, ohne die Aufrufer zu ändern.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

export interface FileStorage {
  read(key: string): Promise<Buffer | null>;
  write(key: string, data: Buffer): Promise<void>;
}

export function diskStorage(root: string): FileStorage {
  const resolve = (key: string) => {
    const path = normalize(join(root, key));
    // Schutz vor Pfaden außerhalb des Speicherverzeichnisses
    if (!path.startsWith(normalize(root) + sep)) throw new Error('Ungültiger Speicherschlüssel.');
    return path;
  };
  return {
    async read(key) {
      try {
        return await readFile(resolve(key));
      } catch {
        return null;
      }
    },
    async write(key, data) {
      const path = resolve(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    },
  };
}

/** Kurzlebige, signierte Download-Links (Links funktionieren ohne Anmelde-Header). */
export function linkSigner(secret: string = randomBytes(32).toString('hex')) {
  const sign = (payload: string) =>
    createHmac('sha256', secret).update(payload).digest('base64url');
  return {
    create(documentId: string, expiresAt: Date): string {
      const payload = Buffer.from(
        JSON.stringify({ d: documentId, e: expiresAt.getTime() }),
      ).toString('base64url');
      return `${payload}.${sign(payload)}`;
    },
    verify(token: string, now: Date): string | null {
      const [payload, signature] = token.split('.');
      if (!payload || !signature) return null;
      const expected = Buffer.from(sign(payload));
      const given = Buffer.from(signature);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      try {
        const { d, e } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
          d: string;
          e: number;
        };
        return e > now.getTime() ? d : null;
      } catch {
        return null;
      }
    },
  };
}

export type LinkSigner = ReturnType<typeof linkSigner>;

/** Einfache einseitige PDF als Platzhalter für Demodokumente ohne hochgeladene Datei. */
export function placeholderPdf(title: string, clubName: string): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const lines = [
    { size: 22, y: 760, text: title },
    { size: 12, y: 730, text: clubName },
    { size: 11, y: 690, text: 'Dies ist ein Platzhalter aus dem Demoverein.' },
    {
      size: 11,
      y: 672,
      text: 'Im echten Betrieb erscheint hier das vom Verein hochgeladene Dokument.',
    },
  ];
  const content = lines
    .map((l) => `BT /F1 ${l.size} Tf 56 ${l.y} Td (${esc(l.text)}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // WinAnsi ≈ Latin-1: deutsche Umlaute werden korrekt dargestellt
  return Buffer.from(pdf, 'latin1');
}
