# Design „Anstoß“ (dunkel) – verbindliche Vorgabe

Gilt für die **ganze App** (Entscheidung Vorstand; zunächst nur dunkel, ein heller Stil folgt ggf. später).
Paketübersicht: `docs/PAKETE.md` (Pakete AL, LF, PL). Farbsystem allgemein: `docs/FARBKONZEPT.md`.

## Referenzentwürfe (öffnen und vergleichen)

`docs/design/anstoss/index.html` im Browser öffnen (Internet nötig für die Schriften). Jede Datei dort ist ein
Entwurf als echtes HTML mit allen Maßen, Farben und Abständen im Quelltext. **Das Ergebnis muss diesen Entwürfen
entsprechen; Abweichungen nur nach Rückfrage.** Beispieltexte und -zahlen sind erfunden. `ProtoLF.html` zeigt nur
die **Bewegung** (Tempo, Gedrückt-Zustand, Reiter); seine Farben sind der alte helle Stil und gelten nicht.

| Bereich | Dateien |
|---|---|
| Hauptmenü | `DarkHome`, `DarkTeam`, `DarkTermine`, `DarkVerein`, `DarkMehr` |
| Vereinsfarben | `DarkHomeBlau`, `DarkHomeRot`, `DarkK4` (Gelb, helle Farbe) |
| Plakat-Kürzel | `DarkBg3` (3 Zeichen), `DarkK2` (2), `DarkK3` (4); Rückfall ohne Kürzel `DarkBg1` (Rasenstreifen) |
| Unterseiten | `DarkU1` Liste/Filter · `DarkU2` Detail · `DarkU3` Formular · `DarkU4` Zeitwalze · `DarkU5` Kasse · `DarkU6` Personenliste · `DarkU7` Auswertung · `DarkU8` Lesetext · `DarkU9` Verwaltung · `DarkU10` Vereinskasse · `DarkU11` Verein & Design · `DarkU12` Zustände · `DarkU13`–`U15` Aufgaben, „…“-Menü, Löschen-Rückfrage · `DarkU16` Dokumente |
| Anmeldung, Einrichtung | `DarkLogin1`, `DarkLogin2`, `DarkSetup1`–`DarkSetup5` |

## Farben (Vereinsfarbe Grün; Werte je Vereinsfarbe siehe unten)

| Zweck | Wert |
|---|---|
| Hintergrund | `#0B120E` |
| Text / Text sekundär / tertiär / Platzhalter | `#F2F7F3` / `#C5D6CB` / `#9FB5A6` / `#6F8277` |
| Fläche (Karte, Kachel, Feld) | `rgba(255,255,255,.06)`, Rand `rgba(255,255,255,.09)`; Feldrand `rgba(255,255,255,.12)` |
| Trennlinie in Listen | `rgba(255,255,255,.08)`, links eingerückt bis hinter das Symbol (70–72 px) |
| Fenster von unten / Dialog | Fläche `#16211A`, oberer Rand `rgba(255,255,255,.12)`; Abdunklung dahinter `rgba(0,0,0,.6)` (Dialog `.7`) |
| Untere Leiste | `rgba(30,42,34,.86)` mit Rand `rgba(255,255,255,.1)`; aktiver Reiter = Akzentfarbe, Symbol + Beschriftung |
| Akzent / Text auf Akzent | Grün `#2EDB6B` / `#06210F` |
| Plakat | `radial-gradient(120% 80% at 80% 0%, p1 0%, p2 45%, bg 100%)` plus Überblendung `linear-gradient(180deg, transparent 40%, bg 100%)`; Grün p1 `#1E7A44`, p2 `#0F3D24` |
| Hero-Block (kleiner) | `radial-gradient(120% 120% at 90% 0%, p1 0%, p2 60%, bg 130%)` |
| Status | Erfolg `#2EDB6B`; Warnung `#FFB020` auf `rgba(255,176,32,.16)`; Fehler Text `#FF8A8A` auf `rgba(255,90,90,.16)`, Balken `#FF6B6B`; Gefahr-Knopf `#FF5A5F` mit Text `#2B0507` |
| Kategorien (Symbolfläche = Farbe bei 15 % Deckkraft, Symbol in voller Farbe) | Team grün `#2EDB6B` · Organisation/Verein-Leben blau `#5AA9FF` · Verwaltung violett `#B28CFF` · Veranstaltungen orange `#FFB020` · Neuigkeiten rosa `#FF7AB8` |
| Verwaltung / Vereinskasse (Kopfband) | `linear-gradient(180deg,#3B2A78,#2A1E58)` / `linear-gradient(180deg,#1C4FA3,#143A7A)` |
| Anmeldung ohne Verein, Einrichtung (Clubroof) | Hintergrund `#070B14`, Verlauf `#002AFA → #00C3FF` für Knöpfe und Balken, Akzent `#4DC3FF` |

