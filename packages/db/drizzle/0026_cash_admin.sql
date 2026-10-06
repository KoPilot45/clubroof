CREATE TABLE "cash_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"closed_on" date NOT NULL,
	"balance_cents" integer NOT NULL,
	"open_cents" integer NOT NULL,
	"auditor" text,
	"note" text,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"interval" text NOT NULL,
	"next_due_on" date,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_payment_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"payment_method" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_person_id" uuid,
	"decided_by_person_id" uuid,
	"decided_at" timestamp with time zone,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_accounts" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "fee_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "receipt_ref" text;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "cancelled_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_fees" ADD CONSTRAINT "cash_fees_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_fees" ADD CONSTRAINT "cash_fees_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_fees" ADD CONSTRAINT "cash_fees_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_payment_notices" ADD CONSTRAINT "cash_payment_notices_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_payment_notices" ADD CONSTRAINT "cash_payment_notices_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_payment_notices" ADD CONSTRAINT "cash_payment_notices_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_payment_notices" ADD CONSTRAINT "cash_payment_notices_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_payment_notices" ADD CONSTRAINT "cash_payment_notices_decided_by_person_id_persons_id_fk" FOREIGN KEY ("decided_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_payment_notices" ADD CONSTRAINT "cash_payment_notices_transaction_id_cash_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."cash_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_closings_team_id_index" ON "cash_closings" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "cash_fees_team_id_index" ON "cash_fees" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "cash_payment_notices_team_id_index" ON "cash_payment_notices" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_fee_id_cash_fees_id_fk" FOREIGN KEY ("fee_id") REFERENCES "public"."cash_fees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_cancelled_by_person_id_persons_id_fk" FOREIGN KEY ("cancelled_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Trainer führen die Mannschaftskasse mit (Kassenverwaltung, Festlegung 07.10.2026)
UPDATE "roles"
SET "permissions" = array_append("permissions", 'cash.manage')
WHERE "key" = 'coach'
  AND "is_system" = true
  AND NOT ('cash.manage' = ANY("permissions"));
