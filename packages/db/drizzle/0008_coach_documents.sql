-- Trainer dürfen Dokumente für ihre Mannschaft hochladen (Festlegung 05.10.2026)
UPDATE "roles"
SET "permissions" = array_append("permissions", 'documents.manage')
WHERE "key" = 'coach'
  AND "is_system" = true
  AND NOT ('documents.manage' = ANY("permissions"));
