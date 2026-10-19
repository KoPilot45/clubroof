ALTER TABLE "clubs" ADD COLUMN "nonprofit" boolean;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "fee_reminder_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "fee_reminder_text" text;