ALTER TABLE "invitations" ADD COLUMN "guardian_access" text;--> statement-breakpoint
ALTER TABLE "guardianships" ADD COLUMN "access" text DEFAULT 'manage' NOT NULL;--> statement-breakpoint
ALTER TABLE "guardianships" ADD COLUMN "access_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guardianships" ADD COLUMN "requested_access" text;--> statement-breakpoint
ALTER TABLE "guardianships" ADD COLUMN "requested_at" timestamp with time zone;