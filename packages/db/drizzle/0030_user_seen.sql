CREATE TABLE "user_seen" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_seen_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "user_seen" ADD CONSTRAINT "user_seen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;