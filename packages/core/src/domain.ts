/** Fachliche Aufzählungen, die von Datenbank, API und Apps gemeinsam genutzt werden. */

export const TEAM_TEMPLATES = ['performance', 'classic', 'youth', 'leisure'] as const;
export type TeamTemplate = (typeof TEAM_TEMPLATES)[number];

/** Teilnahme-Modelle (Konzept §9). */
export const PARTICIPATION_MODES = ['auto_accept', 'active_response', 'absences_only'] as const;
export type ParticipationMode = (typeof PARTICIPATION_MODES)[number];

export const EVENT_TYPES = [
  'training',
  'match',
  'tournament',
  'team_event',
  'club_event',
  'meeting',
  'work_assignment',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const ATTENDANCE_STATUSES = ['yes', 'no', 'maybe', 'pending'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ABSENCE_KINDS = [
  'vacation',
  'injury',
  'illness',
  'school_work',
  'suspended',
  'other',
] as const;
export type AbsenceKind = (typeof ABSENCE_KINDS)[number];

export const TEAM_FUNCTIONS = ['player', 'coach', 'assistant_coach', 'team_manager'] as const;
export type TeamFunction = (typeof TEAM_FUNCTIONS)[number];

/** Benachrichtigungsebenen (Konzept §10). */
export const NOTIFICATION_LEVELS = ['urgent', 'important', 'action', 'info'] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export const ANNOUNCEMENT_PRIORITIES = ['info', 'important', 'urgent'] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const PLAYER_POSITIONS = [
  'Torwart',
  'Innenverteidigung',
  'Außenverteidigung',
  'Defensives Mittelfeld',
  'Zentrales Mittelfeld',
  'Offensives Mittelfeld',
  'Außenbahn',
  'Sturm',
] as const;
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export const CONTACT_VISIBILITIES = ['club', 'team_and_coaches', 'coaches_only'] as const;
export type ContactVisibility = (typeof CONTACT_VISIBILITIES)[number];

export const PREFERRED_FEET = ['left', 'right', 'both'] as const;
export type PreferredFoot = (typeof PREFERRED_FEET)[number];

/** Aufstellung: Startelf oder Auswechselbank. */
export const LINEUP_ROLES = ['starter', 'substitute'] as const;
export type LineupRole = (typeof LINEUP_ROLES)[number];

/** Ereignisse im Spielbericht. Gegentore werden nur als Ergebnis erfasst. */
export const MATCH_INCIDENT_KINDS = [
  'goal',
  'penalty_goal',
  'own_goal',
  'yellow',
  'yellow_red',
  'red',
] as const;
export type MatchIncidentKind = (typeof MATCH_INCIDENT_KINDS)[number];

/** Spielerbewegungen (Konzept §6): Wechsel im Verein, Leihe, Zugang und Abgang. */
export const TRANSFER_KINDS = ['internal', 'loan', 'join', 'leave'] as const;
export type TransferKind = (typeof TRANSFER_KINDS)[number];

/** Rückennummern: fest für die Saison, je Spiel oder gar nicht. */
export const JERSEY_MODES = ['season', 'match'] as const;
export type JerseyMode = (typeof JERSEY_MODES)[number];
