# Übergabeprompt: Desktop-Ansicht 2 (Paket DT2)

Zum Einfügen in die Umsetzungssitzung. **Erst starten, wenn Paket DT umgesetzt ist** (Seitenleiste, Breitenstufen, `Sheet` als Dialog).

---

Paket **DT2** (`docs/PAKETE.md`, Zeile DT2) überträgt die Desktop-Ansicht auf alle Unterseiten, Formulare, Assistenten und Sonderfälle. Unter 1100 px darf sich nichts ändern.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile **DT2** und Zeile **DT** lesen; Entwurf der Hauptseiten: `docs/design/anstoss/Desktop.html`. Umgesetztes aus DT lesen (Seitenleiste, Breitenstufen-Hook, Screen).
3. Alle Bildschirme unter `apps/mobile/src/app` auflisten und einer Vorlage A–F zuordnen (Tabelle in `docs/DESKTOP-VORLAGEN.md` anlegen und beim Umsetzen abhaken).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Vorlagen** A Liste+Detail, B Formular, C Tabelle mit Filterleiste, D Kachelraster, E Assistent, F Berichte als Bausteine; Zuordnungstabelle.
2. **Admin-Listen und Kader** (C): Sortierung, Filter, Tastatur, Mehrfachauswahl, Export aus der Tabelle.
3. **Formulare** (B) und **Assistenten** (E, inkl. Setup, Import, Kasse).
4. **Kasse und Statistik** (C, F).
5. **Sonderfälle:** nach dem Entwurf `docs/design/anstoss/DesktopSonder.html` (Aufstellungsplaner, Kalender/Platzbelegung, Termin-Seitenpanel, Spielbericht, Assistent, Anmeldung, Ladescreen; Internet für die Schriften nötig).

Nur Layout, keine neuen Daten oder Rechte. Hell/dunkel, `hell-kontrast.mjs`, Übersetzungen, Hilfe.

## Abnahme
Bilder 1440 und 1100 px je Vorlage (zusammengefasst), Vorher/Nachher unter 1100 px, Zuordnungstabelle vollständig abgehakt; kurze Liste erledigt / abweichend / offen.
