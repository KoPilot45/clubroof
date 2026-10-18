# Übergabeprompt: Einrichtungsassistenten erweitern (Paket E2)

Zum Einfügen in die Umsetzungssitzung. Das Paket ist in **drei Stufen** geteilt; Stufe für Stufe, nach jeder Stufe `pnpm check`, Doku und Push. Der **Ladebildschirm** ist ein eigenes Paket (**LD**, `docs/UEBERGABE-LD.md`) und kann parallel oder danach übergeben werden.

---

Paket **E2** (`docs/PAKETE.md`, Zeile E2) baut die Einrichtungsassistenten aus Paket E aus: **Verein einrichten** (erweitert), **Mannschaft anlegen** (erweitert) und ein neuer **Kassen-Assistent**. Alle Entscheidungen des Vorstands stehen in der Zeile.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`: Zeile **E2** vollständig lesen (inkl. „Offen“), dazu „Paket E im Detail“; Zeilen **TH**, **AUF**, **ST** (Sichtbarkeitsschalter und Spielform werden im Mannschaftsassistenten gesetzt).
3. Entwürfe im Browser öffnen: `docs/design/anstoss/EinrichtungErweitert.html` (Internet für die Schriften nötig): je drei Beispielschritte der drei Assistenten.
4. Vorhandenes lesen: `app/setup.tsx`, `app/admin/team-new.tsx`, `components/wizard.tsx`, `app/demo/club.tsx`, `app/demo/team.tsx`, die Anmeldeseite (Demo-Buttons), `scripts/e2e/einrichtungs-demos.mjs`, Vereinskasse-Dienste (`club-cash.ts`, `club-fees.ts`, `club-planning.ts`), `services/facilities.ts` (Konfliktzählung).

## Stufe 1 (jeweils eigener Commit)
1. **Bausteine** in `components/wizard.tsx`: `WhyBox`, `OptionCard`, `HoursStepper`, `DateRangeField`, `RuleList`, `SummaryList`, `ModeChoice`, `MoreSettings`, `LaterHint`; Erklärtexte aus einer Stelle; Schnellstart und Ausführlich.
2. **Mannschaftsassistent:** neue und geänderte Schritte nach der Paketzeile (nur zwei Teilnahme-Modelle, „Automatisch zugesagt“ empfohlen, Fristen mit − und + und 24/48 vorbelegt, Training mit Zeitraum per Kalender, Kader, Funktionen und Sichtbarkeit, Spielplan, Information, Fertig mit Einladungstext).
3. **Platzbelegung:** Warnung erst ab drei überlappenden Terminen auf einem Platz, in der ganzen App und in den Tests.

## Stufe 2
4. **Vereinsassistent erweitert** nach der Paketzeile; „Kasse nutzen“ ist nur ein Schalter.

## Stufe 3
5. **Kassen-Assistent** (Verein, 14 Schritte) und **Mannschaftskasse einrichten** (kurz), Start aus leerer Kasse, „Nächste Schritte“ und Admin-Übersicht.
6. **Demo-Button „Kasse einrichten“** auf der Anmeldeseite (`app/demo/cash.tsx`), `scripts/e2e/einrichtungs-demos.mjs` für alle drei Assistenten.

## Abnahme
Alle drei Assistenten im Schnellstart und ausführlich durchlaufen (Browserprüfung); Zusammenfassung mit „Ändern“; Demo-Modus ohne gespeicherte Daten; Platzwarnung erst ab drei Gruppen; Bilder neben die Entwürfe, Abweichungen benennen; am Ende kurze Liste erledigt / bewusst abweichend / offen. **Offen:** (a) Modell „Nur Abwesenheiten“ in Bestandsmannschaften, (b) Parallelnutzung je Platz einstellbar? Beides vor dem Start bestätigen lassen.
