/**
 * Demodaten-Ausbau der Inhalte (Paket DEMODATEN-AUSBAU, Schritt 4): weitere Sponsoren mit Stufe im Text und
 * Archiv-Einträge zum Wiederherstellen (gelöschter Wiki-Artikel, Übung, Aufgabe, abgelaufener Sponsor, Dokument).
 */
import { addDays, toIsoDate } from '@clubroof/core';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import * as s from '../schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export async function seedInhalteAusbau(ctx: {
  tx: Tx;
  clubId: string;
  today: Date;
  adminUserId: string;
  b1TeamId: string;
  adminPersonId: string;
}) {
  const { tx, clubId, today } = ctx;

  // Sponsoren: Haupt-, Partner- und Förderstufe stehen im Beschreibungstext
  await tx.insert(s.sponsors).values([
    {
      clubId,
      name: 'Stadtwerke Musterstadt',
      slogan: 'Energie für den Sport',
      description:
        'Hauptsponsor des Vereins: Die Stadtwerke tragen unter anderem die Flutlichtanlage und das Jugend-Hallenturnier.',
      linkUrl: 'https://www.example.org/stadtwerke',
      advertise: true,
      startsOn: toIsoDate(addDays(today, -400)),
      sortOrder: 6,
    },
    {
      clubId,
      name: 'Autohaus Meyer GmbH',
      slogan: 'Ihr Autohaus im Landkreis',
      description:
        'Partner des Vereins mit Bandenwerbung auf Platz 1 und einem Trikotsatz der A-Jugend.',
      linkUrl: 'https://www.example.org/meyer',
      advertise: true,
      startsOn: toIsoDate(addDays(today, -250)),
      endsOn: toIsoDate(addDays(today, 115)),
      sortOrder: 7,
    },
  ]);

  // Archiv: Einträge, die sich wiederherstellen lassen (Abbild mit ursprünglicher ID)
  const [wiki] = await tx
    .select({ category: s.wikiPages.category })
    .from(s.wikiPages)
    .where(eq(s.wikiPages.clubId, clubId))
    .limit(1);
  const [exercise] = await tx
    .select({ category: s.exercises.category })
    .from(s.exercises)
    .where(eq(s.exercises.clubId, clubId))
    .limit(1);
  const created = addDays(today, -300).toISOString();
  const entry = (
    kind: string,
    label: string,
    detail: string,
    daysAgo: number,
    payload: Record<string, unknown>,
    teamId: string | null = null,
  ) => ({
    clubId,
    kind,
    teamId,
    originalId: randomUUID(),
    label,
    detail,
    payload,
    archivedByUserId: ctx.adminUserId,
    archivedAt: addDays(today, -daysAgo),
  });
  await tx.insert(s.archiveEntries).values([
    entry(
      'wiki',
      'Alte Platzordnung 2019',
      'Vereinswissen · ersetzt durch die neue Platzordnung',
      24,
      {
        title: 'Alte Platzordnung 2019',
        category: wiki?.category ?? 'Anlage',
        body: 'Diese Platzordnung wurde 2019 beschlossen und ist durch die aktuelle Fassung ersetzt.',
        updatedByPersonId: ctx.adminPersonId,
        createdAt: created,
        updatedAt: created,
      },
    ),
    entry('exercise', 'Rondo 4 gegen 2 (alte Fassung)', 'Übung · doppelt vorhanden', 18, {
      title: 'Rondo 4 gegen 2 (alte Fassung)',
      category: exercise?.category ?? 'technique',
      durationMinutes: 15,
      players: '6',
      material: 'Hütchen, 1 Ball',
      description: 'Vier Spieler halten den Ball gegen zwei Verteidiger im 8 × 8 m Feld.',
      createdByPersonId: ctx.adminPersonId,
      createdAt: created,
      editedAt: null,
    }),
    entry(
      'task',
      'Kabinenschlüssel nachmachen',
      'Aufgabe der B-Jugend · erledigt',
      12,
      {
        teamId: ctx.b1TeamId,
        title: 'Kabinenschlüssel nachmachen',
        note: 'Zwei Ersatzschlüssel für Kabine 3.',
        dueOn: toIsoDate(addDays(today, -20)),
        assigneePersonId: null,
        createdByPersonId: ctx.adminPersonId,
        doneAt: addDays(today, -15).toISOString(),
        doneByPersonId: null,
        createdAt: created,
      },
      ctx.b1TeamId,
    ),
    entry('sponsor', 'Reisebüro Sonnenschein', 'Sponsor · Laufzeit abgelaufen', 9, {
      name: 'Reisebüro Sonnenschein',
      slogan: 'Urlaub beginnt bei uns',
      description: 'Früherer Partner mit Werbung in der App.',
      linkUrl: 'https://www.example.org/sonnenschein',
      logoRef: null,
      logoDarkRef: null,
      advertise: true,
      hideForYouth: false,
      startsOn: toIsoDate(addDays(today, -800)),
      endsOn: toIsoDate(addDays(today, -60)),
      sortOrder: 9,
      createdAt: created,
    }),
    entry('document', 'Trainingsplan Sommer (alt)', 'Dokument · Plan der letzten Saison', 6, {
      scopeType: 'club',
      scopeId: null,
      category: 'training_plans',
      title: 'Trainingsplan Sommer (alt)',
      fileName: 'Trainingsplan_Sommer_alt.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 98_000,
      storageKey: 'demo/sv-gruen-weiss/documents/Trainingsplan_Sommer_alt.pdf',
      uploadedByPersonId: ctx.adminPersonId,
      createdAt: created,
      editedAt: null,
    }),
  ]);
}
