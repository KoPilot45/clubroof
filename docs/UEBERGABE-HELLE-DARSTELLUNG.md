# Übergabeprompt: Helle Darstellung als Standard und Optimierung (Paket HELLE-DARSTELLUNG)

Zum Einfügen in die Umsetzungssitzung. Größe M. **Branch:** Der Nutzer erlaubt ausdrücklich, direkt auf `claude/app-entwicklung-planung-183gtv` zu pushen (kein eigener Branch, kein Pull Request); Pull-Rebase vor jedem Push; höchstens eine Umsetzungssitzung gleichzeitig. Nach dem ersten Push prüfen, dass der Commit auf diesem Branch liegt. **Nur die App ändern** (kein Verkaufs-PDF, kein Webseiten-Entwurf, keine Mockups).

---

Paket **HELLE-DARSTELLUNG** (`docs/PAKETE.md`, gleichnamige Zeile). Die helle Darstellung ist ab jetzt der Standard der App; Nutzer wechseln selbst auf Dunkel oder „Wie Gerät“. Zusätzlich ist die helle Variante an mehreren Stellen nachzubessern (Befunde unten stammen aus einem Browserlauf vom 06.11.2026 mit `SCHEME=light pnpm browser-check scripts/e2e/hell-uebersicht.mjs --reset`; Bilder entstehen in `.check/shots/`).

## Zuerst
`CLAUDE.md`; Planungsstand holen (`git fetch origin claude/app-entwicklung-planung-183gtv`); lesen: `apps/mobile/src/lib/appearance.ts`, `lib/theme.tsx` (`ThemeProvider`), `app/account.tsx` (Auswahl Hell / Dunkel / Wie Gerät), `components/home.tsx` (`HomePoster`, `PosterSlide`), `components/ui.tsx` (`HeroCard`), `components/tab-bar.tsx`, `packages/design-tokens/src/colors.ts` (`heroColors`, Anstoß-Rollen hell), `docs/FARBKONZEPT.md`, `docs/DESIGNSYSTEM.md`.

## A. Helle Darstellung als Standard (zuerst, klein)
1. `appearance.ts`: Vorgabe `current` und Server-Schnappschuss von `'system'` auf `'light'`. **Wichtig:** `setAppearance('system')` speichert heute `null` (= nicht gesetzt). Künftig `'system'` ausdrücklich speichern, sonst fällt „Wie Gerät“ nach dem Neustart auf Hell zurück. Bereits gespeicherte Wahlen bleiben erhalten; Konto & Einstellungen zeigt „Hell“ als gewählt, solange nichts anderes gespeichert ist.
2. Vereinsstandard `clubs.colorMode`: Schema-Vorgabe `system` → `light` (Migration; bestehende Vereine **nicht** umstellen), Rückfall in `apps/api/src/services/setup.ts` (`input.club.colorMode ?? 'system'`), Vorgabe und „Empfohlen“-Markierung im Vereinsassistenten (`setup.tsx`, `colorMode: 'system'`), Tests und Seed anpassen (`pnpm db:reset`). `users.colorMode` ist bereits `light`.
3. Prüfen und anpassen, wo sonst „wie Gerät“ steckt: `app.json` (`userInterfaceStyle`), Web-`color-scheme`/`theme-color`, Statusleiste, Ladebildschirm. Das Verhalten für „Wie Gerät“ muss erhalten bleiben.
4. **Entschieden am 06.11.2026 (nicht neu verhandeln):** (a) **Anmeldeseite und Einrichtung ohne Verein werden ebenfalls hell.** Heute erzwingt `ThemeProvider` bei `key === 'clubroof'` immer das dunkle Thema (`anstossTheme('clubroof')`). Es braucht eine **helle Fassung des Clubroof-Themas** in `packages/design-tokens` (Marke wie auf dem Webseiten-Entwurf: Hintergrund `#F5F8FF`, Flächen weiß, Akzent `#0B3BEF`, Verlauf `#002AFA` bis `#00C3FF`, Text `#0A1230`) mit Kontrasttest, und `ThemeProvider` folgt der gewählten Darstellung auch ohne Vereinsfarbe (Standard hell, Dunkel weiter möglich). Anmeldeseite (auch Desktop, zweigeteilt) und alle Einrichtungsassistenten in beiden Darstellungen prüfen. (b) **Demoverein auf hell umstellen** (Seed: `colorMode: 'light'`); es gibt noch keine anderen Vereine, eine Migration für „bestehende Vereine“ ist nur für die Entwicklungsdatenbank nötig (`UPDATE clubs SET color_mode = 'light' WHERE color_mode = 'system'`) und darf einfach alle treffen. (c) **„Spiel ansehen“ ist ein Knopf** (weiße Fläche, grüne Schrift, abgerundet) in der Fußzeile des Plakats, keine Textverknüpfung.

