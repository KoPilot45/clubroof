# Übergabeprompt: Sponsoren-Umbau (Paket SP2)

Zum Einfügen in die Umsetzungssitzung.

---

Das Sponsoren-Modul (Paket SPO) ist umgesetzt. Paket **SP2** (`docs/PAKETE.md`, Zeile SP2) baut es um: Werbung wird **je Sponsor** gesteuert, der Container wird ein **Wischelement** im Stil „Anstoß“,
Banner und Stufen entfallen. Alle Entscheidungen des Vorstands stehen in der Zeile.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`, Zeile **SP2**; `docs/FUNKTIONEN.md` (Zeile Sponsoren-Modul); Design: `docs/DESIGN-ANSTOSS.md` und Entwürfe `docs/design/anstoss/DarkSpo*.html` (Einstieg `index.html`).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Daten:** Migration und Seed: `banner_url` und `tier` entfernen; `advertise` (bool, Standard aus) und `hide_for_youth` (bool, Standard aus) ergänzen. Bisherige Vereinseinstellung „Werbung an“ →
   `advertise = true` für bisher aktive Sponsoren; bisherige Zuordnung „Senioren, nicht Jugend“ → `hide_for_youth = true`; Zuordnungsfelder und vereinsweite Einstellung entfernen. `pnpm db:reset` muss laufen.
2. **Vertrag, Service, Route:** `contract.ts` anpassen; neuer **Auswahlendpunkt** für den Container: liefert **bis zu drei zufällige** Sponsoren, nur mit `advertise = true`, gültiger Laufzeit und – für Jugendspieler
   (Funktion Spieler in einer Mannschaft des Bereichs Jugend, eigenes Konto) – nur mit `hide_for_youth = false`. Auswahl je Sitzung stabil (Seed aus Sitzung), beim Ziehen zum Aktualisieren neu. Rechte nur serverseitig.
   **Test in `api.test.ts`:** Jugendspieler erhält keinen Sponsor mit gesetztem Schalter; ein Sponsor ohne Werbung erscheint nie im Container, aber in der Übersicht.
3. **Verwaltung** nach `DarkSpoAdmin` und `DarkSpoAdmin2`: Liste mit Chips („Werbung an“, „keine Werbung“, „nicht Jugend“) und Zeile „Werbung läuft für x von y Sponsoren“; Bearbeiten ohne Banner und ohne Stufe, mit Abschnitt „Werbung in der App“
   (Schalter „Als Werbung anzeigen“; darunter, nur wenn an, „Nicht bei Jugendspielern anzeigen“), Vorschau des Containers.
4. **Container** (Home unter Neuigkeiten, Team unter den Kacheln, Verein unter Neuigkeiten) nach `DarkSpoHome`, `DarkSpoTeam`, `DarkSpoVerein`: kompakte Zeile (Logo 52, Eyebrow „Unterstützt von“, Name, Slogan, „Anzeige“, Pfeil),
   **Wischen** nach links/rechts, Pager-Punkte (aktiv 22 px, Akzent) nur bei zwei oder mehr, **automatisches, sanftes Durchlaufen alle 6 Sekunden** (Verschieben/Überblendung ca. 450 ms, ease-out; pausiert beim Berühren/Wischen, im Hintergrund und bei „Bewegung reduzieren“ – dann nur Wischen), ein Container je Seite, nie in Anmeldung, Kasse, Chat, Kinderdaten. Bausteine aus `components/ui.tsx`, Bewegung/„Bewegung reduzieren“ beachten.
5. **Übersicht und Detail** (`DarkSpoUebersicht`, `DarkSpoDetail`): alle Sponsoren, 2 Spalten, ohne Gruppen; Detail ohne Banner, mit Knopf „Zur Webseite“ (extern, https).
6. **Aufräumen:** Hilfetexte (`help-content.ts`), `docs/FUNKTIONEN.md`, Übersetzungen (`node scripts/i18n.mjs todo` / `merge`), alte Banner- und Stufen-Texte entfernen.

## Abnahme
Home, Team, Verein mit 0, 1, 2 und 3 werbenden Sponsoren (Pager erst ab 2, kein Container bei 0); Jugendspieler-Konto sieht den Sponsor mit gesetztem Schalter nicht; Übersicht zeigt alle Sponsoren; Banner- und Stufenfelder nirgends.
Bilder neben die Referenzen `DarkSpo*` legen, Abweichungen benennen; am Ende kurze Liste erledigt / bewusst abweichend / offen. Entscheidung Vorstand: Eltern von Jugendspielern sehen die Werbung weiter.
