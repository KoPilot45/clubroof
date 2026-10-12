CREATE TABLE "club_allowance_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_on" date NOT NULL,
	"entry_id" uuid NOT NULL,
	"note" text,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_expense_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"kilometers" integer,
	"expense_date" date NOT NULL,
	"receipt_ref" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"decided_by_person_id" uuid,
	"decided_at" timestamp with time zone,
	"reject_reason" text,
	"entry_id" uuid,
	"paid_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"grantor" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"proof_deadline" date,
	"proof_submitted_at" timestamp with time zone,
	"note" text,
	"entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"acquired_on" date,
	"cost_cents" integer,
	"location" text,
	"note" text,
	"entry_id" uuid,
	"disposed_at" timestamp with time zone,
	"disposed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_team_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"booked_on" date NOT NULL,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_cash_entries" ADD COLUMN "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "club_allowance_payments" ADD CONSTRAINT "club_allowance_payments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_allowance_payments" ADD CONSTRAINT "club_allowance_payments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_allowance_payments" ADD CONSTRAINT "club_allowance_payments_entry_id_club_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."club_cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_allowance_payments" ADD CONSTRAINT "club_allowance_payments_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_expense_claims" ADD CONSTRAINT "club_expense_claims_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_expense_claims" ADD CONSTRAINT "club_expense_claims_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_expense_claims" ADD CONSTRAINT "club_expense_claims_decided_by_person_id_persons_id_fk" FOREIGN KEY ("decided_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_expense_claims" ADD CONSTRAINT "club_expense_claims_entry_id_club_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."club_cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_grants" ADD CONSTRAINT "club_grants_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_grants" ADD CONSTRAINT "club_grants_entry_id_club_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."club_cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_inventory" ADD CONSTRAINT "club_inventory_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_inventory" ADD CONSTRAINT "club_inventory_entry_id_club_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."club_cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_team_grants" ADD CONSTRAINT "club_team_grants_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_team_grants" ADD CONSTRAINT "club_team_grants_entry_id_club_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."club_cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_team_grants" ADD CONSTRAINT "club_team_grants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_team_grants" ADD CONSTRAINT "club_team_grants_transaction_id_cash_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."cash_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_team_grants" ADD CONSTRAINT "club_team_grants_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_allowance_payments_club_id_year_index" ON "club_allowance_payments" USING btree ("club_id","year");--> statement-breakpoint
CREATE INDEX "club_allowance_payments_person_id_index" ON "club_allowance_payments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "club_expense_claims_club_id_status_index" ON "club_expense_claims" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "club_expense_claims_person_id_index" ON "club_expense_claims" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "club_grants_club_id_status_index" ON "club_grants" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "club_inventory_club_id_index" ON "club_inventory" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_team_grants_club_id_index" ON "club_team_grants" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_team_grants_team_id_index" ON "club_team_grants" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "club_cash_entries" ADD CONSTRAINT "club_cash_entries_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;