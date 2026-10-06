CREATE TABLE "cash_fine_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "fine_type_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_fine_types" ADD CONSTRAINT "cash_fine_types_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_fine_types" ADD CONSTRAINT "cash_fine_types_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_fine_types_team_id_index" ON "cash_fine_types" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_fine_type_id_cash_fine_types_id_fk" FOREIGN KEY ("fine_type_id") REFERENCES "public"."cash_fine_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Strafenkatalog: Trainer und Kassenwart pflegen ihn und vergeben Strafen (Festlegung 07.10.2026)
UPDATE "roles"
SET "permissions" = array_append("permissions", 'cash.fines')
WHERE "key" IN ('coach', 'treasurer')
  AND "is_system" = true
  AND NOT ('cash.fines' = ANY("permissions"));
