ALTER TABLE "events" ADD COLUMN "lineup_size" smallint;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "lineup_formation" text;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD COLUMN "slot" smallint;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "lineup_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "match_lineups_event_id_slot_index" ON "match_lineups" USING btree ("event_id","slot") WHERE "match_lineups"."slot" is not null;