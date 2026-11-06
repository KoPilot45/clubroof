ALTER TABLE "clubs" ALTER COLUMN "color_mode" SET DEFAULT 'light';
--> statement-breakpoint
UPDATE "clubs" SET "color_mode" = 'light' WHERE "color_mode" = 'system';
