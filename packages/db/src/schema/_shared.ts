import { timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  ABSENCE_KINDS,
  ANNOUNCEMENT_PRIORITIES,
  ATTENDANCE_STATUSES,
  EVENT_TYPES,
  MODULE_LEVELS,
  MODULE_STATES,
  NOTIFICATION_LEVELS,
  PARTICIPATION_MODES,
  SCOPE_TYPES,
  TEAM_FUNCTIONS,
  TEAM_TEMPLATES,
} from '@clubroof/core';
import { CLUB_COLOR_KEYS } from '@clubroof/design-tokens';
import { pgEnum } from 'drizzle-orm/pg-core';

export const id = () => uuid().primaryKey().defaultRandom();
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const clubColorEnum = pgEnum('club_color', CLUB_COLOR_KEYS);
export const scopeTypeEnum = pgEnum('scope_type', SCOPE_TYPES);
export const teamTemplateEnum = pgEnum('team_template', TEAM_TEMPLATES);
export const participationModeEnum = pgEnum('participation_mode', PARTICIPATION_MODES);
export const teamFunctionEnum = pgEnum('team_function', TEAM_FUNCTIONS);
export const eventTypeEnum = pgEnum('event_type', EVENT_TYPES);
export const attendanceStatusEnum = pgEnum('attendance_status', ATTENDANCE_STATUSES);
export const absenceKindEnum = pgEnum('absence_kind', ABSENCE_KINDS);
export const moduleStateEnum = pgEnum('module_state', MODULE_STATES);
export const moduleLevelEnum = pgEnum('module_level', MODULE_LEVELS);
export const notificationLevelEnum = pgEnum('notification_level', NOTIFICATION_LEVELS);
export const announcementPriorityEnum = pgEnum('announcement_priority', ANNOUNCEMENT_PRIORITIES);

export const orgUnitKindEnum = pgEnum('org_unit_kind', [
  'seniors',
  'youth',
  'women',
  'veterans',
  'other',
]);
export const colorModeEnum = pgEnum('color_mode', ['light', 'dark', 'system']);
export const membershipStatusEnum = pgEnum('membership_status', ['active', 'inactive', 'left']);
export const contactVisibilityEnum = pgEnum('contact_visibility', [
  'club',
  'team_and_coaches',
  'coaches_only',
]);
export const preferredFootEnum = pgEnum('preferred_foot', ['left', 'right', 'both']);
export const facilityKindEnum = pgEnum('facility_kind', [
  'grass_pitch',
  'artificial_pitch',
  'hall',
  'clubhouse',
  'other',
]);
export const eventStatusEnum = pgEnum('event_status', ['scheduled', 'cancelled']);
/** `attendee`: freiwillige Teilnahme an Vereinsveranstaltungen („Ich nehme teil“). */
export const participantRoleEnum = pgEnum('participant_role', [
  'player',
  'coach',
  'guest_player',
  'attendee',
]);
export const deadlineKindEnum = pgEnum('deadline_kind', ['relative', 'weekday_time']);
export const publicationStatusEnum = pgEnum('publication_status', [
  'draft',
  'pending_approval',
  'published',
  'archived',
]);
export const pollResultVisibilityEnum = pgEnum('poll_result_visibility', [
  'always',
  'after_vote',
  'after_close',
]);
export const cashDirectionEnum = pgEnum('cash_direction', ['income', 'expense']);
export const documentCategoryEnum = pgEnum('document_category', [
  'regulations',
  'forms',
  'training_plans',
  'other',
]);

export const demandStatusEnum = pgEnum('demand_status', ['open', 'cancelled']);
export const offerStatusEnum = pgEnum('offer_status', ['open', 'closed']);
