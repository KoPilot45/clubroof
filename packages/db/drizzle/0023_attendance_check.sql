ALTER TABLE "event_participants" ADD COLUMN "attended" boolean;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "attendance_recorded_at" timestamp with time zone;