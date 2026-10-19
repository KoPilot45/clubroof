ALTER TABLE "roles" ADD COLUMN "scope_default" "scope_type" DEFAULT 'club' NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "known_permissions" text[];--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "absence_reasons_visible_to" text DEFAULT 'staff' NOT NULL;