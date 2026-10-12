# Übergabeprompt: Design „Anstoß“ und Bewegung (Pakete AL und LF)

Zum Einfügen in eine frische Umsetzungssitzung.

---

Du setzt in Clubroof das neue Design „Anstoß“ (dunkel) und die dazugehörigen Bewegungen und Haptik um. Es ändert **nur das Aussehen und
das Gefühl**, keine Fachlogik und keine Rechte. Bestehende Funktionen, Tests und Texte bleiben erhalten.

## Zuerst lesen (in dieser Reihenfolge)
1. `CLAUDE.md` (Regeln, Befehle, Arbeitsweise) – gilt unverändert.
2. `git fetch origin claude/app-entwicklung-planung-183gtv` und diesen Planungsstand in deinen Entwicklungsbranch mergen (dort liegen die
   neuen Dokumente und Referenzentwürfe).
3. `docs/DESIGN-ANSTOSS.md` – **verbindliche Vorgabe** für Farben, Maße, Schrift, Abnahme.
4. `docs/design/anstoss/index.html` im Browser öffnen: alle Referenzentwürfe (38 Bildschirme, dunkel, als HTML mit allen Maßen im Quelltext).
   `ProtoLF.html` dort zeigt nur die **Bewegung** (Farben darin sind veraltet).
5. In `docs/PAKETE.md` die Pakete **AL** (Look Anstoß, Plakat-Kürzel), **LF** (Bewegung, Fotos, Gedrückt-Zustand, Haptik), **PL** (Mannschaftsfarben nur
   für Mehrfach-Zugehörige, Kaderzusammensetzung, Kleinigkeiten) und **ZE** (Zeitauswahl usw., falls noch nicht fertig).
   Zeilen „✅“ sind erledigt, nicht noch einmal anfassen.

## Ziel
Jeder Bildschirm der App sieht aus wie sein Referenzentwurf (Maße, Farben, Reihenfolge, Texte dürfen von den Beispieltexten abweichen). Wo es keinen
eigenen Entwurf gibt, gilt die nächstliegende Vorlage (Liste = U1, Detail = U2, Formular = U3, Kasse = U5/U10, Personen = U6, Auswertung = U7,
Lesetext = U8, Verwaltung = U9, Aktionen = U13–U16, Zustände = U12). Abweichungen von der Vorgabe nur nach Rückfrage.

## Reihenfolge (jeweils eigener Commit, nach jedem Schritt `pnpm check`)
1. **Design-Tokens dunkel je Vereinsfarbe** in `packages/design-tokens`: Hintergrund, Flächen, Text-Stufen, Akzent und Text auf Akzent, Plakat-Verlauf (p1/p2),
   Status, Kategoriefarben, Kopfbänder (Verwaltung, Vereinskasse), Clubroof-Farben für Anmeldung und Einrichtung. Werte für Grün, Blau, Rot, Gelb stehen in der Doku;
   für die übrigen Vereinsfarben nach der dortigen Ableitungsregel berechnen und **Kontrast prüfen** (Test oder Skript, Text auf Akzent und weißer Text auf Plakat ≥ 4,5 : 1).
   Dunkel wird zunächst die einzige Darstellung; die Einstellung „Darstellung“ bleibt im Code vorbereitet (später „Hell“).
2. **Gemeinsame Bausteine** (`components/ui.tsx`, `app-text.tsx`, `tab-bar.tsx`, `app-header.tsx` usw.): Fläche, Chip, Knopf (Haupt, neben, Gefahr), Kachel mit Kennzahl, Ticket,
   Abschnitt, Liste als eine Fläche mit Trennlinien, Feld, Segment, Fenster von unten, Dialog, untere Leiste (schwebende Kapsel, aktiver Reiter mit Beschriftung),
   Kopfbänder. **Keine eigenen Stile je Bildschirm.**
3. **Bewegung und Haptik (Paket LF)** gleich in den Bausteinen: Gedrückt-Zustand überall (Skalierung 0,97, ca. 100 ms), Hochzählen großer Zahlen (ca. 0,9 s),
   gestaffeltes Einblenden nur beim ersten Laden (350 ms, 70 ms Abstand), Balken füllen sich (0,8–0,9 s), Reiter-Kapsel gleitet (380 ms, leichtes Nachschwingen),
   Kopfzeile schrumpft beim Scrollen (Titel 32 → 22 px über 60 px). **„Bewegung reduzieren“ des Systems schaltet alles ab**, Zahlen stehen dann sofort da.
   Haptik an den im Paket genannten Stellen, in „Konto & Einstellungen“ abschaltbar („Vibration“), im Web ohne Wirkung. Werte stammen aus `ProtoLF.html`.
