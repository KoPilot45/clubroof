# Übergabeprompt: Nachbesserung Design „Anstoß“ (Paket AN)

Zum Einfügen in die Umsetzungssitzung.

---

Das dunkle Design „Anstoß“ ist umgesetzt und wurde in der Web-App gegen die Referenzentwürfe geprüft. Es gibt Nachbesserungen und zwei Entscheidungen des Vorstands.
Es ändert **nur Aussehen und Aufbau**, keine Fachlogik.

## Zuerst lesen
1. `CLAUDE.md`; dann den Planungsstand mergen: `git fetch origin claude/app-entwicklung-planung-183gtv`.
2. `docs/DESIGN-ANSTOSS.md` – **aktualisiert**: Abschnitte „Hero-Hintergrund: Waben“ und „Startseite (Home)“ sind neu.
3. `docs/design/anstoss/index.html` – **aktualisierte Referenzentwürfe** (Home, Team, Termine, Verein, Mehr, Verwaltung, Login, Einrichtung, Verein & Design `DarkU11`).
4. `docs/PAKETE.md`, Paket **AN** (Befunde) und Paket **AL** (Kürzel-Zeile ist überholt).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Hero-Hintergrund = Waben** (Entscheidung Vorstand): ersetzt das Kürzel-Wasserzeichen und das Fadenkreuz. Gemeinsamer Baustein, Maße und Maske stehen in der Doku
   (Sechsecke Radius 24, Linie weiß 2 px, Deckkraft 0,24 im Plakat bzw. 0,18 in Hero-Blöcken, oben rechts am deutlichsten, ausgeblendet nach links/unten, **hinter** dem Inhalt).
   Einsetzen in Home-Plakat, allen Hero-Blöcken, Login-Kopf, Einrichtung (Vorschau), Willkommen- und Leerzuständen; **nicht** hinter Listen, Feldern, Fließtext.
   Das Vereinskürzel bleibt als Einstellung (Wappen-Ersatz), **wirkt nicht mehr auf den Hero**; Wasserzeichen-Code entfernen.
2. **Hero-Blöcke als vollständige Karte** (Befund 1): In Team (Kader), Termine, Verein, Mehr, Kasse, Admin-Übersicht und Vereinskasse ist der Verlauf bisher nur oben rechts sichtbar;
   links/unten verschwindet die Fläche im Hintergrund. Verlauf (`radial-gradient(120% 120% at 90% 0%, p1 0%, p2 60%, …)`, Radius 28) so einstellen, dass die ganze Karte erkennbar bleibt
   (siehe Referenzdateien `DarkTeam`, `DarkTermine`, `DarkVerein`, `DarkMehr`, `DarkU5`, `DarkU9`, `DarkU10`). Ursache vermutlich Radius/Endfarbe des SVG-Verlaufs in `components/ui.tsx`.
3. **Home**: den **Zusagen-Bereich entfernen** (Entscheidung Vorstand; Zu-/Absagen laufen über Kinderkarten, „Offen“ und Termine). Im Plakat den **Wisch-Slider mit den nächsten drei Spielen**
   (wie früher; Pager-Punkte und „Spiel 1 von 3 · wischen“ unten im Plakat, Referenz `DarkHome`, `DarkHomeBlau`, `DarkHomeRot`).
4. **Termin-Formular**: Treffpunkt-Umschalter „Standard der Man…“ ist abgeschnitten → Beschriftung „Standard“ (oder umbrechen).
5. **Verein & Design**: Reihenfolge wie `DarkU11` (Name, Kurzname, Kürzel, dann Vereinsfarbe); Kürzelfeld in Großbuchstaben mit Laufweite. Eine Vorschau ist vorerst nicht nötig.
6. Alles andere aus Paket AN (Nummern 4–6) **bleibt so bzw. ist egal**. Nicht geprüft und nachzuholen: Anmeldung mit bekanntem Verein, Einrichtungsassistent, Zeitwalze und Fenster von unten, Bewegungen auf dem Gerät,
   Home in Blau, Rot und Gelb, Kontrast je Vereinsfarbe.

7. **Verein-Reiter**: „Nächster Vereinstermin“ ist orange gefärbt – falsch (kam aus meinem Entwurf). Der Hero ist wie alle anderen **in der gewählten Vereinsfarbe** (Referenz `DarkVerein`); nur Verwaltung (violett) und Vereinskasse (blau) behalten ihre Bereichsfarbe.
8. **Heros exakt wie die Entwürfe**: Werte und messbare Abnahme (fünf Messpunkte, ±10 je Kanal, Kartenkante sichtbar) stehen in `docs/DESIGN-ANSTOSS.md`, Abschnitt „Hero-Blöcke: exakte Vorgabe“. Heros erst als erledigt melden, wenn die Messung besteht.

## Regeln und Abnahme
Regeln wie im ersten Übergabeprompt (`docs/UEBERGABE-ANSTOSS.md`): Tokens und Bausteine statt Einzelstile, Texte Deutsch/übersetzt, Barrierefreiheit, kleine Commits.
Abnahme: Bildschirme öffnen, **neben die aktualisierten Referenzdateien legen**, Abweichungen benennen und beheben; am Ende kurze Liste erledigt / bewusst abweichend / offen.
