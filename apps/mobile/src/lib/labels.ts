import type { AbsenceKind, AttendanceStatus, EventType, TeamFunction } from '@clubroof/core';
import type { IconName } from '@/components/ui';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  training: 'Training',
  match: 'Spiel',
  tournament: 'Turnier',
  team_event: 'Teamevent',
  club_event: 'Veranstaltung',
  meeting: 'Sitzung',
  work_assignment: 'Arbeitseinsatz',
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  yes: 'Zugesagt',
  no: 'Abgesagt',
  maybe: 'Unsicher',
  pending: 'Offen',
};

export const TEAM_FUNCTION_LABELS: Record<TeamFunction, string> = {
  player: 'Spieler',
  coach: 'Trainer',
  assistant_coach: 'Co-Trainer',
  team_manager: 'Betreuer',
};

export const ABSENCE_LABELS: Record<AbsenceKind, string> = {
  vacation: 'Urlaub',
  injury: 'Verletzt',
  illness: 'Krank',
  school_work: 'Schule/Beruf',
  suspended: 'Gesperrt',
  other: 'Sonstiges',
};

/** Vorschläge für den Absagegrund (Freitext bleibt möglich). */
export const DECLINE_REASONS = [
  'Arbeit',
  'Schule',
  'Krank',
  'Verletzt',
  'Urlaub',
  'Familie',
  'Sonstiges',
];

export const ABSENCE_ICONS: Record<AbsenceKind, IconName> = {
  vacation: 'airplane-outline',
  injury: 'bandage-outline',
  illness: 'thermometer-outline',
  school_work: 'school-outline',
  suspended: 'card-outline',
  other: 'ellipsis-horizontal',
};
