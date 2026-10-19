ALTER TABLE "teams" ALTER COLUMN "participation_mode" SET DATA TYPE text;--> statement-breakpoint
UPDATE "teams" SET "participation_mode" = 'auto_accept' WHERE "participation_mode" = 'absences_only';--> statement-breakpoint
DROP TYPE "public"."participation_mode";--> statement-breakpoint
CREATE TYPE "public"."participation_mode" AS ENUM('auto_accept', 'active_response');--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "participation_mode" SET DATA TYPE "public"."participation_mode" USING "participation_mode"::"public"."participation_mode";