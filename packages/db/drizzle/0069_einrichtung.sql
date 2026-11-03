ALTER TABLE "clubs" ADD COLUMN "join_approval" text DEFAULT 'team_staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "fiscal_year_kind" text DEFAULT 'calendar' NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "claim_receipt_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "claim_second_approval_cents" integer;--> statement-breakpoint
ALTER TABLE "club_expense_claims" ADD COLUMN "first_approved_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "match_participation_mode" "participation_mode" DEFAULT 'auto_accept' NOT NULL;--> statement-breakpoint
ALTER TABLE "club_expense_claims" ADD CONSTRAINT "club_expense_claims_first_approved_by_person_id_persons_id_fk" FOREIGN KEY ("first_approved_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "teams" SET "match_participation_mode" = "participation_mode";
