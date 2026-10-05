CREATE TYPE "public"."demand_status" AS ENUM('open', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "player_demands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"count" smallint NOT NULL,
	"positions" text[] DEFAULT '{}' NOT NULL,
	"note" text,
	"status" "demand_status" DEFAULT 'open' NOT NULL,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer NOT NULL,
	"note" text,
	"status" "offer_status" DEFAULT 'open' NOT NULL,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_participants" ADD COLUMN "demand_id" uuid;--> statement-breakpoint
ALTER TABLE "player_demands" ADD CONSTRAINT "player_demands_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_demands" ADD CONSTRAINT "player_demands_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_demands" ADD CONSTRAINT "player_demands_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_demands" ADD CONSTRAINT "player_demands_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_offers" ADD CONSTRAINT "player_offers_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_offers" ADD CONSTRAINT "player_offers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_offers" ADD CONSTRAINT "player_offers_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_demands_club_id_status_index" ON "player_demands" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "player_demands_event_id_index" ON "player_demands" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "player_offers_club_id_day_index" ON "player_offers" USING btree ("club_id","day");--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_demand_id_player_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."player_demands"("id") ON DELETE set null ON UPDATE no action;