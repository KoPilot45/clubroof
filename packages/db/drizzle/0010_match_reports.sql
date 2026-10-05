CREATE TYPE "public"."lineup_role" AS ENUM('starter', 'substitute');--> statement-breakpoint
CREATE TYPE "public"."match_incident_kind" AS ENUM('goal', 'penalty_goal', 'own_goal', 'yellow', 'yellow_red', 'red');--> statement-breakpoint
CREATE TYPE "public"."transfer_kind" AS ENUM('internal', 'loan', 'join', 'leave');--> statement-breakpoint
CREATE TABLE "match_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" "match_incident_kind" NOT NULL,
	"person_id" uuid,
	"assist_person_id" uuid,
	"minute" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_lineups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "lineup_role" NOT NULL,
	"position" text,
	"jersey_number" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_lineups_eventId_personId_unique" UNIQUE("event_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "player_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "transfer_kind" NOT NULL,
	"from_team_id" uuid,
	"to_team_id" uuid,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"external_club" text,
	"note" text,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_details" ADD COLUMN "lineup_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_details" ADD COLUMN "report_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_incidents" ADD CONSTRAINT "match_incidents_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_incidents" ADD CONSTRAINT "match_incidents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_incidents" ADD CONSTRAINT "match_incidents_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_incidents" ADD CONSTRAINT "match_incidents_assist_person_id_persons_id_fk" FOREIGN KEY ("assist_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_from_team_id_teams_id_fk" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_to_team_id_teams_id_fk" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_transfers" ADD CONSTRAINT "player_transfers_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_incidents_event_id_index" ON "match_incidents" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "match_incidents_person_id_index" ON "match_incidents" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "match_lineups_club_id_index" ON "match_lineups" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "player_transfers_club_id_starts_on_index" ON "player_transfers" USING btree ("club_id","starts_on");--> statement-breakpoint
CREATE INDEX "player_transfers_person_id_index" ON "player_transfers" USING btree ("person_id");