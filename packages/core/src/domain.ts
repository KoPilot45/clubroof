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
