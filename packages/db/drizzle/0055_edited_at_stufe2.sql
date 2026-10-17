ALTER TABLE "facility_blocks" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "board_items" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_demands" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_offers" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "edited_at" timestamp with time zone;