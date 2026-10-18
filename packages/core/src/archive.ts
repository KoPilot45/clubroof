/**
 * Archiv (Paket AR): Löschen heißt archivieren. Ein archivierter Eintrag liegt als Abbild im Archiv, lässt sich
 * ansehen und wiederherstellen; endgültig gelöscht wird nur auf Anstoß (Bereinigen, Archiv leeren), nie automatisch.
 */

export const ARCHIVE_KINDS = ['wiki', 'exercise'] as const;
export type ArchiveKind = (typeof ARCHIVE_KINDS)[number];

export const ARCHIVE_KIND_LABEL: Record<ArchiveKind, string> = {
  wiki: 'Wissensartikel',
  exercise: 'Übungen',
};

/**
 * Standardfrist in Jahren, nach der ein archivierter Eintrag zum Bereinigen angeboten wird. Für Inhalte ohne
 * gesetzliche Aufbewahrungspflicht gilt „nur solange nötig“ (Standard, rechtlich zu prüfen); Bücher und Belege
 * bekommen später zusätzlich eine Sperre (`retainUntil`), vor der sie nicht gelöscht werden können.
 */
export const ARCHIVE_RETENTION_YEARS: Record<ArchiveKind, number> = {
  wiki: 2,
  exercise: 2,
};

export type ArchiveEntry = {
  id: string;
  kind: ArchiveKind;
  /** Anzeigename des gelöschten Eintrags */
  label: string;
  /** Zusatzzeile, z. B. Kategorie */
  detail: string | null;
  archivedAt: string;
  archivedBy: string | null;
  /** Ab diesem Zeitpunkt wird der Eintrag zum Bereinigen angeboten (ISO) */
  dueAt: string;
  /** Gesetzliche Aufbewahrung läuft noch bis (ISO): bis dahin nicht endgültig löschbar */
  lockedUntil: string | null;
  canRestore: boolean;
  canPurge: boolean;
};

export type ArchiveOverview = {
  entries: ArchiveEntry[];
  /** Je Art: Anzahl, davon zum Bereinigen fällig */
  kinds: { kind: ArchiveKind; count: number; due: number }[];
  retentionYears: Record<ArchiveKind, number>;
};

export type RestoreArchiveInput = {
  /** Neuer Name, falls der alte inzwischen vergeben ist (nach Rückfrage) */
  newName?: string;
};

export type PurgeArchiveInput = {
  /** `due`: nur Fälliges bereinigen, `all`: Archiv leeren (Einträge mit laufender Frist bleiben) */
  mode: 'due' | 'all';
  kind?: ArchiveKind;
};

export type PurgeArchiveResult = {
  deleted: number;
  /** Wegen laufender Aufbewahrungsfrist behalten */
  kept: number;
  overview: ArchiveOverview;
};
