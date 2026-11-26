# Antonia Rüller – Design-Stile: Analyse und Pakete

Stand: Analyse der Live-Seite antoniarueller.de gegen den Entwicklungsstand (v90). Die Live-Seite entspricht dem Stand v90
(einteilige Überschriften, Pins an den Kacheln, Menü-Markierung, keine Rolle in den Kacheln).

## 1. Analyse der Live-Seite

**Inhalte, die den Plan beeinflussen**

| Bereich | Befund live | Folge für den Plan |
|---|---|---|
| Beiträge | 8 Beiträge, Daten von 12/2025 bis 09/2026; sieben davon 2026, einer 2025, einer nur „2026“ ohne Monat. Podcast-Spur leer. | **Sendeplan und Zeitstrahl brauchen eine Monats- bzw. Quartalsskala**, nicht Jahresspalten (2024/2025 wären leer). Skala wählt sich nach dem Datumsbereich. Beiträge ohne Monat landen in einer Jahresspalte. |
| Vorschaubilder | Alle 8 Beiträge haben ein Bild, mehrere sind **Bildschirmfotos von Webseiten** (mit Browser- und Seitenrahmen). | **Magazin-Cover** wirkt mit Bildschirmfotos schlecht. Neues Feld je Beitrag „Bildstil: Foto (bildfüllend) / Bildschirmfoto (eingerahmt)“; Bildschirmfotos stehen im Cover als Ausschnitt auf Farbfläche. Die Liste mit Vorschaubild kommt damit gut zurecht. |
| Hero-Foto | 1024 × 1536, **freigestellt** (Transparenz vorhanden). | Hero C (Bogen) und D (Sucher) sind möglich. Bei C darf der Kopf oben nicht abgeschnitten werden. |
| Porträt „Über mich“ | Rechteckig (900 × 1066), grüne Wand, **nicht freigestellt**. | Über mich B und C kommen damit gut zurecht (keine Freistellung nötig). Die frühere Warnung galt nur dem Hero. |
| Podcast | Zwei Platzhalter-Karten („[Podcast-Name] · Folge [№]“). | Stile lassen sich erst mit echten Folgen abschließend beurteilen; Technik ist unabhängig davon. Das Cover (Stil C) wurde nicht gewählt, daher kein Bildproblem. |
| Off the record | Sechs Fragen, alle Antworten Platzhalter. | A (Fragebogen) und D (Lexikon) zeigen die Antworten offen; das Aufdecken per Hover entfällt dort. Echte Antworten prüfen: lange Antworten funktionieren in A, kurze in D. |
| Lebenslauf | 16 Stationen in den Jahren 2026–2015, Logoleiste mit 10 Logos, „Davor“. Menüpunkt heißt **„Stationen“**, REC-Zeile **„Lebenslauf“**, Überschrift „STATIONEN“ in Großbuchstaben. | Redaktionell vereinheitlichen (ein Name). Stile übernehmen die gewählte Überschriftschrift der Schrift-Presets, kein fester Stil. |
| Kopfzeile | Name links, Menü, Sprache und **Knopf „Schreib mir ↗“** rechts. | Alle Abschnittszeilen-Stile behalten den Knopf. Texte der Kopfzeile bleiben Felder im Backend. |
| Nummerierung | Nummern der REC-Zeilen laufen nach Gruppen (00 Start und Leitfragen, 01 Arbeiten und Podcast, 02, 03, 04). | Der **Kapitelzähler zählt Nummerngruppen** („01 / 04“), nicht Abschnitte. Er ändert sich mit ein- und ausgeblendeten Abschnitten. |

**Schon umgesetzt, bleibt Teil des aktuellen Designs:** Pinnwand-Kacheln, Schnittplatz mit Spur-Hervorhebung, Hover-Karte mit Vorschaubild.

## 2. Gewählte Stile (jeweils zusätzlich zum aktuellen Design, das Standard bleibt)

| Bereich | Stile |
|---|---|
| Abschnittszeile | D Kapitelzähler, Haarlinie |
| Hero | C Bogen, D Sucher mit Bauchbinde |
| Leitfragen | B Zwei Karten, C Fragezeichen |
| Beitragskacheln | Magazin-Cover, Liste mit Vorschaubild (Zeilen) |
| Übersicht der Beiträge | Sendeplan, Zeitstrahl (schaltbar, Schalter vorhanden) |
| Podcast | B Folgenverzeichnis, D Großes Wellenband |
| Über mich | C Geteilt dunkel, B Feature-Seite (Crossmedial und Sprachen als eigene Zeile über die ganze Breite) |
| Lebenslauf | A Tabelle nach Jahren, C Stations-Kacheln |
| Off the record | A Fragebogen, D Lexikon |
| Kontakt und Fußzeile | A Schriftzug, C Abspann |

