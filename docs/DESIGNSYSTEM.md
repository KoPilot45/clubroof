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
- **Suche im Kopf:** entschieden (10.10.2026, Schritt 1): Der Knopf fehlt, bis die globale Suche steht. `AppHeader` zeigt ihn nur,
  wenn `onSearch` übergeben wird; die Suche (Mitglieder, Termine, später mehr) ist ein eigener Schritt.
- **Schrift** für Fließtext (Open Sans bleibt, bis Alternativen verglichen sind).

## Umsetzung in der App (Paket L)

Reihenfolge: Theme/Bausteine (`components/ui.tsx`, Tab-Leiste, Kopfzeile) → Home → Team → Termine → Verein → Mehr →
Zustände (Laden, Offline, Leer, Fehler) → Dunkelmodus-Durchgang → Browserprüfung und Bilder-Überblick.
Dazu gehören: Schnellzugriff je Rolle (gespeicherte Auswahl je Person), globale Suche, Wischkarten für Spiele,
Geburtstage der eigenen Mannschaften (liegt serverseitig vor), Paket U (Touch-Flächen, Haptik).

### Stand Schritt 1: Bausteine und Navigation (10.10.2026) ✅

Seiteninhalte sind noch unverändert; alle Seiten erhalten den neuen Rahmen automatisch.

