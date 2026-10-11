# Archiv (Planung)

Stand 11.10.2026 · Konzept abgestimmt, noch nicht umgesetzt. Paket AR in `PAKETE.md`.

## Prinzip

1. **Löschen heißt archivieren.** Nichts verschwindet sofort; archivierte Einträge lassen sich ansehen und wiederherstellen.
2. **Endgültig gelöscht wird nur auf Anstoß**, nie automatisch. Im Archiv erscheint eine Meldung wie „12 archivierte Einträge älter als 10 Jahre“ mit einem Knopf **Bereinigen**; zusätzlich gibt es **Archiv leeren** (alles endgültig löschen, mit Bestätigung).
3. **Fristen:** Standardmäßig gelten immer die **gesetzlichen Fristen** (zu prüfen: Bücher, Aufzeichnungen und Jahresabschlüsse 10 Jahre, Buchungsbelege 8 Jahre; für personenbezogene Daten ohne feste Frist gilt „nur solange nötig“ mit einem vom Betreiber geprüften Standard). Eine Individualisierung durch den Verein ist zunächst nicht vorgesehen. Belege und Buchungen können nicht vor Ablauf der Frist endgültig gelöscht werden.
4. **Gleiche Bedienung überall:** Jede Liste hat einen Filter „Archiv“ im gleichen Stil.
5. **Wiederherstellen mit Namenskonflikt:** Das System fragt nach, es ändert nichts selbstständig.
6. **Ehemalige Mitglieder** erscheinen in Statistik und Spielberichten weiter mit Namen.
7. **Datenübergabe:** Das gesamte Archiv ist exportierbar (Auflösung des Vereins, Kündigung, Paket P).

## Wo es Archive gibt

**Im Bereich einer Mannschaft (Team-Tab, Reiter/Kachel „Archiv“, für Trainerteam):**
- **Termine** (vergangene, abgesagte, gelöschte; Spielberichte und Aufstellungen hängen daran)
- **Umfragen** (beendete)
- **Mannschaftskasse** (nur für Kassenverantwortliche der Mannschaft: abgeschlossene Zeiträume, stornierte Buchungen, Belege, archivierte Strafen und Beiträge)
- Vorgeschlagen zusätzlich: **Aufgaben** (erledigte), **Dokumente** (ersetzte Versionen, entfernte Dateien), **Kaderhistorie** (ehemalige Spieler und Funktionen der Mannschaft), **Trainingsplanung** (alte Einheiten)

**Im Admin-Panel (Verein → Abo & Kontrolle → Archiv und in den jeweiligen Kategorien):**
- **Ehemalige** (Mitglieder), Rollenhistorie
- **Mannschaften und Abteilungen** (aufgelöste), Saisonarchiv (Planung des Saison-Übergangs steht noch aus)
- **Vereinskasse(n):** abgeschlossene Haushaltsjahre, stillgelegte Kassen, Prüfberichte, Belege
- **Inhalte:** News, Forumsthemen, Dokumente, Wissen, Veranstaltungen
- **Sponsoren** (abgelaufen)
- **Anlage** (ausgemustertes Material, stillgelegte Plätze und Kabinen)
- **Verwaltung:** Einladungs- und Einrichtungscodes, Importläufe

## Bereinigen

- In jedem Archiv zeigt ein Hinweis „X archivierte Einträge älter als [Frist]“ die Einträge, die die gesetzliche Frist überschritten haben, mit **Bereinigen** (löscht genau diese endgültig, nach Bestätigung).
- **Archiv leeren** löscht alles in diesem Archiv, soweit keine Aufbewahrungsfrist mehr läuft; Einträge mit laufender Frist bleiben und werden genannt.
- Beides nur für Admin bzw. für die Berechtigten des jeweiligen Archivs; jede Bereinigung steht im Änderungsprotokoll (ohne Inhalt der gelöschten Daten).

## Nicht archivieren, sondern früh löschen (Datensparsamkeit)

Abwesenheitsgründe (bis Saisonende), Benachrichtigungen, beendete Sitzungen und Geräte.

## Rechte (Entwurf)

`archive.read`, `archive.restore`, `archive.purge` je Bereich (Mannschaft, Mitglieder, Kasse, Inhalte, Anlage); Endgültiges Löschen nur Admin bzw. Bereichsverantwortliche mit Bestätigung.

## Offen

- Planung eines reibungslosen **Saison-Übergangs** (Saisonarchiv, Kader, Teams, Fristen, Trainerteams) – eigenes Thema.
- Rechtliche Prüfung der Fristen.
