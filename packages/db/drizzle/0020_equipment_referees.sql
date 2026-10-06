ALTER TYPE "public"."facility_kind" ADD VALUE 'changing_room' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "damage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"facility_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"reported_by_person_id" uuid,
	"reported_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"location" text,
	"note" text,
	"holder_person_id" uuid,
	"handed_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referee_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text DEFAULT 'referee' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referees" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"club_id" uuid NOT NULL,
	"level" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "changing_room_id" uuid;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_reported_by_person_id_persons_id_fk" FOREIGN KEY ("reported_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_holder_person_id_persons_id_fk" FOREIGN KEY ("holder_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_assignments" ADD CONSTRAINT "referee_assignments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_assignments" ADD CONSTRAINT "referee_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_assignments" ADD CONSTRAINT "referee_assignments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referees" ADD CONSTRAINT "referees_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referees" ADD CONSTRAINT "referees_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "damage_reports_club_id_status_index" ON "damage_reports" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "equipment_items_club_id_kind_index" ON "equipment_items" USING btree ("club_id","kind");--> statement-breakpoint
CREATE INDEX "equipment_items_holder_person_id_index" ON "equipment_items" USING btree ("holder_person_id");--> statement-breakpoint
CREATE INDEX "referee_assignments_event_id_index" ON "referee_assignments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "referee_assignments_person_id_index" ON "referee_assignments" USING btree ("person_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_changing_room_id_facilities_id_fk" FOREIGN KEY ("changing_room_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;