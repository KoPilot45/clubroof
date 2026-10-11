CREATE TABLE "club_fee_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"fee_type_id" uuid NOT NULL,
	"amount_override_cents" integer,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_fee_dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"fee_type_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"period_label" text NOT NULL,
	"due_on" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"reminder_level" integer DEFAULT 0 NOT NULL,
	"reminded_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_fee_dues_assignmentId_dueOn_unique" UNIQUE("assignment_id","due_on")
);
--> statement-breakpoint
CREATE TABLE "club_fee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"due_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_fee_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"interval" text NOT NULL,
	"category_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_fee_assignments" ADD CONSTRAINT "club_fee_assignments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_assignments" ADD CONSTRAINT "club_fee_assignments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_assignments" ADD CONSTRAINT "club_fee_assignments_fee_type_id_club_fee_types_id_fk" FOREIGN KEY ("fee_type_id") REFERENCES "public"."club_fee_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_dues" ADD CONSTRAINT "club_fee_dues_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_dues" ADD CONSTRAINT "club_fee_dues_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_dues" ADD CONSTRAINT "club_fee_dues_fee_type_id_club_fee_types_id_fk" FOREIGN KEY ("fee_type_id") REFERENCES "public"."club_fee_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_dues" ADD CONSTRAINT "club_fee_dues_assignment_id_club_fee_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."club_fee_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_payments" ADD CONSTRAINT "club_fee_payments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_payments" ADD CONSTRAINT "club_fee_payments_due_id_club_fee_dues_id_fk" FOREIGN KEY ("due_id") REFERENCES "public"."club_fee_dues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_payments" ADD CONSTRAINT "club_fee_payments_entry_id_club_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."club_cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_types" ADD CONSTRAINT "club_fee_types_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_fee_types" ADD CONSTRAINT "club_fee_types_category_id_club_cash_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."club_cash_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_fee_assignments_club_id_index" ON "club_fee_assignments" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_fee_assignments_person_id_index" ON "club_fee_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "club_fee_dues_club_id_due_on_index" ON "club_fee_dues" USING btree ("club_id","due_on");--> statement-breakpoint
CREATE INDEX "club_fee_dues_person_id_index" ON "club_fee_dues" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "club_fee_payments_due_id_index" ON "club_fee_payments" USING btree ("due_id");--> statement-breakpoint
CREATE INDEX "club_fee_types_club_id_index" ON "club_fee_types" USING btree ("club_id");