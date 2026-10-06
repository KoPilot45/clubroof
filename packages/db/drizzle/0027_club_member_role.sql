-- Neue Hauptrolle „Vereinsmitglied“ für bestehende Vereine (Festlegung 07.10.2026)
INSERT INTO "roles" ("club_id", "key", "name", "description", "is_system", "permissions")
SELECT "id", 'club_member', 'Vereinsmitglied',
  'Engagiert im Verein ohne Amt oder Mannschaft: Vereinsüberblick, Veranstaltungen, News verfassen (zur Freigabe), keine Verwaltungsrechte',
  true, ARRAY['club.overview.read', 'news.create']
FROM "clubs"
ON CONFLICT ("club_id", "key") DO NOTHING;
