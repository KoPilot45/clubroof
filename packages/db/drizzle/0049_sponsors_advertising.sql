ALTER TABLE "sponsors" ALTER COLUMN "tier" SET DEFAULT 'partner';--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "slogan" text;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "logo_dark_ref" text;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "advertise" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "hide_for_youth" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Bisherige Banner liefen für alle laufenden Sponsoren: Werbung an; „Senioren“ (nicht Jugend) → nicht bei Jugendspielern
UPDATE "sponsors" SET "advertise" = true, "hide_for_youth" = ("scope" = 'seniors');