## B. Optimierung der hellen Variante (Befunde, jeweils mit Bild vorher/nachher)
1. **Start-Plakat (`HomePoster`/`HeroCard poster`):** Der Verlauf läuft nach unten in die helle Seitenfarbe aus; die weiße Schrift („Spiel ansehen ›“, Seitenpunkte) steht auf fast weißem Grund und ist kaum lesbar. Im Dunkelmodus funktioniert das, weil der Grund dunkel ist. Lösung: Plakat als **geschlossene Vereinsfarbfläche mit gerader Unterkante (keine Rundung unten)** bis unter „Spiel ansehen“, Text immer mindestens 4,5 : 1. Dunkel unverändert lassen. **Vorlage: `docs/design/anstoss/HellStart.html`** (Mockup mit Vorher/Nachher, Hell/Dunkel, Knopf).
2. Rund 100 px leere Fläche zwischen Balkenlegende und „Spiel ansehen“ verkleinern.
3. „Zum Spiel ›“ (Hellgrün auf Grün) hat zu wenig Kontrast und wird vom runden Wischpfeil rechts überdeckt: Anordnung entflechten, Text in `onHero`.
4. Zusage-Balken (Grün) hebt sich im Hellen kaum vom Plakatgrund ab: Balkenfarben und Trennkante prüfen, Beschriftung bleibt.
5. **Schwebende Tab-Leiste:** halbtransparent, Text dahinter scheint durch (Verein „Aktuelles und Mitmachen“, Ich, Termin-Detail, Admin, Start „Diese Woche“); unterer Abstand zu knapp, Antwortknöpfe der Termine liegen teilweise darunter. Leiste im Hellen deckend (oder deutlich stärker abgesetzt, mit Rand), Inhalt endet mit ausreichend Abstand darüber, auch am Desktop-Layout prüfen.
6. **Termin-Detail:** die Chips oben links („C1“, „Spiel“) sind dunkel auf dunkelgrün; Farben aus dem Theme (`onHero`-Chip) verwenden.
7. **Aufstellung:** „Veröffentlichen“ blassgrün mit weißer Schrift, Kontrast prüfen (deaktivierter Zustand erkennbar, aber lesbar).
8. **Vereinskasse:** Kachelbeschriftung „Beitragseingang“ bricht mitten im Wort um (schmale Kacheln): Schriftgröße, Umbruch oder kürzere Beschriftung.
9. **Durchgang** der übrigen Bildschirme in Hell (Team und Termine wirkten sauber): Mannschaftsassistent, Vereinsassistent, beide Kassenassistenten (seit 03.11. neu), Anmeldung, Profil, Mitglieder, Kader; gefundene Fehler gleich beheben.

## Vorgehen und Abnahme
- Arbeite in der Reihenfolge A, dann B1 bis B9, je Abschnitt ein Commit; `pnpm check` einmal vor dem Commit.
- Prüfung hell **und** dunkel (Dunkel darf sich nicht verschlechtern): `SCHEME=light ROUTES=/,/team,/termine,/verein,/mehr ROLES=trainer pnpm browser-check scripts/e2e/hell-kontrast.mjs --no-build` (nur betroffene Routen), dazu `hell-uebersicht.mjs` für die Bildübersicht (wenige Bilder, zu einer Übersicht zusammengefasst).
- Farben nur aus dem Theme (`useTheme`); keine neuen festen Farben außerhalb von Hero, Plakat, Kopfband, Spielfeld und Marke (`pnpm check --only=farben`).
- Abschlussbericht: Standard-Verhalten (neues Gerät, Nutzerwahl bleibt, „Wie Gerät“ bleibt), Bilder vorher/nachher je Befund, kurze Liste erledigt / abweichend / offen, Antworten auf die Rückfragen.
