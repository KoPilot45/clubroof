/**
 * Hochladen von Dokumenten und Bildern.
 *  - Dokumente: `documents.manage` für den gewählten Bereich (Verein, Bereich, Mannschaft).
 *  - News-Bilder: wer News schreiben darf. Vereinslogo: `club.settings.manage`.
 * Dateien landen unter `clubs/<club_id>/…` im Dateispeicher; der Typ wird am Inhalt geprüft.
 */
import { randomUUID } from 'node:crypto';
import {
  can,
  type UploadDocumentInput,
  type UploadImageInput,
  type UploadedImage,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import type { FileStorage } from '../storage/files';
import { mediaRef, resolveMediaUrl } from '../storage/media-links';
import { checkUpload } from '../storage/uploads';
import { newsPermissions } from './editorial';
import { loadScopeContext, requireScope, targetOf } from './scopes';

const MEDIA_KIND = { news: 'news_image', logo: 'club_logo' } as const;

async function audit(
  db: Db,
  actor: Actor,
  action: string,
  type: string,
  id: string,
  label: string,
  now: Date,
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: type,
    entityId: id,
    data: { label },
    createdAt: now,
  });
}

export async function uploadImage(
  db: Db,
  storage: FileStorage,
  actor: Actor,
  input: UploadImageInput,
  now: Date,
): Promise<UploadedImage> {
  if (input.purpose === 'news' && !newsPermissions(actor).write)
    throw forbidden('Bilder für News laden nur Verfasserinnen und Verfasser hoch.');
  if (input.purpose === 'logo' && !actorCan(actor, 'club.settings.manage'))
    throw forbidden('Das Vereinslogo ändert nur die Vereinsadministration.');
  const file = checkUpload('image', input.dataBase64, input.fileName);
  const id = randomUUID();
  const storageKey = `clubs/${actor.club.id}/media/${id}.${file.ext}`;
  await storage.write(storageKey, file.data);
  await db.insert(s.media).values({
    id,
    clubId: actor.club.id,
    kind: MEDIA_KIND[input.purpose],
    storageKey,
    mimeType: file.mimeType,
    sizeBytes: file.data.length,
    uploadedByPersonId: actor.person.id,
    createdAt: now,
  });
  return { id, url: resolveMediaUrl(actor.links, mediaRef(id), now)! };
}

/** Prüft, ob ein hochgeladenes Bild zum Verein und Zweck passt; liefert den Speicherwert. */
export async function mediaReference(
  db: Db,
  actor: Actor,
  id: string,
  purpose: keyof typeof MEDIA_KIND,
): Promise<string> {
  const [row] = await db
    .select({ id: s.media.id })
    .from(s.media)
    .where(
      and(
        eq(s.media.id, id),
        eq(s.media.clubId, actor.club.id),
        eq(s.media.kind, MEDIA_KIND[purpose]),
      ),
    );
  if (!row) throw new HttpError(400, 'invalid_image', 'Das Bild wurde nicht gefunden.');
  return mediaRef(id);
}

export async function setClubLogo(db: Db, actor: Actor, imageId: string | null, now: Date) {
  if (!actorCan(actor, 'club.settings.manage'))
    throw forbidden('Das Vereinslogo ändert nur die Vereinsadministration.');
  const logoUrl = imageId ? await mediaReference(db, actor, imageId, 'logo') : null;
  await db.update(s.clubs).set({ logoUrl }).where(eq(s.clubs.id, actor.club.id));
  await audit(
    db,
    actor,
    'club.logo',
    'club',
    actor.club.id,
    imageId ? 'Vereinslogo geändert' : 'Vereinslogo entfernt',
    now,
  );
  return { logoUrl: resolveMediaUrl(actor.links, logoUrl, now) };
}

export async function uploadDocument(
  db: Db,
  storage: FileStorage,
  actor: Actor,
  input: UploadDocumentInput,
  now: Date,
): Promise<{ id: string }> {
  const ctx = await loadScopeContext(db, actor);
  const { scopeId } = requireScope(
    actor,
    ctx,
    'documents.manage',
    input.scopeType,
    input.scopeId,
    'Für diesen Bereich darfst du keine Dokumente hochladen.',
  );
  const file = checkUpload('document', input.dataBase64, input.fileName);
  const id = randomUUID();
  const storageKey = `clubs/${actor.club.id}/documents/${id}.${file.ext}`;
  await storage.write(storageKey, file.data);
  await db.insert(s.documents).values({
    id,
    clubId: actor.club.id,
    scopeType: input.scopeType,
    scopeId,
    category: input.category,
    title: input.title.trim(),
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.data.length,
    storageKey,
    uploadedByPersonId: actor.person.id,
    createdAt: now,
  });
  await audit(
    db,
    actor,
    'document.uploaded',
    'document',
    id,
    `Dokument hochgeladen: ${input.title.trim()}`,
    now,
  );
  return { id };
}

export async function deleteDocument(
  db: Db,
  storage: FileStorage,
  actor: Actor,
  id: string,
  now: Date,
): Promise<void> {
  const [doc] = await db
    .select()
    .from(s.documents)
    .where(and(eq(s.documents.id, id), eq(s.documents.clubId, actor.club.id)));
  if (!doc) throw notFound('Das Dokument');
  const ctx = await loadScopeContext(db, actor);
  const target = targetOf(ctx, doc.scopeType, doc.scopeId);
  // Dokumente alter Saisons (Mannschaft nicht mehr aktuell) nur mit Vereinsrecht
  const allowed = target
    ? can(actor.grants, 'documents.manage', target)
    : actorCan(actor, 'documents.manage');
  if (!allowed) throw notFound('Das Dokument');
  await db.delete(s.documents).where(eq(s.documents.id, id));
  if (!doc.storageKey.startsWith('demo/')) await storage.remove(doc.storageKey);
  await audit(
    db,
    actor,
    'document.deleted',
    'document',
    id,
    `Dokument gelöscht: ${doc.title}`,
    now,
  );
}
