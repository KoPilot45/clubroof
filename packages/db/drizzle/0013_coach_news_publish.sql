-- Trainer veröffentlichen News für ihre Mannschaft ohne Freigabe (Festlegung 06.10.2026)
UPDATE "roles"
SET "permissions" = array_append("permissions", 'news.publish')
WHERE "key" = 'coach'
  AND "is_system" = true
  AND NOT ('news.publish' = ANY("permissions"));
