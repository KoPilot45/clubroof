# Übergabeprompt: Kassen-Statistik (Paket ST)

Zum Einfügen in die Umsetzungssitzung. Das Paket ist in **zwei Stufen** geteilt; zuerst Stufe 1.

---

Paket **ST** (`docs/PAKETE.md`, Zeile ST) baut für die **Vereinskasse** und die **Mannschaftskasse** einen Statistik-Bereich mit Diagrammen. Alle Entscheidungen des Vorstands stehen in der Zeile; die bedienbaren Entwürfe sind die Vorgabe für Aufbau, Formen und Verhalten.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`, Zeile **ST** vollständig lesen (inkl. „Offen“); `docs/VEREINSKASSE.md`, `docs/FUNKTIONEN.md` (Kasse).
3. Entwürfe im Browser öffnen: `docs/design/anstoss/KassenStatistik.html` (Internet für die Schriften nötig). Die Diagramme sind bedienbar; der Quelltext zeigt Maße, Skalen und Tooltips.
4. Vorhandenes lesen: `app/club-cash/index.tsx`, `_layout.tsx` (Reiter), `teams/[id]/cash-stats.tsx`, `components/honeycomb.tsx`, `react-native-svg`, Kassen-Services und -Routen (`club-cash.ts`, `club-fees.ts`, `club-planning.ts`, `teams.ts`), Test in `api.test.ts`.

## Aufgaben Stufe 1 (jeweils eigener Commit, `pnpm check`)
1. **Server:** Aggregations-Endpunkte (`GET /club-cash/stats`, Erweiterung der Mannschafts-Kassenstatistik): Monatsreihen, je Bereich/Kategorie, Plan/Ist, Beitragsstatus und -eingang, Abteilungen, Vorjahr; Cent-Beträge, Vereinszeitzone; Rechte in der Service-Schicht. Tests in `api.test.ts`.
2. **Chart-Bausteine** in `components/charts/` (`LineChart`, `ColumnChart`, `BarRows`, `StackBar`, `Sparkline`, `ChartCard`, `Readout`) mit `react-native-svg`, Farben aus Theme/Tokens (Blau Einnahmen, Orange Ausgaben, weitere Reihen Aqua, Gelb; Werte und Prüfung in der Paketzeile), Marken-Maße wie festgelegt, Bewegung (LF) und „Bewegung reduzieren“, Beschriftungen für Bildschirmleser, „Als Tabelle“.
3. **Vereinskasse:** Übersicht neu (Hero mit Verlauf, drei Kennzahl-Kacheln, Balkenpaare je Bereich, „Alle Auswertungen ›“), Seite „Statistik“ mit Themen-Chips und Zeitraumwahl (Verlauf, Einnahmen & Ausgaben, Plan gegen Ist, Beiträge, Abteilungen), Direktlinks aus den Reitern Beiträge und Planung.
4. **Mannschaftskasse:** Kassenstand-Verlauf, Strafen je Person (Spitzenreiter in Akzentfarbe), Zahlungsmoral; Rechte (personenbezogen nur Berechtigte).
5. **Aufräumen:** Hilfe, `docs/FUNKTIONEN.md`, Übersetzungen, Browserprüfung `scripts/e2e/kassen-statistik.mjs`, Bilder neben die Entwürfe.

## Stufe 2 (danach)
Rücklagen-Zielbalken, Mannschaftskasse „Einnahmen und Ausgaben“ und „Woher das Geld kommt“, Strafen nach Art, Getränke, Sparziel: nach denselben Regeln ableiten und im Bericht als „abgeleitet“ kennzeichnen.

## Abnahme
Statistik-Seite mit allen Themen und Zeitraumwechsel; Anzeigezeile über dem Diagramm beim Fahren/Tippen; „Als Tabelle“ liefert dieselben Zahlen; Diagrammfarben wie festgelegt, Statusfarben nur mit Text; Unberechtigte erhalten nichts; hell und dunkel prüfen (Paket LH2). Am Ende kurze Liste erledigt / bewusst abweichend / offen.