| Baustein (Code)                                    | Umsetzung                                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Theme` (`lib/theme.tsx`)                          | zusätzlich `sizes`, `elevation`, `motion`, `isDark`                                                                                              |
| `Card`                                             | Radius 24, `surfaceRaised`; hell Schatten ohne Rahmen, dunkel Rahmen. Innenabstand 14. `shadowStyle()` (boxShadow) für eigene Flächen             |
| `HeroCard`                                         | Radius 28, Verlauf `hero.from → hero.to` (SVG), zwei Wellen und Kreis in `hero.decor`; optional antippbar; dunkel feiner Rahmen statt Schatten    |
| `Button`                                           | Pille, `md` 48 / `sm` 44 pt hoch; neu `hero` (helle Fläche) und `heroOutline` für Aktionen auf der Blickfangkarte; Umbruch auf zwei Zeilen      |
| `Chip`                                             | Pille; `size="sm"` (24, Statusmarke in Listen) und `md` (32); Tönungen auch aus `tints`; `ChoiceChips` 34 mit größerem Tippbereich                |
| `IconTile`                                         | 40 bzw. `size="lg"` 52, Radius 14/16, Ton `primary`, Status oder Pastell (`blue`, `orange`, `pink`, `green`, `violet`)                            |
| `ListRow`, `Section`, `TileGrid`, Platzhalter      | Zeilen ≥ 44, Trenner 1 pt; Kacheln wie Karten; Platzhalter pulsieren mit `motion.skeletonPulse` (aus bei „Bewegung reduzieren“)                  |
| `AppHeader` (`components/app-header.tsx`)          | Vereinslogo im Kreis (48) · Untertitel klein über dem Titel (ohne Angabe das Datum) · Titel/Begrüßung bis zwei Zeilen · optional Suche · Glocke 46 mit Zähler mit Rand in Hintergrundfarbe |
| `FloatingTabBar` (`components/tab-bar.tsx`)        | schwebend (Radius 34, 68 hoch), fünf Punkte, aktiver Bereich als Pille in Vereinsfarbe mit Beschriftung, übrige nur Icon; „Mehr“ mit Kachel-Icon; weicht der Tastatur aus. `Screen` hält darunter Platz (`BottomTabBarHeightContext`) |
| Dunkelmodus                                        | Hintergrund → Karte → erhöhte Karte als Flächenstufen, Rahmen statt Schatten, Hero tief eingefärbt, `primaryText` für Text                        |

Entscheidungen in diesem Schritt:

- **Suche:** Knopf fehlt vorerst (siehe oben).
- **Kopfzeile:** Der Avatar entfällt (Profil steht in „Mehr“). Der Verwaltungs-Knopf bleibt vorerst als runder Knopf neben der Glocke
  und entfällt mit dem Schnellzugriff (Schritt Home/Mehr).
- **Ein Aufbau für alle Seiten:** Seitenhintergrund ist jetzt `background` (nicht mehr `surface`); Kopfzeile ohne Trennlinie.
- **Seite „Bausteine“** (`/bausteine`, nicht verlinkt): alle Bausteine hell und dunkel als Sicht- und Browserprüfung.
- Browserprüfung: `pnpm browser-check scripts/e2e/neuer-look-bausteine.mjs` (Tab-Leiste, Tippflächen ≥ 44, Umbruch langer Namen,
  Überblicksbild `.check/shots/neuer-look-bausteine.png`).

### Stand Schritt 2: Home (10.10.2026) ✅

Aufbau wie `HomeFinal`/`HomeDark`: Spiele (wischbar) → Offen → Deine Woche → Neuigkeiten für dich → Schnellzugriff → Verein im Überblick.
Bausteine in `components/home.tsx`, Seite `app/(tabs)/index.tsx`.

| Teil                | Umsetzung                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spiele              | `MatchCarousel`: Blickfangkarten (306 breit, auf schmalen Geräten so, dass die nächste ~60 pt herausragt), Punkte und „Nächste Spiele · 1 von 3“; API `home.matches` (bis 3, Spiele und Spielfeste, chronologisch, bei Eltern über alle Kinder) |
| Zu-/Absage          | `ResponseControls tone="hero"`: Schaltflächen `hero`/`heroOutline`; „Absagen“ und „Unsicher“ fragen den Grund im **Blatt von unten** (`Sheet`) ab                           |
| Offen               | `OpenBand`: wischbare Mini-Karten (232) mit Pastell-Kachel und Frist; die Aktion mit der nächsten Frist trägt den Statusrahmen. Umfragen öffnen ein Blatt mit den Antworten (Schnellantwort bleibt erhalten) |
| Deine Woche         | `WeekCard`: alle Termine der nächsten 7 Tage (`home.week`), Datumskachel 48×50, abgesagte durchgestrichen mit Chip „Abgesagt“ und Grund; Eltern sehen je Kind einen Chip; bei offener Rückmeldung runde ✓ (sagt zu) und ✕ (öffnet den Termin, dort wird der Grund abgefragt); Geburtstage der eigenen Mannschaften dezent darunter |
| Neuigkeiten         | Filterchips Alle · Verein · Mannschaft · Wichtig (auf den geladenen sechs News), höchstens vier Zeilen                                                                      |
| Schnellzugriff      | `QuickAccess`: wischbare Chips (46) mit Pastell-Kachel, „Hinzufügen“ gestrichelt; Katalog und Voreinstellung je Rolle in `lib/quick-links.ts` (Rechte prüfen weiterhin die Zielseiten bzw. der Server); Auswahl je Person in `users.quick_links` (`PUT /me/preferences`, höchstens 12), „Zurücksetzen“ stellt die Rollen-Voreinstellung her |
| Verein im Überblick | am Ende, Kennzahlen auf Pastellflächen (nur Vorstand/Vereinsmitglieder)                                                                                                     |

Entscheidungen und Abweichungen:

- **Verwaltung** steht im Schnellzugriff (Voreinstellung für alle mit Verwaltungsrechten); der Knopf in der Kopfzeile entfällt.
- **Noch offen aus dem Entwurf:** Hinweise an Schnellzugriff-Chips („1“ Kasse, „neu“ Fahrten), Absage direkt über ✕ in „Deine Woche“ (heute öffnet es den Termin),
  Spielekarte für abgesagte Spiele (abgesagte Spiele erscheinen nur in „Deine Woche“).
- Die Willkommens-Tour und der Pull-to-refresh bleiben unverändert.
- Browserprüfung: `pnpm browser-check scripts/e2e/neuer-look-home.mjs` (Eltern und Vorstand, hell und dunkel, Blatt beim Absagen, Schnellzugriff
  anpassen/zurücksetzen; Überblicksbild `.check/shots/neuer-look-home.png`).

