CREATE TABLE "referee_duties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" text,
	"absence_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referee_settings" (
	"club_id" uuid PRIMARY KEY NOT NULL,
	"required_referees" integer DEFAULT 0 NOT NULL,
	"required_matches" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referees" ADD COLUMN "license_valid_until" date;--> statement-breakpoint
ALTER TABLE "referee_duties" ADD CONSTRAINT "referee_duties_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_duties" ADD CONSTRAINT "referee_duties_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_duties" ADD CONSTRAINT "referee_duties_absence_id_absences_id_fk" FOREIGN KEY ("absence_id") REFERENCES "public"."absences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_settings" ADD CONSTRAINT "referee_settings_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referee_duties_person_id_starts_at_index" ON "referee_duties" USING btree ("person_id","starts_at");--> statement-breakpoint
CREATE INDEX "referee_duties_club_id_index" ON "referee_duties" USING btree ("club_id");