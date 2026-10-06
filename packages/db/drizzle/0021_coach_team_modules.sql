-- Trainer stellen die Module ihrer Mannschaft selbst ein (Festlegung 07.10.2026)
UPDATE "roles"
SET "permissions" = array_append("permissions", 'teams.modules.manage')
WHERE "key" IN ('coach', 'fulladmin')
  AND "is_system" = true
  AND NOT ('teams.modules.manage' = ANY("permissions"));
