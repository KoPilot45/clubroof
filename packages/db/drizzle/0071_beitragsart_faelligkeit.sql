ALTER TABLE "club_fee_types" ADD COLUMN "due_day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "club_fee_types" ADD COLUMN "due_month" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "club_fee_types" ADD COLUMN "due_on" date;