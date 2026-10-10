# Designsystem „Neuer Look“

Stand 10.10.2026. Grundlage sind die gemeinsam gewählten Entwürfe (Designfläche „Clubroof Designentwürfe“: Home,
Team, Termine, Verein, Mehr, Dunkelmodus, Zustände). Dieses Dokument legt fest, **was** gilt; die Werte stehen in
[`packages/design-tokens`](../packages/design-tokens/src) und sind per Test abgesichert. Die Umsetzung in der App
folgt als eigenes Paket (siehe unten und `docs/PAKETE.md`, Paket L).

Farben und ihre Regeln: [`FARBKONZEPT.md`](FARBKONZEPT.md). Die gewählten Entwürfe liegen als HTML unter [`entwuerfe/`](entwuerfe/README.md).

## Leitgedanken

1. **Luftig und weich:** viel Weißraum, große Rundungen, kaum Linien. Karten heben sich über einen sehr dezenten
   Schatten (hell) bzw. eine Flächenstufe mit feinem Rahmen (dunkel) ab.
2. **Ein Blickfang je Bildschirm:** eine große Karte in der Vereinsfarbe (Verlauf mit Wellen) trägt die wichtigste
   Aussage – Nächstes Spiel, Kader, Nächster Vereinstermin, Profil. Alles andere bleibt ruhig.
3. **Runde Bedienelemente:** Buttons, Chips, Suche, Glocke und Tab-Leiste sind Pillen oder Kreise. Haupt-Aktionen sind
   gefüllt, Nebenaktionen umrandet.
4. **Pastell mit Bedeutung:** Icon-Kacheln und Kennzahlen nutzen fünf Pastellfarben mit dunkler Schrift; Statusfarben
   (Dringend, Aktion, Info, Erledigt) bleiben davon getrennt und immer mit Beschriftung.
5. **Alles ist antippbar groß genug:** mindestens 44 pt, Texte sind Open Sans bzw. Oswald, lange Namen brechen um
   (höchstens zwei Zeilen) statt Bedienelemente zu verdrängen.

## Bausteine

| Baustein            | Aufbau                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Kopfzeile           | Vereinslogo (Kreis, 48) · Begrüßung bzw. Titel (Oswald, Datum/Untertitel klein darüber/darunter) · Suche (46) · Glocke (46) mit rotem Zähler |
| Blickfangkarte      | Radius 28, Verlauf `hero.from → hero.to`, Wellen/Kreise in `hero.decor`, Schrift `hero.onHero`, Schatten `hero`                                |
| Wischkarten         | Karten 306 breit, die nächste ragt ~60 pt heraus; darunter Punkte und „Nächste Spiele · 1 von 3“; bei Eltern chronologisch über alle Kinder |
| Band „Offen“        | wischbare Mini-Karten (232 breit) mit Icon-Kachel, Titel und Frist; dringendste mit Statusrahmen                                             |
| Terminzeile         | Datumskachel (48×50) · Titel · Untertitel · Status-Chip bzw. runde ✓/✕ (44); abgesagt: durchgestrichen + Chip „Abgesagt“ + Grund             |
| Chip                | Höhe 32 (Chip-Text 11–13), Pillenform, Status mit Icon oder Text; Zähler an Kacheln: rund, 22                                                |
| Icon-Kachel         | 40 (groß 52), Radius 13–16, Pastellfläche (`tints`) mit Icon in `onContainer`                                                                 |
| Schnellzugriff      | wischbare Chips (46 hoch) mit Icon-Kachel; Hinweise („1“ Kasse, „neu“ Fahrten); „+ Hinzufügen“ gestrichelt; Auswahl je Rolle, anpassbar      |
| Kachelraster        | 4 Spalten, Kachel 60 hoch, Beschriftung darunter, Hinweis oben rechts (Zähler oder „neu“)                                                      |
| Liste in Karte      | Zeilen ≥ 44 hoch, Trenner `#EEF1EE`-artig (Rahmenfarbe, 1 pt), Icon-Kachel links, Pfeil rechts                                                |
| Kalender            | Monatsraster 7 Spalten, Zellen 44, Punkte nach Terminart (Training, Spiel, Spielfest, Abgesagt), gewählter Tag in Vereinsfarbe                 |
| Tab-Leiste          | schwebend, Radius 34, 68 hoch, fünf Punkte; aktiver Bereich als farbige Pille mit Beschriftung, übrige nur Icon                                |
| Meldungen           | Toast unten (dunkel) mit „Rückgängig“; Bestätigung als Blatt von unten mit Grund-Feld; Fehler als Karte mit „Erneut versuchen“                |
| Zustände            | Laden: pulsierende Platzhalter (Karte, Band, Zeilen); Offline: gelber Hinweis + Stand + Zusage „wird gesendet“; Leer: Text + Handlung         |

## Tokens (Code)

