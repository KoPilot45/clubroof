/**
 * Berechtigungskatalog. Rollen sind Sammlungen dieser Berechtigungen und werden immer mit einem
 * Geltungsbereich (Verein, Bereich oder Mannschaft) vergeben. Geprüft wird ausschließlich
 * serverseitig; die Apps blenden nur aus.
 */
export const PERMISSIONS = {
  // Verein & System
  'club.settings.manage': 'Vereinsstammdaten, Design und Systemeinstellungen verwalten',
  'club.modules.manage': 'Module aktivieren, deaktivieren und konfigurieren',
  'club.roles.manage': 'Rollen und Rechte vergeben',
  'club.audit.read': 'Audit-Log einsehen',
  'club.overview.read': 'Vereinsmonitor und Kennzahlen einsehen',

  // Mitglieder
  'members.read': 'Mitgliederliste einsehen',
  'members.manage': 'Stammdaten, Ein- und Austritte, Mannschaftszuordnung pflegen',
  'members.invite': 'Personen einladen',

  // Mannschaften & Sport
  'teams.manage': 'Mannschaften anlegen und konfigurieren',
  'teams.modules.manage': 'Module der eigenen Mannschaft ein- und ausschalten',
  'teams.season.plan': 'Saisonplanung und Kadergrößen',
  'teams.transfers.manage': 'Spielerbewegungen verwalten',
  'squad.manage': 'Kader, Aufstellung und Nominierungen verwalten',
  'squad.demand.manage': 'Spielerbedarf melden und Angebote abgeben',

  // Termine
  'events.manage': 'Termine anlegen, ändern und absagen',
  'attendance.read': 'Zu- und Absagen der Mannschaft einsehen',
  'attendance.override': 'Zu- und Absagen stellvertretend korrigieren',
  'absences.read': 'Abwesenheitsgründe einsehen',

  // Kommunikation
  'news.create': 'News verfassen',
  'news.publish': 'News freigeben und veröffentlichen',
  'polls.manage': 'Umfragen erstellen und auswerten',
  'forum.moderate': 'Forumsthemen erstellen und moderieren',

  // Finanzen
  'cash.read': 'Kasse einsehen',
  'cash.manage': 'Buchungen, Strafen und Getränke erfassen',
  'cash.fines': 'Strafenkatalog pflegen und Strafen vergeben',

  // Vereinsfinanzen (Vereinskasse, getrennt von den Mannschaftskassen)
  'clubcash.read': 'Vereinskasse einsehen (Kassenbuch, Konten, Auswertungen)',
  'clubcash.manage': 'Vereinskasse führen: buchen, Konten, Kategorien und Kostenstellen verwalten',
  'clubcash.audit': 'Vereinskasse prüfen (Stichproben, Prüfvermerke)',

  // Betrieb
  'facilities.manage': 'Platzbelegung, Sperrungen, Material und Schlüssel verwalten',
  'documents.manage': 'Dokumente hochladen und verwalten',
  'helpers.manage': 'Helferdienste und Aufgaben planen',
  'referees.manage': 'Schiedsrichter, Verfügbarkeit und Zuweisungen verwalten',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

/** Gruppen für die Auswahlliste der individuellen Rechte (Reihenfolge wie in der Verwaltung). */
export const PERMISSION_GROUPS: { title: string; keys: Permission[] }[] = [
  {
    title: 'Verein & System',
    keys: [
      'club.settings.manage',
      'club.modules.manage',
      'club.roles.manage',
      'club.audit.read',
      'club.overview.read',
    ],
  },
  { title: 'Mitglieder', keys: ['members.read', 'members.manage', 'members.invite'] },
  {
    title: 'Mannschaften & Sport',
    keys: [
      'teams.manage',
      'teams.modules.manage',
      'teams.season.plan',
      'teams.transfers.manage',
      'squad.manage',
      'squad.demand.manage',
    ],
  },
  {
    title: 'Termine',
    keys: ['events.manage', 'attendance.read', 'attendance.override', 'absences.read'],
  },
  {
    title: 'Kommunikation',
    keys: ['news.create', 'news.publish', 'polls.manage', 'forum.moderate'],
  },
  { title: 'Finanzen', keys: ['cash.read', 'cash.manage', 'cash.fines'] },
  { title: 'Vereinsfinanzen', keys: ['clubcash.read', 'clubcash.manage', 'clubcash.audit'] },
  {
    title: 'Betrieb',
    keys: ['facilities.manage', 'documents.manage', 'helpers.manage', 'referees.manage'],
  },
];
