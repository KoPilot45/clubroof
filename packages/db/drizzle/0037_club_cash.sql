CREATE TABLE "club_cash_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"opening_balance_cents" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_cash_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"direction" text NOT NULL,
	"area" text NOT NULL,
	"archived_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_cash_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"booked_on" date NOT NULL,
	"category_id" uuid,
	"cost_center_id" uuid,
	"counterparty" text,
	"purpose" text NOT NULL,
	"receipt_no" text,
	"receipt_ref" text,
	"transfer_id" uuid,
	"created_by_person_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_person_id" uuid,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "club_cash_visibility" text DEFAULT 'treasury' NOT NULL;--> statement-breakpoint
ALTER TABLE "club_cash_accounts" ADD CONSTRAINT "club_cash_accounts_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_categories" ADD CONSTRAINT "club_cash_categories_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_entries" ADD CONSTRAINT "club_cash_entries_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_entries" ADD CONSTRAINT "club_cash_entries_account_id_club_cash_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."club_cash_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_entries" ADD CONSTRAINT "club_cash_entries_category_id_club_cash_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."club_cash_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_entries" ADD CONSTRAINT "club_cash_entries_cost_center_id_club_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."club_cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_entries" ADD CONSTRAINT "club_cash_entries_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_entries" ADD CONSTRAINT "club_cash_entries_cancelled_by_person_id_persons_id_fk" FOREIGN KEY ("cancelled_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cost_centers" ADD CONSTRAINT "club_cost_centers_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_cash_accounts_club_id_index" ON "club_cash_accounts" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_cash_categories_club_id_index" ON "club_cash_categories" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_cash_entries_club_id_booked_on_index" ON "club_cash_entries" USING btree ("club_id","booked_on");--> statement-breakpoint
CREATE INDEX "club_cash_entries_account_id_index" ON "club_cash_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "club_cost_centers_club_id_index" ON "club_cost_centers" USING btree ("club_id");--> statement-breakpoint
UPDATE "roles" SET "name" = 'Mannschaftskassenwart' WHERE "key" = 'treasurer';
--> statement-breakpoint
INSERT INTO "roles" ("club_id", "key", "name", "description", "is_system", "permissions")
SELECT "id", 'club_treasurer', 'Kassenwart (Verein)', 'Vereinskasse: Konten, Kassenbuch mit Belegen, Kategorien, Kostenstellen, Storno', true, ARRAY['clubcash.read','clubcash.manage'] FROM "clubs"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "roles" ("club_id", "key", "name", "description", "is_system", "permissions")
SELECT "id", 'cash_auditor', 'Kassenprüfer', 'Vereinskasse lesen und prüfen (Belege, Stichproben, Prüfvermerke)', true, ARRAY['clubcash.read','clubcash.audit'] FROM "clubs"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "roles" SET "permissions" = "permissions" || ARRAY['clubcash.read','clubcash.manage','clubcash.audit'] WHERE "key" = 'fulladmin';
