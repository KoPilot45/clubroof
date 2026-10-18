ALTER TABLE "archive_entries" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "archive_entries" ADD CONSTRAINT "archive_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
UPDATE "roles" SET "permissions" = "permissions" || ARRAY['archive.read','archive.restore'] WHERE "key" = 'coach' AND NOT ('archive.read' = ANY("permissions"));
