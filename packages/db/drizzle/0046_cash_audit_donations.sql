CREATE TABLE "club_audit_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"entry_id" uuid,
	"kind" text NOT NULL,
	"text" text,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_audit_findings_auditId_entryId_unique" UNIQUE("audit_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "club_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"fund_id" uuid,
	"started_by_person_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"conclusion" text
);
--> statement-breakpoint
CREATE TABLE "club_donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"person_id" uuid,
	"donor_name" text NOT NULL,
	"donor_address" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"donated_on" date NOT NULL,
	"waiver" boolean DEFAULT false NOT NULL,
	"receipt_no" text,
	"issued_at" timestamp with time zone,
	"issued_by_person_id" uuid,
	"receipt_snapshot" jsonb,
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_donations_clubId_receiptNo_unique" UNIQUE("club_id","receipt_no")
);
--> statement-breakpoint
CREATE TABLE "club_tax_info" (
	"club_id" uuid PRIMARY KEY NOT NULL,
	"tax_office" text,
	"tax_number" text,
	"exemption_kind" text,
	"exemption_date" date,
	"exemption_period" text,
	"purposes" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_person_id" uuid,
	"review_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_audit_findings" ADD CONSTRAINT "club_audit_findings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_audit_findings" ADD CONSTRAINT "club_audit_findings_audit_id_club_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."club_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_audit_findings" ADD CONSTRAINT "club_audit_findings_entry_id_club_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."club_cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_audit_findings" ADD CONSTRAINT "club_audit_findings_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_audits" ADD CONSTRAINT "club_audits_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_audits" ADD CONSTRAINT "club_audits_fund_id_club_cash_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."club_cash_funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_audits" ADD CONSTRAINT "club_audits_started_by_person_id_persons_id_fk" FOREIGN KEY ("started_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_donations" ADD CONSTRAINT "club_donations_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_donations" ADD CONSTRAINT "club_donations_entry_id_club_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."club_cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_donations" ADD CONSTRAINT "club_donations_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_donations" ADD CONSTRAINT "club_donations_issued_by_person_id_persons_id_fk" FOREIGN KEY ("issued_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_donations" ADD CONSTRAINT "club_donations_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_tax_info" ADD CONSTRAINT "club_tax_info_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_tax_info" ADD CONSTRAINT "club_tax_info_reviewed_by_person_id_persons_id_fk" FOREIGN KEY ("reviewed_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_audit_findings_audit_id_index" ON "club_audit_findings" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "club_audits_club_id_year_index" ON "club_audits" USING btree ("club_id","year");--> statement-breakpoint
CREATE INDEX "club_donations_club_id_donated_on_index" ON "club_donations" USING btree ("club_id","donated_on");