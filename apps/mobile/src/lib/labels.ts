import type { AttendanceStatus, EventType, TeamFunction } from '@clubroof/core';

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
