CREATE TABLE "operator_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_user_id" uuid,
	"club_id" uuid,
	"action" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"granted_by_person_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_seen" DROP CONSTRAINT "user_seen_user_id_key_pk";--> statement-breakpoint
ALTER TABLE "calendar_feeds" DROP CONSTRAINT "calendar_feeds_pkey";--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_pkey";--> statement-breakpoint
ALTER TABLE "user_seen" ADD COLUMN "club_id" uuid;--> statement-breakpoint
UPDATE "user_seen" u SET "club_id" = (SELECT p."club_id" FROM "persons" p WHERE p."user_id" = u."user_id" ORDER BY p."created_at" LIMIT 1);--> statement-breakpoint
DELETE FROM "user_seen" WHERE "club_id" IS NULL;--> statement-breakpoint
ALTER TABLE "user_seen" ALTER COLUMN "club_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_user_id_club_id_pk" PRIMARY KEY("user_id","club_id");--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_club_id_pk" PRIMARY KEY("user_id","club_id");--> statement-breakpoint
ALTER TABLE "user_seen" ADD CONSTRAINT "user_seen_user_id_club_id_key_pk" PRIMARY KEY("user_id","club_id","key");--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "code_hash" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "active_club_id" uuid;--> statement-breakpoint
ALTER TABLE "operator_audit" ADD CONSTRAINT "operator_audit_operator_user_id_users_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_audit" ADD CONSTRAINT "operator_audit_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_granted_by_person_id_persons_id_fk" FOREIGN KEY ("granted_by_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operator_audit_club_id_created_at_index" ON "operator_audit" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE INDEX "support_grants_club_id_index" ON "support_grants" USING btree ("club_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_club_id_clubs_id_fk" FOREIGN KEY ("active_club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seen" ADD CONSTRAINT "user_seen_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_devices_club_id_index" ON "push_devices" USING btree ("club_id");--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_codeHash_unique" UNIQUE("code_hash");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_club_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_last_club_id_clubs_id_fk" FOREIGN KEY ("last_club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "club_setup_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"admin_email" text NOT NULL,
	"club_name_hint" text NOT NULL,
	"created_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"club_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_setup_invites_codeHash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "club_setup_invites" ADD CONSTRAINT "club_setup_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_setup_invites" ADD CONSTRAINT "club_setup_invites_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_setup_invites_admin_email_index" ON "club_setup_invites" USING btree ("admin_email");
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "code_encrypted" text;
--> statement-breakpoint
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
