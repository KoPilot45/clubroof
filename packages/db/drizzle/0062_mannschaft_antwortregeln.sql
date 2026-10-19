ALTER TABLE "teams" ADD COLUMN "reminder_hours" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "decline_reason_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "allow_maybe" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "welcome_text" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "match_format" smallint;