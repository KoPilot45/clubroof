CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tier" text NOT NULL,
	"link_url" text,
	"logo_ref" text,
	"banner_ref" text,
	"scope" text DEFAULT 'club' NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "sponsor_label" text DEFAULT 'Anzeige' NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsors_club_id_sort_order_index" ON "sponsors" USING btree ("club_id","sort_order");