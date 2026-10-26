# Übergabeprompt: Admin-Verwaltung und Vereinskasse auch in „Ich“ (Paket ICH-VERWALTUNGSZUGAENGE)

Zum Einfügen in die Umsetzungssitzung. Kleines Paket, eine Sitzung.

---

Paket **ICH-VERWALTUNGSZUGAENGE** (`docs/PAKETE.md`, gleichnamige Zeile). Hintergrund: NAVIGATION-NEUORDNUNG hat die zwei Knöpfe **Admin-Verwaltung** (violett) und **Vereinskasse** (blau) aus „Ich“ nach „Verein → Meine Vereinsaufgaben“ verschoben (`apps/mobile/src/app/(tabs)/verein.tsx`). Entscheidung 26.10.2026: Sie sollen **an beiden Orten** erreichbar sein; in „Ich“ erscheinen sie wieder für alle mit der passenden Berechtigung.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Lesen: Zeile AV in `docs/PAKETE.md` und `docs/FUNKTIONEN.md` (alter Zustand), `app/(tabs)/mehr.tsx` („Ich“), `app/(tabs)/verein.tsx` (Gruppe `admin`, Variable `taskTiles`), `lib/admin-tiles.ts` (`adminFunctionTiles`), `lib/areas.ts` (`canOpenClubCash`), `git log -p` des Commits 797a544 für den früheren Aufbau der Knöpfe unter dem Profil.

## Aufgaben
1. **Gemeinsamer Baustein:** Die Logik „welche Zugänge darf diese Person sehen“ (Admin-Verwaltung nach `adminFunctionTiles`, Vereinskasse nach `canOpenClubCash`, Kachel nicht doppeln) aus `verein.tsx` in eine Funktion oder Komponente ziehen, die beide Seiten nutzen. Kein zweiter Rechtecode.
2. **„Ich“ (Handy):** Unter dem Profilcontainer, vor „Ich und Familie“, wieder zwei hervorgehobene Knöpfe (violett und blau, wie früher in AV). Admins beide, Kassenleute nur Vereinskasse, Personen mit einzelnen Verwaltungsrechten nur Admin-Verwaltung, alle anderen nichts (keine leere Zeile, keine Lücke). Eine Blickfang-Fläche pro Bildschirm bleibt der Profilcontainer; die Knöpfe nutzen Statusflächen bzw. `primaryContainer` aus dem Theme, keine festen Farben außerhalb der erlaubten Stellen.
3. **„Verein“:** Gruppe „Meine Vereinsaufgaben“ bleibt unverändert, nutzt denselben Baustein.
4. **Desktop (ab 1100 px):** In „Ich“ stehen die Knöpfe oben in der linken Spalte unter dem Profil; Seitenleiste und Verwaltungsbereiche bleiben.
5. **Abschluss:** Hilfetext (`help-content.ts`) nennt beide Wege, Übersetzungen (`node scripts/i18n.mjs todo`), `FUNKTIONEN.md` (Zeilen AV und NAVIGATION-NEUORDNUNG: „zusätzlich in Ich“), Hell- und Dunkelprüfung mit `hell-kontrast.mjs`, `pnpm check`.

Rechte nur serverseitig; die App blendet nur aus (`me.canAdminister`, `me.clubCash`). Texte deutsch, Barrierefreiheitsbeschriftung für beide Knöpfe.

## Abnahme
Browserskript: angemeldet als `admin` (beide Knöpfe in „Ich“ und in „Verein“), `kasse` (nur Vereinskasse), `trainer` und `spieler` (keiner), je hell und dunkel, Handy und Desktop; Bilder zusammengefasst; kurze Liste erledigt / abweichend / offen.
