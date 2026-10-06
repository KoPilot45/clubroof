import type { ScopeType } from './scopes';

/**
 * Zustände eines Moduls (Konzept §8): aktiviert, verfügbar aber deaktiviert, übergeordnet gesperrt.
 * Neue Module sind standardmäßig `available` und werden erst nach bewusstem Setup aktiv (§13).
 */
export const MODULE_STATES = ['enabled', 'available', 'locked'] as const;
export type ModuleState = (typeof MODULE_STATES)[number];

/** Komplexitätsstufen (Konzept §8). */
export const MODULE_LEVELS = ['off', 'basic', 'extended', 'custom'] as const;
export type ModuleLevel = (typeof MODULE_LEVELS)[number];

export type ModuleDefinition = {
  key: string;
  name: string;
  description: string;
  /** Ebenen, auf denen das Modul konfiguriert werden kann. */
  scopes: ScopeType[];
  /** Kernmodule sind immer aktiv und nicht abschaltbar. */
  core?: boolean;
};

export const MODULES = [
  // Kern
  {
    key: 'events',
    name: 'Termine & Teilnahme',
    description: 'Training, Spiele, Zu-/Absagen, Fristen',
    scopes: ['club', 'team'],
    core: true,
  },
  {
    key: 'news',
    name: 'News',
    description: 'Ankündigungen für Verein, Bereiche und Mannschaften',
    scopes: ['club', 'org_unit', 'team'],
    core: true,
  },
  {
    key: 'absences',
    name: 'Abwesenheiten',
    description: 'Urlaub, Verletzung, Krankheit, Schule/Beruf',
    scopes: ['club'],
    core: true,
  },
  // Mannschaft
  {
    key: 'squad',
    name: 'Kader & Aufstellung',
    description: 'Nominierung, Positionen, Aufstellung',
    scopes: ['team'],
  },
  {
    key: 'guest_players',
    name: 'Gastspieler',
    description: 'Spieler anderer Mannschaften für einzelne Termine',
    scopes: ['club', 'team'],
  },
  {
    key: 'statistics',
    name: 'Statistik',
    description: 'Mannschafts- und Spielerstatistiken',
    scopes: ['team'],
  },
  {
    key: 'team_cash',
    name: 'Mannschaftskasse',
    description: 'Saldo, Strafen, Getränke, Einzahlungen',
    scopes: ['team'],
  },
  {
    key: 'team_tasks',
    name: 'Mannschaftsaufgaben',
    description: 'Fahrdienst, Trikotwäsche, Kuchen – wer übernimmt was',
    scopes: ['club', 'team'],
  },
  {
    key: 'jersey_numbers',
    name: 'Feste Rückennummern',
    description: 'Saisonweit oder spielbezogen',
    scopes: ['team'],
  },
  {
    key: 'parent_access',
    name: 'Elternzugänge',
    description: 'Eltern sehen und verwalten Termine ihrer Kinder',
    scopes: ['org_unit', 'team'],
  },
  {
    key: 'training_planning',
    name: 'Trainingsplanung',
    description: 'Übungen, Schwerpunkte, Trainingsbibliothek',
    scopes: ['team'],
  },
  // Verein
  {
    key: 'polls',
    name: 'Umfragen',
    description: 'Abstimmungen mit Frist und Ergebnis',
    scopes: ['club', 'org_unit', 'team'],
  },
  {
    key: 'club_events',
    name: 'Veranstaltungen',
    description: 'Vereinsfeste, Turniere, Sitzungen',
    scopes: ['club'],
  },
  {
    key: 'helpers',
    name: 'Helfer & Aufgaben',
    description: 'Schichten und Aufgaben rund um Veranstaltungen',
    scopes: ['club'],
  },
  {
    key: 'documents',
    name: 'Dokumente',
    description: 'Satzung, Ordnungen, Formulare, Trainingspläne',
    scopes: ['club', 'team'],
  },
  {
    key: 'facility_booking',
    name: 'Platzbelegung',
    description: 'Plätze, Halle, Kabinen mit Konfliktprüfung',
    scopes: ['club'],
  },
  {
    key: 'player_exchange',
    name: 'Spielerbedarf / Gastspielerbörse',
    description: 'Bedarf und Angebote zwischen Mannschaften',
    scopes: ['club'],
  },
  {
    key: 'forum',
    name: 'Mini-Forum',
    description: 'Wenige, moderierte Diskussionsthemen',
    scopes: ['club'],
  },
  {
    key: 'calendar_export',
    name: 'Kalenderexport',
    description: 'Termine in externe Kalender übernehmen',
    scopes: ['club'],
  },
  {
    key: 'lost_and_found',
    name: 'Fundbüro',
    description: 'Gefundene Gegenstände auf der Anlage',
    scopes: ['club'],
  },
] as const satisfies readonly ModuleDefinition[];

export type ModuleKey = (typeof MODULES)[number]['key'];
