CREATE TABLE "archive_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"original_id" uuid NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"payload" jsonb NOT NULL,
	"archived_by_user_id" uuid,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retain_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "archive_entries" ADD CONSTRAINT "archive_entries_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_entries" ADD CONSTRAINT "archive_entries_archived_by_user_id_users_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archive_entries_club_id_kind_archived_at_index" ON "archive_entries" USING btree ("club_id","kind","archived_at");--> statement-breakpoint
UPDATE "roles" SET "permissions" = "permissions" || ARRAY['archive.read','archive.restore','archive.purge'] WHERE "key" = 'fulladmin' AND NOT ('archive.read' = ANY("permissions"));
