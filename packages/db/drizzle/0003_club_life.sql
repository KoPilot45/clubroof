ALTER TYPE "public"."participant_role" ADD VALUE 'attendee';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "program" jsonb;