- **Farben:** `ThemeColors` um `surfaceRaised`, `tints` (blue, orange, pink, green, violet) und `hero` erweitert.
- **Maße:** `radii.xxl` (28), `sizes` (u. a. `touchTarget` 44, `button` 48, `tabBar` 68), `elevation`, `motion`, neue
  Schriftgrößen `chip`, `section`, `headline` 26, `hero` 46.
- **Prüfung:** Tests für alle zehn Vereinsfarben in beiden Modi (Hero-Schrift, Pastellflächen, erhöhte Karte) – zusätzlich zu den bisherigen
  Kontrastprüfungen.

## Regeln

1. **Blickfang:** je Bildschirm genau eine Hero-Karte (Verlauf der Vereinsfarbe). Weitere Hervorhebungen mit
   `primaryContainer`, Pastellflächen (`tints`) oder Statusflächen mit Beschriftung. (Lockerung der bisherigen Regel
   „höchstens eine Primärfläche“: kleine Pastell-Kacheln sind erlaubt, weitere Vereinsfarb-Flächen nicht.)
2. **Pastell nur mit dunkler Schrift** (`onContainer`), nie mit weißer. Pastell ersetzt nie eine Statusfarbe.
3. **Hero-Schrift** ist immer `hero.onHero`; auf hellen Vereinsfarben (Gelb, Orange, Himmelblau) dunkel, sonst weiß.
4. **Dunkelmodus:** eigene Flächenstufen (`background`, `surface`, `surfaceRaised`), Rahmen statt Schatten, Hero tief
   eingefärbt mit weißer Schrift, Akzent heller für Text und Links (`primaryText`).
5. **Touch-Flächen:** mindestens `sizes.touchTarget`; kleinere Symbole bekommen einen größeren Tippbereich.
6. **Bewegung:** `motion.fast`/`normal`; Platzhalter pulsieren (`skeletonPulse`); „Bewegung reduzieren“ beachten.
7. **Lange Texte:** Namen bis zwei Zeilen, dann abschneiden; Chips und Bedienelemente behalten ihren Platz.
8. **Abkürzungen und Zähler** (Glocke, Kasse, Forum) sind rund, mit Rand in der Hintergrundfarbe, damit sie lesbar bleiben.

## Seiten (Bildschirme)

- **Home:** Spiele (wischbar) → Offen (Band) → Deine Woche (mit abgesagten Terminen, Geburtstage dezent darunter, nur eigene
  Mannschaften) → Neuigkeiten für dich (Chips: Verein/Mannschaft, Dringend/Wichtig) → Schnellzugriff (rollenabhängig,
  anpassbar). Am Ende „Verein im Überblick“ für Vorstand und Vereinsmitglieder.
- **Team:** wischbare Team-Kacheln (bei mehreren Mannschaften/Kindern) → Kopfband (Kader, verfügbar, Tabelle, Torschütze) →
  Kacheln mit Hinweisen → Nächster Termin mit Kaderstatus → Letzte Ergebnisse → Trainingswoche.
- **Termine:** Filter (Alle, je Kind, Spiele, Training, Verein) → Als Nächstes (Hero) → Liste → Kalender → Tag.
- **Verein:** Nächster Vereinstermin (Hero) → Kacheln „Vereinsleben“ (rollenabhängig) → Heute auf der Anlage → Vereinsnews.
- **Mehr:** Profilkarte (Hero) → Meine Kinder → Mein Bereich → Meine Mannschaften → Einstellungen → Abmelden.
  Verwaltung ist über den Schnellzugriff erreichbar, nicht mehr über einen eigenen Kopf-Button.
- **Zustände:** Laden, Offline, Leer, Fehler, Warnung (2-Faktor für Admin), Rückmeldung mit Rückgängig, Bestätigung.

## Offene Entscheidungen

- **Name für „Mehr“:** entschieden (10.10.2026): bleibt „Mehr“. „Profil“ wäre zu eng (Inhalt: Kinder, Mannschaften,
  Benachrichtigungen, Abwesenheiten, Einstellungen, Hilfe); „Mein Bereich“ bleibt eine mögliche spätere Alternative.
- **Suche im Kopf:** Beim Umbau erst mit eingeschränktem Umfang (Mitglieder, Termine) oder ohne Knopf, bis die globale Suche steht – offen.
- **Schrift** für Fließtext (Open Sans bleibt, bis Alternativen verglichen sind).

## Umsetzung in der App (geplant, Paket L)

Reihenfolge: Theme/Bausteine (`components/ui.tsx`, Tab-Leiste, Kopfzeile) → Home → Team → Termine → Verein → Mehr →
Zustände (Laden, Offline, Leer, Fehler) → Dunkelmodus-Durchgang → Browserprüfung und Bilder-Überblick.
Dazu gehören: Schnellzugriff je Rolle (gespeicherte Auswahl je Person), globale Suche, Wischkarten für Spiele,
Geburtstage der eigenen Mannschaften (liegt serverseitig vor), Paket U (Touch-Flächen, Haptik).
