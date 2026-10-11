DROP TABLE "referee_assignments" CASCADE;--> statement-breakpoint
DELETE FROM "role_assignments" WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "key" = 'referee_lead');
--> statement-breakpoint
DELETE FROM "roles" WHERE "key" = 'referee_lead';
