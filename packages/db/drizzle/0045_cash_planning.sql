CREATE TABLE "club_budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"category_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"planned_cents" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_budget_lines_fundId_year_categoryId_costCenterId_unique" UNIQUE NULLS NOT DISTINCT("fund_id","year","category_id","cost_center_id")
);
--> statement-breakpoint
CREATE TABLE "club_period_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"locked_at" timestamp with time zone NOT NULL,
	"locked_by_person_id" uuid,
	"unlocked_at" timestamp with time zone,
	"unlocked_by_person_id" uuid,
	"unlock_reason" text
);
--> statement-breakpoint
CREATE TABLE "club_reserve_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"reserve_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"booked_on" date NOT NULL,
	"note" text,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_reserves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_cents" integer,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_budget_lines" ADD CONSTRAINT "club_budget_lines_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_budget_lines" ADD CONSTRAINT "club_budget_lines_fund_id_club_cash_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."club_cash_funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_budget_lines" ADD CONSTRAINT "club_budget_lines_category_id_club_cash_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."club_cash_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_budget_lines" ADD CONSTRAINT "club_budget_lines_cost_center_id_club_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."club_cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_period_locks" ADD CONSTRAINT "club_period_locks_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_period_locks" ADD CONSTRAINT "club_period_locks_locked_by_person_id_persons_id_fk" FOREIGN KEY ("locked_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_period_locks" ADD CONSTRAINT "club_period_locks_unlocked_by_person_id_persons_id_fk" FOREIGN KEY ("unlocked_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_reserve_moves" ADD CONSTRAINT "club_reserve_moves_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_reserve_moves" ADD CONSTRAINT "club_reserve_moves_reserve_id_club_reserves_id_fk" FOREIGN KEY ("reserve_id") REFERENCES "public"."club_reserves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_reserve_moves" ADD CONSTRAINT "club_reserve_moves_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_reserves" ADD CONSTRAINT "club_reserves_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_reserves" ADD CONSTRAINT "club_reserves_fund_id_club_cash_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."club_cash_funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_budget_lines_club_id_year_index" ON "club_budget_lines" USING btree ("club_id","year");--> statement-breakpoint
CREATE INDEX "club_period_locks_club_id_year_index" ON "club_period_locks" USING btree ("club_id","year");--> statement-breakpoint
CREATE INDEX "club_reserve_moves_reserve_id_index" ON "club_reserve_moves" USING btree ("reserve_id");--> statement-breakpoint
CREATE INDEX "club_reserves_club_id_index" ON "club_reserves" USING btree ("club_id");