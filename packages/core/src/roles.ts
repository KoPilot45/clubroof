import { ALL_PERMISSIONS, type Permission } from './permissions';
import type { ScopeType } from './scopes';

export type SystemRoleTemplate = {
  key: string;
  name: string;
  description: string;
  /** Typischer Geltungsbereich, in dem die Rolle vergeben wird. */
  defaultScope: ScopeType;
  permissions: Permission[];
};

/** Standardrollen laut Konzept §7. Vereine können später eigene Rollen ergänzen. */
export const SYSTEM_ROLES: SystemRoleTemplate[] = [
  {
    key: 'fulladmin',
    name: 'Fulladmin',
    description: 'Gesamter Verein, Rollen, Module, Kommunikation, Systemeinstellungen, Updates',
    defaultScope: 'club',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'board',
    name: 'Vorstand / Vereinsleitung',
    description: 'Vereinsmonitor, Kommunikation, Mitglieder, Veranstaltungen, Dokumente',
    defaultScope: 'club',
    permissions: [
      'club.overview.read',
      'club.audit.read',
      'members.read',
      'members.invite',
      'events.manage',
      'news.create',
      'news.publish',
      'polls.manage',
      'forum.moderate',
      'documents.manage',
      'helpers.manage',
      'cash.read',
    ],
  },
  {
    key: 'sports_director',
    name: 'Sportliche Leitung',
    description: 'Kadergrößen, Spielerbewegungen, Trainer, Saisonplanung, Gastspielerlogik',
    defaultScope: 'club',
    permissions: [
      'club.overview.read',
      'members.read',
      'members.invite',
      'teams.manage',
      'teams.season.plan',
      'teams.transfers.manage',
      'squad.manage',
      'squad.demand.manage',
      'events.manage',
      'attendance.read',
    ],
  },
  {
    key: 'youth_director',
    name: 'Jugendleitung',
    description: 'Jugendteams, Trainerbedarf, Jahrgangsplanung, Saisonwechsel, Jugendkommunikation',
    defaultScope: 'org_unit',
    permissions: [
      'members.read',
      'members.invite',
      'teams.manage',
      'teams.season.plan',
      'teams.transfers.manage',
      'squad.demand.manage',
      'events.manage',
      'attendance.read',
      'news.create',
      'news.publish',
      'polls.manage',
    ],
  },
  {
    key: 'coach',
    name: 'Trainer',
    description:
      'Eigene Mannschaft, Termine, Kader, Training, Bedarf/Angebote, Statistik, Dokumente, News',
    defaultScope: 'team',
    permissions: [
      'members.invite',
      'squad.manage',
      'squad.demand.manage',
      'events.manage',
      'attendance.read',
      'attendance.override',
      'absences.read',
      'news.create',
      'polls.manage',
      'documents.manage',
      'cash.read',
    ],
  },
  {
    key: 'treasurer',
    name: 'Kassenwart',
    // Zusatzaufgabe: wird z. B. einem Spieler für seine Mannschaft vergeben (docs/ENTSCHEIDUNGEN.md)
    description: 'Zusatzaufgabe: Mannschaftskasse, Buchungen, Strafen/Getränke, Abrechnung',
    defaultScope: 'team',
    permissions: ['cash.read', 'cash.manage'],
  },
  {
    key: 'facility_manager',
    name: 'Platz-/Materialwart',
    description: 'Belegung, Sperrungen, Material, Schlüssel, Schäden, Aufgaben',
    defaultScope: 'club',
    permissions: ['facilities.manage', 'helpers.manage', 'news.create'],
  },
  {
    key: 'member_admin',
    name: 'Mitgliederverwaltung',
    description: 'Stammdaten, Ein-/Austritte, Profilprüfung, Mannschaftszuordnung',
    defaultScope: 'club',
    permissions: ['members.read', 'members.manage', 'members.invite'],
  },
  {
    key: 'referee_lead',
    name: 'Schiedsrichterobmann',
    description: 'Schiedsrichter, Verfügbarkeit, Zuweisungen, Lehrgänge',
    defaultScope: 'club',
    permissions: ['referees.manage', 'members.read'],
  },
];