### Werte je Vereinsfarbe (Akzent · Text auf Akzent · Hintergrund · Plakat p1/p2 · tertiärer Text)

| Farbe | Akzent | Text auf Akzent | Hintergrund | p1 / p2 | tertiär |
|---|---|---|---|---|---|
| Grün | `#2EDB6B` | `#06210F` | `#0B120E` | `#1E7A44` / `#0F3D24` | `#9FB5A6` |
| Blau | `#5AB0FF` | `#04162E` | `#080E1A` | `#1F55D6` / `#0B2A6B` | `#9DB0CC` |
| Rot | `#FF5A5F` | `#2B0507` | `#140A0B` | `#B3202B` / `#5C0F16` | `#C7A9AB` |
| Gelb | `#FFD54F` | `#2B2100` | `#0F0D06` | `#8A6A00` / `#3F3000` | `#C9BF98` |

**Ableitung für die übrigen Vereinsfarben** (Schwarz, Orange, Lila, Weinrot, Himmelblau, Türkis): Akzent = Vereinsfarbe aufgehellt
(Helligkeit ca. 70–75 %), Text auf Akzent = sehr dunkle Variante desselben Farbtons, p1 = Vereinsfarbe bei ca. 55 % Helligkeit,
p2 = ca. 28 %, Hintergrund = fast Schwarz mit 5 % Farbton; tertiärer Text = leicht eingefärbtes Hellgrau. **Prüfung Pflicht:**
Text auf Akzent mindestens 4,5 : 1; weißer Text auf Plakat und Hero mindestens 4,5 : 1 (bei Gelb und Orange nachprüfen);
bei roter Vereinsfarbe wird „Dringend“ in Bernstein (`#FFC94D`, Fläche `linear-gradient(135deg,#8A5A00,#3A2500)`) gezeigt, damit Vereinsfarbe und
Warnfarbe nicht verwechselt werden. Statusfarben immer mit Symbol oder Text.

## Form

| Element | Maß |
|---|---|
| Seitenrand | 22 px (Kopfzeile 20 px) |
| Hero / Plakat-Block | Radius 28, Innenabstand 18 |
| Karte / Fläche / Kachel | Radius 22 |
| Fenster von unten, Dialog | Radius 28 (oben bzw. rundum), Griff 44 × 5 |
| Feld | Höhe 54–58, Radius 16–18, Rand 1,5 px (aktiv 2 px Akzent) |
| Knopf Haupt / Nebenknopf | Höhe 52–56 bzw. 46–50, Pille, Text 14–16 px fett (800) |
| Chip | Pille, 13–13,5 px fett, Innenabstand 9 × 15; aktiv = Akzent mit Text auf Akzent |
| Avatar | Kreis 42 (Liste) / 44 (Kopf) / 68 (Profil); Hintergrund Akzent bei 15 %, Initialen in Akzent; Trikotnummer als 20-px-Plakette unten rechts |
| Kachel mit Kennzahl | Fläche 66 hoch, Radius 22, Symbolfläche 38 (Radius 13), Kennzahl-Plakette oben rechts in Kategoriefarbe mit dunkler Schrift, Beschriftung 12,5 px darunter |
| Ticket (Woche, Spiele) | Breite 132, Radius 20, 4 px Farbstreifen links, große Zahl 40 px |
| Untere Leiste | schwebend, Abstand 16 seitlich und 14 unten, Höhe 64, Radius 32; aktiver Reiter 46 hoch, flex 2,2 |
| Abschnittsüberschrift | Saira Condensed 21 px, Gewicht 700, Großbuchstaben, Laufweite 1 px, Akzentlinie 4 × 18 vorn; Abstand oben **26**, unten **12** (der Entwurf gilt; ersetzt „20/20“ aus Paket PO) |
| Listen | **eine Fläche** mit Trennlinien, Zeile 11–13 px Innenabstand oben/unten, 16 px seitlich |
| Aktionen je Karte | ein Hauptknopf + runder „…“-Knopf (46); Löschen nur im Menü und immer mit Rückfrage |

