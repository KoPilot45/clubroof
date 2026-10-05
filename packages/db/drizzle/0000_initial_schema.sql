CREATE TYPE "public"."absence_kind" AS ENUM('vacation', 'injury', 'illness', 'school_work', 'suspended', 'other');--> statement-breakpoint
CREATE TYPE "public"."announcement_priority" AS ENUM('info', 'important', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('yes', 'no', 'maybe', 'pending');--> statement-breakpoint
CREATE TYPE "public"."cash_direction" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."club_color" AS ENUM('green', 'red', 'blue', 'yellow', 'black');--> statement-breakpoint
CREATE TYPE "public"."color_mode" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."contact_visibility" AS ENUM('club', 'team_and_coaches', 'coaches_only');--> statement-breakpoint
CREATE TYPE "public"."deadline_kind" AS ENUM('relative', 'weekday_time');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('regulations', 'forms', 'training_plans', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('training', 'match', 'tournament', 'team_event', 'club_event', 'meeting', 'work_assignment');--> statement-breakpoint
CREATE TYPE "public"."facility_kind" AS ENUM('grass_pitch', 'artificial_pitch', 'hall', 'clubhouse', 'other');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'inactive', 'left');--> statement-breakpoint
CREATE TYPE "public"."module_level" AS ENUM('off', 'basic', 'extended', 'custom');--> statement-breakpoint
CREATE TYPE "public"."module_state" AS ENUM('enabled', 'available', 'locked');--> statement-breakpoint
CREATE TYPE "public"."notification_level" AS ENUM('urgent', 'important', 'action', 'info');--> statement-breakpoint
CREATE TYPE "public"."org_unit_kind" AS ENUM('seniors', 'youth', 'women', 'veterans', 'other');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('player', 'coach', 'guest_player');--> statement-breakpoint
CREATE TYPE "public"."participation_mode" AS ENUM('auto_accept', 'active_response', 'absences_only');--> statement-breakpoint
CREATE TYPE "public"."poll_result_visibility" AS ENUM('always', 'after_vote', 'after_close');--> statement-breakpoint
CREATE TYPE "public"."preferred_foot" AS ENUM('left', 'right', 'both');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('draft', 'pending_approval', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('club', 'org_unit', 'team');--> statement-breakpoint
CREATE TYPE "public"."team_function" AS ENUM('player', 'coach', 'assistant_coach', 'team_manager');--> statement-breakpoint
CREATE TYPE "public"."team_template" AS ENUM('performance', 'classic', 'youth', 'leisure');--> statement-breakpoint
CREATE TABLE "module_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid,
	"module_key" text NOT NULL,
	"state" "module_state" NOT NULL,
	"level" "module_level" DEFAULT 'basic' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_settings_clubId_scopeType_scopeId_moduleKey_unique" UNIQUE NULLS NOT DISTINCT("club_id","scope_type","scope_id","module_key")
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"permissions" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_clubId_key_unique" UNIQUE("club_id","key")
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"slug" text NOT NULL,
	"founded_year" integer,
	"logo_url" text,
	"color_theme" "club_color" DEFAULT 'green' NOT NULL,
	"color_mode" "color_mode" DEFAULT 'system' NOT NULL,
	"timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"street" text,
	"postal_code" text,
	"city" text,
	"email" text,
	"phone" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"kind" "facility_kind" NOT NULL,
	"address" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"kind" "org_unit_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid,
	"title" text NOT NULL,
	"teaser" text,
	"body" text NOT NULL,
	"image_url" text,
	"priority" "announcement_priority" DEFAULT 'info' NOT NULL,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"author_person_id" uuid,
	"published_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"level" "notification_level" NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_poll_id_person_id_pk" PRIMARY KEY("poll_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid,
	"question" text NOT NULL,
	"description" text,
	"closes_at" timestamp with time zone,
	"result_visibility" "poll_result_visibility" DEFAULT 'after_vote' NOT NULL,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "absence_kind" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"team_ids" uuid[],
	"note" text,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "participant_role" NOT NULL,
	"status" "attendance_status" NOT NULL,
	"reason" text,
	"guest_from_team_id" uuid,
	"responded_at" timestamp with time zone,
	"responded_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_participants_eventId_personId_unique" UNIQUE("event_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid,
	"org_unit_id" uuid,
	"type" "event_type" NOT NULL,
	"status" "event_status" DEFAULT 'scheduled' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"meeting_at" timestamp with time zone,
	"meeting_point" text,
	"facility_id" uuid,
	"location_text" text,
	"series_id" uuid,
	"image_url" text,
	"contact_person_id" uuid,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_details" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"club_id" uuid NOT NULL,
	"opponent_name" text NOT NULL,
	"opponent_logo_url" text,
	"is_home" boolean NOT NULL,
	"competition" text,
	"goals_for" smallint,
	"goals_against" smallint
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" "cash_direction" NOT NULL,
	"amount_cents" integer NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"counterparty" text,
	"is_charge" boolean DEFAULT false NOT NULL,
	"person_id" uuid,
	"booked_on" date NOT NULL,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid,
	"category" "document_category" NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helper_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helper_signups" (
	"shift_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "helper_signups_shift_id_person_id_pk" PRIMARY KEY("shift_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "guardianships" (
	"club_id" uuid NOT NULL,
	"guardian_person_id" uuid NOT NULL,
	"child_person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardianships_guardian_person_id_child_person_id_pk" PRIMARY KEY("guardian_person_id","child_person_id")
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_date" date,
	"email" text,
	"phone" text,
	"avatar_url" text,
	"member_number" text,
	"member_since" date,
	"membership_status" "membership_status" DEFAULT 'active' NOT NULL,
	"contact_visibility" "contact_visibility" DEFAULT 'team_and_coaches' NOT NULL,
	"preferred_foot" "preferred_foot",
	"position" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persons_clubId_userId_unique" UNIQUE("club_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "team_deadline_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"kind" "deadline_kind" NOT NULL,
	"minutes_before" integer,
	"weekday" smallint,
	"time_of_day" time,
	CONSTRAINT "team_deadline_rules_teamId_eventType_unique" UNIQUE("team_id","event_type")
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"function" "team_function" NOT NULL,
	"jersey_number" smallint,
	"is_primary_team" boolean DEFAULT true NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_memberships_teamId_personId_function_validFrom_unique" UNIQUE("team_id","person_id","function","valid_from")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"org_unit_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"badge" text NOT NULL,
	"age_group" text,
	"league" text,
	"template" "team_template" NOT NULL,
	"participation_mode" "participation_mode" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "module_settings" ADD CONSTRAINT "module_settings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_id_org_units_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."org_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_person_id_persons_id_fk" FOREIGN KEY ("author_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_guest_from_team_id_teams_id_fk" FOREIGN KEY ("guest_from_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_responded_by_person_id_persons_id_fk" FOREIGN KEY ("responded_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_unit_id_org_units_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_contact_person_id_persons_id_fk" FOREIGN KEY ("contact_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_details" ADD CONSTRAINT "match_details_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_details" ADD CONSTRAINT "match_details_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_account_id_cash_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_person_id_persons_id_fk" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_shifts" ADD CONSTRAINT "helper_shifts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_shifts" ADD CONSTRAINT "helper_shifts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_signups" ADD CONSTRAINT "helper_signups_shift_id_helper_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."helper_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_signups" ADD CONSTRAINT "helper_signups_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardianships" ADD CONSTRAINT "guardianships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardianships" ADD CONSTRAINT "guardianships_guardian_person_id_persons_id_fk" FOREIGN KEY ("guardian_person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardianships" ADD CONSTRAINT "guardianships_child_person_id_persons_id_fk" FOREIGN KEY ("child_person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_deadline_rules" ADD CONSTRAINT "team_deadline_rules_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_deadline_rules" ADD CONSTRAINT "team_deadline_rules_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_unit_id_org_units_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "module_settings_club_id_index" ON "module_settings" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "role_assignments_club_id_index" ON "role_assignments" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "role_assignments_person_id_index" ON "role_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "facilities_club_id_index" ON "facilities" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "org_units_club_id_index" ON "org_units" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "seasons_club_id_index" ON "seasons" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "announcements_club_id_published_at_index" ON "announcements" USING btree ("club_id","published_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_index" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "polls_club_id_index" ON "polls" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "absences_club_id_index" ON "absences" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "absences_person_id_starts_on_index" ON "absences" USING btree ("person_id","starts_on");--> statement-breakpoint
CREATE INDEX "event_participants_club_id_index" ON "event_participants" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "event_participants_person_id_index" ON "event_participants" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "events_club_id_starts_at_index" ON "events" USING btree ("club_id","starts_at");--> statement-breakpoint
CREATE INDEX "events_team_id_starts_at_index" ON "events" USING btree ("team_id","starts_at");--> statement-breakpoint
CREATE INDEX "audit_log_club_id_created_at_index" ON "audit_log" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE INDEX "cash_accounts_club_id_index" ON "cash_accounts" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "cash_transactions_account_id_booked_on_index" ON "cash_transactions" USING btree ("account_id","booked_on");--> statement-breakpoint
CREATE INDEX "cash_transactions_person_id_index" ON "cash_transactions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "documents_club_id_index" ON "documents" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "helper_shifts_club_id_index" ON "helper_shifts" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "helper_shifts_event_id_index" ON "helper_shifts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "guardianships_club_id_index" ON "guardianships" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "persons_club_id_index" ON "persons" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "persons_user_id_index" ON "persons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_deadline_rules_club_id_index" ON "team_deadline_rules" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "team_memberships_club_id_index" ON "team_memberships" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "team_memberships_team_id_index" ON "team_memberships" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_memberships_person_id_index" ON "team_memberships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "teams_club_id_index" ON "teams" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "teams_season_id_index" ON "teams" USING btree ("season_id");