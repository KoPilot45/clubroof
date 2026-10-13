# Übergabeprompt: Optik-Nachbesserung 2 (Paket AO)

Zum Einfügen in die Umsetzungssitzung.

---

Das Design „Anstoß“ ist umgesetzt (Pakete AL, AN, AK, LH). Bei einem Durchgang durch 31 Bildschirme der Web-App sind Nachbesserungen aufgefallen. Es ändert **nur Aussehen und Beschriftungen**,
keine Fachlogik. Alles Wesentliche steht in `docs/PAKETE.md`, Paket **AO** (alle Entscheidungen des Vorstands sind dort eingearbeitet).

## Zuerst
1. `CLAUDE.md` lesen, dann den Planungsstand mergen: `git fetch origin claude/app-entwicklung-planung-183gtv`.
2. `docs/PAKETE.md`, Zeile **AO**, und `docs/DESIGN-ANSTOSS.md` (Abstände, Kacheln, Hero).
3. Referenzen in `docs/design/anstoss/index.html`. Prüfskript: `pnpm browser-check scripts/e2e/review-optik.mjs --no-build` (erzeugt Bilder `.check/shots/op-*.png`).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Oberer Rand (wichtigster Punkt):** Ursache ist bekannt. `Screen` in `components/ui.tsx` setzt im ScrollView `paddingTop: spacing.md + 2` (14 px); `HomePoster` in `components/home.tsx`
   gleicht das mit `marginTop: -(spacing.md + 2)` am `HeroCard` aus, doch `FadeIn` umschließt jedes Kind – der negative Rand wirkt nur innerhalb des Wrappers, der Wrapper bleibt 14 px versetzt.
   Ergebnis: dunkler Streifen über dem Plakat (gemessen: Pixelzeilen 0–13 in Hintergrundfarbe). **Behebung:** neue Eigenschaft `flushTop` an `Screen` (kein `paddingTop`, kein `gap` vor dem ersten Kind),
   Home und alle Seiten mit Plakat nutzen sie; negativen Rand entfernen. Dasselbe im Login-Plakat prüfen. Zusätzlich fürs Handy: `viewport-fit=cover`, `theme-color` je Theme,
   `html/body`-Hintergrund = Theme-Hintergrund, Plakat unter die Statusleiste (`insets.top` zum Plakat addieren, `StatusBar` translucent).
   **Abnahme:** Bild von Home bei 390 px, Pixelzeile 0 muss die Plakatfarbe zeigen (kein Hintergrundstreifen).
2. **Abschnittsabstände einheitlich:** **eine** Section-Komponente (vor 48, nach 18, Überschrift 22 px) für **alle** Seiten, keine lokalen Margins (erste Überschrift unter Kopfzeile/Hero 32 px).
   Betroffen: Termine, Aufgaben, Kasse, Admin-Übersicht, Vereinskasse, Strafenkatalog u. a. Das Prüfskript soll je Seite die Abstände zwischen allen Abschnittsüberschriften messen (müssen gleich sein).
3. **Mannschaftskasse:** Kachelzeile klebt am Hero (0 px) → 14 px Abstand (`DarkU5`).
4. **Kurze Überschriften:** einzeilig, Kontext steht in Kopfzeile/Brotkrumen. „Offene Beträge“ statt „Offene Beträge in der Mannschaft“, „Schiedsrichter“ statt „Meine Schiedsrichter-Einsätze“.
   Alle Überschriften der App prüfen (Ziel ca. 22 Zeichen), „Alle ›“ bricht nie um. Übersetzungen (`node scripts/i18n.mjs todo` / `merge`) nicht vergessen.
5. **Kurze Brotkrumen:** Stufen höchstens ca. 14 Zeichen („Team › Statistik › Training“, „Mannschaften“, „Mitglieder“), letzte Stufe immer ganz sichtbar, mittlere Stufen als „…“. Alle Brotkrumen-Beschriftungen auflisten und kürzen.
6. **Forum „Kein Zugriff“:** Hinweiskarte mit Schloss-Symbol im Muster der Zustandskarten (`DarkU12`), Seitenrand 22, Radius 22.
7. **Vereinskalender:** ein Filter-Knopf („Filter · 2“) mit Auswahlfenster (Arten, Mannschaften, Zurücksetzen, Trefferzahl) statt sechs Chip-Zeilen; Kalender direkt unter Umschalter und Filterknopf.
8. **Platzbelegung (Tag):** vierte Spalte („Verein …“) ist abgeschnitten → Spaltenbreite aus der Spaltenzahl berechnen oder sichtbarer Wischhinweis mit Randverlauf; Wochenansicht mitprüfen.
9. **Mehr, Meine Kinder:** Untertitel je Zeile nur „Spieler · Kreisklasse“; der Hinweis „Du verwaltest Termine, Zusagen und Abwesenheiten deiner Kinder.“ erscheint **einmal unter der Kinder-Karte**.

## Bleibt so (nicht ändern)
Trikotnummer-Plakette im Kader; Home-Bereich „Offen“ (der frühere Zusagen-Bereich ist bereits entfernt).

## Regeln und Abnahme
Regeln wie in `docs/UEBERGABE-ANSTOSS.md` (Tokens und Bausteine statt Einzelstile, Texte Deutsch/übersetzt, Barrierefreiheit, kleine Commits, Doku und Hilfe anpassen).
Abnahme: `review-optik.mjs` laufen lassen, Bilder neben die Referenzentwürfe legen, Abweichungen benennen und beheben; am Ende kurze Liste erledigt / bewusst abweichend / offen.
