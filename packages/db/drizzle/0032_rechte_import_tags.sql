CREATE TABLE "person_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"permissions" text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_permissions_personId_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE "schedule_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"created_by_person_id" uuid,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "match_details" ADD COLUMN "kind" text DEFAULT 'league' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "match_meeting_minutes" integer DEFAULT 60;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "training_meeting_minutes" integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "default_meeting_point" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "import_aliases" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "person_permissions" ADD CONSTRAINT "person_permissions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_permissions" ADD CONSTRAINT "person_permissions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_imports" ADD CONSTRAINT "schedule_imports_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_imports" ADD CONSTRAINT "schedule_imports_created_by_person_id_persons_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_permissions_club_id_index" ON "person_permissions" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "events_import_batch_id_index" ON "events" USING btree ("import_batch_id");--> statement-breakpoint
UPDATE "roles" SET "permissions" = array_remove("permissions", 'cash.read') WHERE "key" = 'board' AND "is_system" = true;
