ALTER TABLE "teams" ADD COLUMN "match_participation_mode" "participation_mode" DEFAULT 'auto_accept' NOT NULL;--> statement-breakpoint
UPDATE "teams" SET "match_participation_mode" = "participation_mode";
