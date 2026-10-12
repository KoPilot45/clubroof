CREATE TABLE "club_cash_fund_units" (
	"fund_id" uuid NOT NULL,
	"org_unit_id" uuid NOT NULL,
	CONSTRAINT "club_cash_fund_units_fund_id_org_unit_id_pk" PRIMARY KEY("fund_id","org_unit_id")
);
--> statement-breakpoint
CREATE TABLE "club_cash_funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_cash_accounts" ADD COLUMN "fund_id" uuid;--> statement-breakpoint
ALTER TABLE "club_fee_types" ADD COLUMN "fund_id" uuid;--> statement-breakpoint
ALTER TABLE "club_cash_fund_units" ADD CONSTRAINT "club_cash_fund_units_fund_id_club_cash_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."club_cash_funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_fund_units" ADD CONSTRAINT "club_cash_fund_units_org_unit_id_org_units_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_cash_funds" ADD CONSTRAINT "club_cash_funds_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_cash_funds_club_id_index" ON "club_cash_funds" USING btree ("club_id");--> statement-breakpoint
ALTER TABLE "club_cash_accounts" ADD CONSTRAINT "club_cash_accounts_fund_id_club_cash_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."club_cash_funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_types" ADD CONSTRAINT "club_fee_types_fund_id_club_cash_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."club_cash_funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "club_cash_funds" ("club_id", "name", "is_main", "sort_order")
SELECT DISTINCT "club_id", 'Hauptkasse', true, 0 FROM "club_cash_accounts";--> statement-breakpoint
UPDATE "club_cash_accounts" a SET "fund_id" = f."id" FROM "club_cash_funds" f WHERE f."club_id" = a."club_id" AND f."is_main";--> statement-breakpoint
ALTER TABLE "club_cash_accounts" ALTER COLUMN "fund_id" SET NOT NULL;
