CREATE TABLE "admin_recoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"not_before" timestamp with time zone NOT NULL,
	"objected_at" timestamp with time zone,
	"objected_by_person_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_recoveries" ADD CONSTRAINT "admin_recoveries_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_recoveries" ADD CONSTRAINT "admin_recoveries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_recoveries" ADD CONSTRAINT "admin_recoveries_objected_by_person_id_persons_id_fk" FOREIGN KEY ("objected_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_recoveries_club_id_index" ON "admin_recoveries" USING btree ("club_id");