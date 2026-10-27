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