Weitere vorgemerkte Punkte: Podcast als Unterabschnitt von Arbeiten (Aufbau der Seite); Farben: Spuren aus der Palette, Mint-Töne an die
Palette binden, neue Paletten ergänzend (Standard „Petrol & Sand“ bleibt, Vorschau vor der Aufnahme).

## 3. Technischer Ansatz (gilt für alle Pakete)

- **Registry `lib/styles.php`:** Bereich → [Stilschlüssel => Name, Vorschau-Skizze]. Standard ist immer der Schlüssel `aktuell`.
- **Backend:** Neue Gruppe „Stile“ unter „Seite & Design“ mit einer Auswahl je Bereich (kleine Skizzen als Auswahlkarten), Einstellung gilt für Deutsch und Englisch.
- **Vorlagen:** `templates/sections/<bereich>/<stil>.php`; der bisherige Code wird unverändert zu `aktuell.php`. Gemeinsame Daten wie bisher, keine neuen Pflichtfelder.
- **CSS:** Pro Stil eine Datei `assets/stile/<bereich>-<stil>.css`, nur der gewählte Stil wird geladen. Farben ausschließlich aus Palettenvariablen (kein neues festes Hex).
- **Qualität je Stil:** Selftest (Auswahl speichern, Seite rendert, Fallback auf `aktuell` bei unbekanntem Schlüssel), alle 6+ Paletten mit Lesbarkeits-Prüfung, Handy und Desktop, axe-Prüfung, englische Texte, Hilfe-Artikel, Eintrag in der README.
- **Seitenpflege:** `page_cache` wird beim Wechsel geleert.

## 4. Pakete

Größen: S ≈ 1 Sitzung, M ≈ 1–2, L ≈ 2–3.

| Nr. | Paket | Inhalt | Größe |
|---|---|---|---|
| 1 | **Grundlage, Abschnittszeile, Aufbau** | Stil-System (Registry, Backend-Gruppe „Stile“, Vorlagen-Auflösung, CSS-Laden, Fallback, Tests). Abschnittszeile D Kapitelzähler und Haarlinie als erste Nutzer. Podcast als Unterabschnitt von Arbeiten im Aufbau der Seite. | L |
| 2 | **Farben** | Spuren wählen Palettenfarben statt Hex (Migration der vorhandenen Werte), Mint-Töne an die Palette gebunden, neue Paletten (Standard bleibt Default, vorher Vorschau). | S–M |
| 3 | **Arbeiten komplett** | Beitragsstile Magazin-Cover und Liste (inkl. Feld „Bildstil“), Übersichtsstile Sendeplan und Zeitstrahl mit Monats-/Quartalsskala, Podcast B und D. Bei Bedarf in 3a (Beiträge, Übersicht) und 3b (Podcast) teilen. | L |
| 4 | **Start** | Hero C und D (Foto nicht abschneiden, Fallback ohne freigestelltes Foto) und Leitfragen B und C. | M |
| 5 | **Über mich und Lebenslauf** | Über mich C und B, Lebenslauf A und C, Stationsname vereinheitlichen. | M–L |
| 6 | **Off the record, Kontakt, Abschluss** | Off A und D, Kontakt A und C, Prüfung aller Stile mit allen Paletten, Handy, Barrierefreiheit, Hilfe, Dokumentation. | M |

Zusammenführungen, die sinnvoll wären: **1 und 2** nicht (Ergebnis wäre zu groß); **4 und 5** möglich, wenn die Stile
klein bleiben; **6** enthält bewusst die Abschlussprüfung.

## 5. Offene Entscheidungen

1. Magazin-Cover mit Bildschirmfotos: Option „Bildstil“ je Beitrag (Vorschlag) oder Cover nur für Beiträge mit Foto.
2. Kapitelzähler: „01 / 04“ nach Nummerngruppen (Vorschlag) oder nach Abschnitten.
3. Menüname „Stationen“ oder „Lebenslauf“ (ein Name für Menü, REC-Zeile und Überschrift).
4. Echte Podcast-Folgen und Off-Antworten vor Paket 3 beziehungsweise 6 eintragen.

## 6. Umsetzungsstand

Alle sechs Pakete sind umgesetzt (v91 bis v96): 1 Grundlage, Abschnittszeile, Podcast unter Arbeiten · 2 Farben · 3 Arbeiten · 4 Start ·
5 Über mich und Lebenslauf · 6 Off the record, Kontakt, Abschlussprüfung. Entscheidungen: Magazin-Cover mit Feld „Bildstil“, Kapitelzähler nach
Nummerngruppen, Namen und Texte (z. B. „Stationen“) kommen immer aus dem Backend und werden von Stilen nicht überschrieben, echte Podcast-Folgen und
Off-Antworten werden nicht von uns eingetragen.
