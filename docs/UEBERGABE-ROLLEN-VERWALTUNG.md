# Übergabeprompt: Rollenverwaltung überarbeiten (Paket ROLLEN-VERWALTUNG)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **ROLLEN-VERWALTUNG** (`docs/PAKETE.md`, gleichnamige Zeile) macht die Rollenverwaltung übersichtlicher und funktionaler: Übersicht mit Rollen, Personen und Matrix, eigene Rollen je Verein, Rechtevorschau und die Mannschaftseinstellung für Abwesenheitsgründe.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile **ROLLEN-VERWALTUNG** vollständig lesen; Entwurf öffnen: `docs/design/anstoss/Rollen.html` (fünf Reiter; Internet für die Schriften nötig). Festlegungen: `docs/ROLLEN.md` Abschnitt 8.
3. Vorhandenes lesen: `packages/core/src/roles.ts`, `permissions.ts`, `access.ts`; `packages/db/src/schema/access.ts` (Tabellen `roles`, `role_assignments`, `person_permissions`); `apps/api/src/routes/admin.ts` (Rollen), `services` mit `actorCan`/`loadActor`; Bildschirme `admin/roles`, `admin/role/[key]`, `admin/member-permissions`, `admin/member/[id]`; Mannschaft bearbeiten; Absagen-Ausgabe (Teilnehmerliste, Kader-Pop-up, Abwesenheiten).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Server – eigene Rollen:** Spalten `scope_default`, `archived_at`, `known_permissions` (Migration, Seed); Routen zum Anlegen (leer oder als Kopie), Ändern, Löschen (mit Umstellen der Personen, Archiv); Schutzregeln (nur `club.roles.manage`; nur Rechte vergeben, die man selbst hat; Standardrollen schreibgeschützt; letzter Fulladmin geschützt; Schlüssel eindeutig; Namen 3–40 Zeichen; vereinsweite Rechte nicht in Mannschafts- und Abteilungsrollen); neue Rechte aus Updates in eigenen Rollen aus plus Hinweis; Protokoll und Benachrichtigung. Tests.
2. **Abwesenheitsgründe je Mannschaft:** Einstellung `absence_reasons_visible_to` (`staff` Standard, `team`); Trainerteam sieht Grund und Freitext immer; Eltern sehen die Gründe ihres Kindes; Server prüft in allen Ausgaben (Teilnehmerliste, Kader-Pop-up, Abwesenheiten); Einstellung in „Mannschaft bearbeiten“ (Abschnitt „Datenschutz in der Mannschaft“) mit Vorschau. Tests je Rolle und Einstellung.
3. **App – Übersicht:** Umschalter Rollen · Personen · Matrix, Hinweise (nur ein Fulladmin, Mannschaften ohne Kassenwart), Rollenkarten, Personenliste mit Filter, Matrix.
4. **App – Rolle anlegen, bearbeiten, löschen:** Dreischritt-Assistent (Baukasten `wizard.tsx`), Rechte nach Gruppen in Klartext mit Zähler und Warnung bei sensiblen Rechten, Reiter Rechte · Personen · Verlauf, Kopie anpassen für Standardrollen, Löschen mit Umstellen und Archiv.
5. **App – Person:** Rollen mit Bereich, Rolle vergeben mit Vorschau, Rechtevorschau „Was darf diese Person?“ (Darf / Darf nicht, Quelle).
6. **Abschluss:** Rollenmatrix der Standardrollen als Test, Hell und Dunkel, Desktop (Vorlagen aus `docs/DESKTOP-VORLAGEN.md`), Hilfe, Übersetzungen, `ROLLEN.md` und `FUNKTIONEN.md`.

**Nicht umsetzen:** neue Standardrollen, Forum-Moderation, Amtszeiten, Rollenvergabe durch den Vorstand ohne Admin-Recht.

## Abnahme
Bilder (dunkel, hell, Desktop) neben dem Entwurf; kurze Liste erledigt / abweichend / offen.
