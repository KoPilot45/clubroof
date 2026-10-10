ALTER TYPE "public"."facility_kind" ADD VALUE 'hard_pitch' BEFORE 'hall';--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venues_club_id_index" ON "venues" USING btree ("club_id");--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;