## Schrift

Saira Condensed (Gewichte 700, 800) für Kopfzeilen-Titel (28), Abschnitte (21), Kartentitel (22–24), große Zahlen
(Plakat 108 bei einer Ziffer, 64 bei längeren Zahlen; Kasse 60–72; Ticket 40; Datumsblock 26–28), Uhrzeiten in Feldern (28).
Open Sans für alles andere: Text 15, sekundär 12,5, klein 11,5, Eyebrow 11,5 fett 800 Großbuchstaben Laufweite 1,4.

## Hero-Hintergrund: Waben (ersetzt Kürzel und Fadenkreuz)

**Entscheidung Vorstand:** Der Hero-Hintergrund ist das **Waben-Muster** (Entwurf `DarkBg4`, Home in `DarkHome*`). Das Vereinskürzel (2–4 Zeichen)
bleibt als Einstellung erhalten, dient aber **nur noch als Wappen-Ersatz** ohne Logo und wirkt sich **nicht** auf den Hero aus.

- Muster: Sechsecke (Radius 24, Strichstärke 2 px, Linienfarbe weiß), **links oben/rechts oben ausgeblendet**: Deckkraft 0,24 im Plakat, 0,18 in
  Hero-Blöcken, Maske `radial-gradient(90% 115% at 100% 0%, #000 0%, rgba(0,0,0,.35) 45%, transparent 78%)` – die Waben sind oben rechts am
  deutlichsten und laufen nach links und unten aus. Das Muster liegt **hinter** Text und Inhalt, über dem Verlauf (`isolation: isolate`).
- Verlauf des Hero bleibt vollständig sichtbar (Kartenform erkennbar): `radial-gradient(120% 120% at 90% 0%, p1 0%, p2 60%, …)`; Hero-Blöcke haben Radius 28.
- **Dezent auch an anderen Stellen:** Hero-Blöcke (Kader, Kasse, nächster Termin, Vereinstermin, Profil, Verwaltungs-Übersicht), Login-Kopf, Einrichtung
  (Vorschau), Willkommen-Seiten und Leerzustände; **nie** hinter Listen, Feldern oder Fließtext.
- Rückfall und Kontrast: Waben immer weiß mit geringer Deckkraft, damit sie auf allen Vereinsfarben funktionieren; Text bleibt weiß, helle Vereinsfarben
  nutzen den abgedunkelten Verlauf (siehe Tabelle).

## Startseite (Home)

- **Plakat mit Wisch-Spielen:** Das Plakat zeigt das nächste Spiel (Zahl „5 TAGE“, Paarung, Ort); **nach links wischen** zeigt die nächsten **drei** Spiele
  (Pager-Punkte und „Spiel 1 von 3 · wischen“ unten im Plakat).
- **Kein eigener Zusagen-Bereich** auf Home (Entscheidung Vorstand): Zu-/Absagen laufen über Kinderkarten („Zusage offen“), „Offen“-Karten und die
  Termine. Darunter: Wochen-Tickets, Neuigkeiten, Geburtstag, Schnellzugriff.

## Bewegung und Haptik

Siehe Paket LF und `ProtoLF.html` (Tempo, Gedrückt-Zustand 0,97, Reiter-Kapsel, schrumpfende Kopfzeile; „Bewegung reduzieren“ beachten).

## Abnahme

1. Für jede Referenzdatei den entsprechenden Bildschirm in der Web-App öffnen (Browserprüfung als Skript, Demodaten) und das Bild
   neben den Entwurf legen (hoher Ausschnitt, 390 px Breite). Abweichungen in Maß, Farbe, Reihenfolge benennen und beheben.
2. Kontrastprüfung je Vereinsfarbe (Tabelle oben) als Test oder Skript.
3. Keine eigenen Stile je Bildschirm: Farben, Radien und Abstände nur über Theme und gemeinsame Bausteine
   (`components/ui.tsx`, `tab-bar.tsx`, `app-header.tsx`, `app-text.tsx`); neue dunkle Farbwerte in `packages/design-tokens`.