4. **Hauptmenü**: Home (Plakat „5 TAGE“, Kinderkarten, Ticket-Woche, News-Bildkarten), Team, Termine, Verein, Mehr nach `DarkHome`, `DarkTeam`, `DarkTermine`,
   `DarkVerein`, `DarkMehr`. Plakat-Hintergrund = Vereinskürzel (Schritt 6), bis dahin Rasenstreifen (`DarkBg1`) als Rückfall.
5. **Unterseiten** nach Vorlage U1–U16, dann **Anmeldung und Einrichtung** (`DarkLogin1/2`, `DarkSetup1–5`).
   Dabei umsetzen: Löschen fragt **immer** nach („Wirklich löschen?“ mit Namen, Verschieben ins Archiv), Aktionen in „…“-Menüs statt offener Knöpfe,
   Statusfarben immer mit Symbol oder Text, bei roter Vereinsfarbe „Dringend“ in Bernstein.
6. **Vereinskürzel (Paket AL)**: neues Feld am Verein (2–4 Zeichen, Großbuchstaben und Ziffern, Vorgabe aus den Initialen des Kurznamens; Migration **und** Seed,
   Vertrag in `contract.ts`, Route mit Rechteprüfung, Test in `api.test.ts`, Eintrag in `docs/FUNKTIONEN.md` und Hilfe). Eingabe in Verwaltung → Verein & Design mit Live-Vorschau
   (`DarkU11`) und im Einrichtungsassistenten beim Namen (`DarkSetup2`). Darstellung als Plakat-Wasserzeichen **immer auf gleiche Breite gesetzt** (ca. 320 von 390 px, Höhe folgt der
   Zeichenzahl, Umriss + Füllung wie in der Doku), außerdem Wappen-Ersatz ohne Logo. Gegenproben: `DarkK2` (2 Zeichen), `DarkK3` (4), `DarkK4` (Gelb).
7. **Rest aus PL**: Mannschaftsfarben nur für Mehrfach-Zugehörige (max. 5 Farben, je Person stabil, Kürzel bleibt Zweitmerkmal), Kaderzusammensetzung im Team-Hero
   (Top-Torschütze entfällt), „Vergeben“ / „+ Neu“ im Strafenkatalog, Löschen-Rückfrage überall prüfen, „Erledigt“ zurücknehmen wo sinnvoll.
8. **Fotos (Paket LF)**: Personenfoto statt Initialen im Avatar, wo vorhanden (kein Mannschaftsfoto, keine Einwilligungsabfrage vorerst).

## Regeln für dich
- Texte sind Deutsch und Übersetzungsschlüssel (`node scripts/i18n.mjs todo` / `merge`), neue Texte übersetzen.
- Rechte nur serverseitig; hier ändert sich nur beim Kürzel etwas am Server.
- Barrierefreiheit: antippbare Elemente mit Text oder `accessibilityLabel` (`pnpm check --only=a11y`), mindestens 44 pt, Schriftgröße-Einstellung muss weiter wirken, Kontrast prüfen.
- Kleine, thematisch getrennte Commits, Push auf den Entwicklungsbranch, `docs/FUNKTIONEN.md` und `help-content.ts` anpassen, wo sich Bedienung ändert.
- Bildschirme in der Browserprüfung als Skript öffnen (`pnpm browser-check`, Demodaten); Bilder nur gezielt und zu Übersichten zusammengefasst ansehen.

## Abnahme
Für jede Referenzdatei den passenden Bildschirm öffnen, **neben den Entwurf legen** und Abweichungen in Maß, Farbe, Reihenfolge, Schrift benennen und beheben. Kontrastprüfung je Vereinsfarbe.
Am Ende eine kurze Liste: erledigt, bewusst abweichend (mit Grund), offen. Nicht Teil dieser Sitzung: heller Stil, Statistik-/Kassenverlauf (Paket ST), Mannschafts-Einrichtung im neuen Look (nur wenn Zeit), Widgets und Mitteilungs-Aktionen.
