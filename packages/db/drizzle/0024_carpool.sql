CREATE TABLE "carpool_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"driver_person_id" uuid NOT NULL,
	"seats" smallint NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carpool_offers_eventId_driverPersonId_unique" UNIQUE("event_id","driver_person_id")
);
--> statement-breakpoint
CREATE TABLE "carpool_passengers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carpool_passengers_eventId_personId_unique" UNIQUE("event_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "carpool_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carpool_requests_eventId_personId_unique" UNIQUE("event_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "carpool_offers" ADD CONSTRAINT "carpool_offers_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_offers" ADD CONSTRAINT "carpool_offers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_offers" ADD CONSTRAINT "carpool_offers_driver_person_id_persons_id_fk" FOREIGN KEY ("driver_person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_passengers" ADD CONSTRAINT "carpool_passengers_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_passengers" ADD CONSTRAINT "carpool_passengers_offer_id_carpool_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."carpool_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_passengers" ADD CONSTRAINT "carpool_passengers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_passengers" ADD CONSTRAINT "carpool_passengers_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "carpool_offers_club_id_index" ON "carpool_offers" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "carpool_passengers_offer_id_index" ON "carpool_passengers" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "carpool_requests_club_id_index" ON "carpool_requests" USING btree ("club_id");