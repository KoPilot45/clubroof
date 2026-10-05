# Festlegungen

Produkt- und Architekturentscheidungen, die im Laufe der Entwicklung getroffen wurden.
Neue Entscheidungen werden oben ergänzt.

| Datum | Festlegung | Folge für die Umsetzung |
| --- | --- | --- |
| 05.10.2026 | **Uploads nur geprüft und nur über signierte Links.** Der Dateityp wird am Inhalt erkannt (PDF, Word, Excel, JPG, PNG, WebP), nie am Namen; SVG/HTML werden abgelehnt. Dokumente bis 10 MB, Bilder bis 5 MB. | Dokumentlinks gelten 10 Minuten, Bildlinks 12–24 Stunden (damit Listen Bilder zwischenspeichern können). Dateien liegen getrennt je Verein (`clubs/<id>/…`); später austauschbar gegen S3-Speicher. |
| 05.10.2026 | **Rechtevergabe mit Schutzregeln.** Rollen vergibt nur, wer `club.roles.manage` hat – und nur Rollen, deren Rechte er selbst vereinsweit besitzt. Der letzte Fulladmin kann weder entfernt werden noch austreten; niemand entzieht sich selbst die Rollenvergabe. | Verhindert Rechteausweitung und das Aussperren des Vereins. Jede Vergabe und jeder Entzug steht im Änderungsprotokoll. |
| 05.10.2026 | **Austritt** beendet Mannschaftszugehörigkeiten (rückwirkend bis gestern), entzieht alle Rollen und sperrt den App-Zugang (Sitzungen gelöscht, Login abgelehnt). Die Stammdaten bleiben für die Vereinsunterlagen erhalten. | Wiederaufnahme jederzeit über den Status „Aktiv“. Löschung personenbezogener Daten (DSGVO) folgt als eigene Funktion. |
| 05.10.2026 | **Verwaltung zuerst als Bereich der App** (Mehr → Verwaltung). Sie läuft dank Web-Build auch im Browser am PC. | Eine eigene Web-Oberfläche (Next.js) folgt erst, wenn breite Tabellen, Import oder Massenbearbeitung gebraucht werden – das Backend ist dafür bereits fertig. |
| 05.10.2026 | **Kassenwart ist eine Zusatzaufgabe, keine eigene Rolle.** Ein Spieler (oder Trainer, Elternteil …) kann z. B. Kassenwart seiner Mannschaft sein. | Rollen sind Rechtepakete, die zusätzlich zur Mannschaftszugehörigkeit vergeben werden – mit Geltungsbereich (Verein, Bereich oder Mannschaft). „Kassenwart der 1. Mannschaft“ = Rechtepaket *Kasse* für diese Mannschaft. In der Verwaltung wird die Aufgabe direkt bei der Person in der Mannschaft vergeben. Dasselbe Prinzip gilt für weitere Zusatzaufgaben (z. B. Platzwart, Jugendleitung). |
| 05.10.2026 | Unter **Team, Verein und Mehr** liegt jeweils ein **gekacheltes Untermenü**. | Kacheln entstehen aus den aktivierten Modulen der Mannschaft bzw. des Vereins; spätere Funktionen erscheinen als „Bald verfügbar“. |
| 05.10.2026 | **Fünf Vereinsfarben** (Rot, Blau, Grün, Gelb, Schwarz), weitere eventuell später. Verein wählt Farbe und Logo bei der Einrichtung. | Vorab geprüfte Farbthemen statt freier Farbwerte, siehe [Farbkonzept](FARBKONZEPT.md). |
| 05.10.2026 | **Native App von Anfang an** (iOS, Android) **und** eine **Web-Verwaltung**. | Expo (React Native) für die App, Next.js für die Web-Verwaltung, gemeinsames Backend. |
| 05.10.2026 | **Ein Verein** zum Start, später weitere Vereine als getrennte Mandanten. | Kein Vereins-Umschalter in der App; alle Daten tragen trotzdem eine `club_id`. |
| 05.10.2026 | Vor Einladungen und Push werden zuerst die **Funktionen der App** fertiggestellt. | Reihenfolge der Pakete A–G, siehe [Funktionsliste](FUNKTIONEN.md). |
