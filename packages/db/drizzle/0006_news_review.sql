ALTER TABLE "announcements" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "reviewed_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_reviewed_by_person_id_persons_id_fk" FOREIGN KEY ("reviewed_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;