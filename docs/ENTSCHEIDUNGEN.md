# Festlegungen

Produkt- und Architekturentscheidungen, die im Laufe der Entwicklung getroffen wurden.
Neue Entscheidungen werden oben ergänzt.

| Datum | Festlegung | Folge für die Umsetzung |
| --- | --- | --- |
| 05.10.2026 | **Kassenwart ist eine Zusatzaufgabe, keine eigene Rolle.** Ein Spieler (oder Trainer, Elternteil …) kann z. B. Kassenwart seiner Mannschaft sein. | Rollen sind Rechtepakete, die zusätzlich zur Mannschaftszugehörigkeit vergeben werden – mit Geltungsbereich (Verein, Bereich oder Mannschaft). „Kassenwart der 1. Mannschaft“ = Rechtepaket *Kasse* für diese Mannschaft. In der Verwaltung wird die Aufgabe direkt bei der Person in der Mannschaft vergeben. Dasselbe Prinzip gilt für weitere Zusatzaufgaben (z. B. Platzwart, Jugendleitung). |
| 05.10.2026 | Unter **Team, Verein und Mehr** liegt jeweils ein **gekacheltes Untermenü**. | Kacheln entstehen aus den aktivierten Modulen der Mannschaft bzw. des Vereins; spätere Funktionen erscheinen als „Bald verfügbar“. |
| 05.10.2026 | **Fünf Vereinsfarben** (Rot, Blau, Grün, Gelb, Schwarz), weitere eventuell später. Verein wählt Farbe und Logo bei der Einrichtung. | Vorab geprüfte Farbthemen statt freier Farbwerte, siehe [Farbkonzept](FARBKONZEPT.md). |
| 05.10.2026 | **Native App von Anfang an** (iOS, Android) **und** eine **Web-Verwaltung**. | Expo (React Native) für die App, Next.js für die Web-Verwaltung, gemeinsames Backend. |
| 05.10.2026 | **Ein Verein** zum Start, später weitere Vereine als getrennte Mandanten. | Kein Vereins-Umschalter in der App; alle Daten tragen trotzdem eine `club_id`. |
| 05.10.2026 | Vor Einladungen und Push werden zuerst die **Funktionen der App** fertiggestellt. | Reihenfolge der Pakete A–G, siehe [Funktionsliste](FUNKTIONEN.md). |
