CREATE TABLE "announcement_likes" (
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_likes_announcement_id_user_id_pk" PRIMARY KEY("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_reads" (
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_announcement_id_user_id_pk" PRIMARY KEY("announcement_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_participants" ADD COLUMN "absence_id" uuid;--> statement-breakpoint
ALTER TABLE "announcement_likes" ADD CONSTRAINT "announcement_likes_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_likes" ADD CONSTRAINT "announcement_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_absence_id_absences_id_fk" FOREIGN KEY ("absence_id") REFERENCES "public"."absences"("id") ON DELETE set null ON UPDATE no action;