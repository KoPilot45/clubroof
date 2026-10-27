# Sammel-Übergabeprompt: drei Pakete nacheinander (Stand 27.10.2026)

Zum Einfügen in die Umsetzungssitzung. **Arbeitsprinzip: ein Paket pro Sitzung.** Der Prompt ist so geschrieben, dass er in jeder neuen Sitzung unverändert wieder verwendet werden kann: Die Sitzung nimmt immer das **erste noch nicht erledigte** Paket der Liste, setzt es um und hält danach an.

---

## Reihenfolge

1. **EINRICHTUNG-ENTSCHEIDUNGEN** (L), Prompt: `docs/UEBERGABE-EINRICHTUNG-ENTSCHEIDUNGEN.md`
2. **KIND-EIGENER-ZUGANG** (M–L), Prompt: `docs/UEBERGABE-KIND-EIGENER-ZUGANG.md`
3. **MANDANTENBETRIEB** (L), **noch ohne eigenen Prompt, siehe Abschnitt „Paket 3“**

Reihenfolge begründet: Paket 1 ändert die Assistenten (nichts anderes hängt daran). Paket 2 ändert die Eltern-Kind-Verknüpfung (`guardianships`) und alle Stellen, die sie lesen. Paket 3 ändert die Konten- und Vereinsstruktur grundlegend und kommt deshalb zuletzt, damit es auf den fertigen Stand von 1 und 2 aufsetzt.

## Vorgehen in jeder Sitzung

1. `CLAUDE.md` lesen, Planungsstand holen: `git fetch origin claude/app-entwicklung-planung-183gtv`, dann **auf diesem Branch arbeiten** (siehe „Branch“).
2. In `docs/PAKETE.md` nachsehen, welche der drei Pakete schon mit ✔ oder ✅ markiert sind. **Nimm das erste, das es noch nicht ist.** Gibt es das Paket nur halb (Commits mit seinem Namen, aber keine ✔-Markierung), erst nachsehen, was fehlt, und dort weitermachen.
3. Den Prompt des Pakets lesen (Pfad oben) und genau danach arbeiten. Dessen Abschnitte „Festlegungen“ nicht neu verhandeln.
4. Nach dem Paket: `pnpm check` einmal vollständig, `docs/FUNKTIONEN.md` und `docs/PAKETE.md` (Zeile mit ✔, Datum, Abweichungen, offene Punkte) aktualisieren, Hilfe und Übersetzungen, pushen.
5. **Dann anhalten** und dem Nutzer einen kurzen Abschlussbericht geben (erledigt / abweichend / offen, Bildübersicht nur soweit im Paket verlangt). **Das nächste Paket nicht in derselben Sitzung beginnen**; dem Nutzer sagen, dass er für das nächste eine frische Sitzung mit diesem Prompt startet.

## Branch

Der Nutzer erlaubt ausdrücklich (Abweichung von einer automatisch vorgegebenen Branch-Anweisung der Sitzung): Arbeite und pushe **direkt auf `claude/app-entwicklung-planung-183gtv`**, ohne eigenen Branch und ohne Pull Request. Vor jedem Push `git pull --rebase origin claude/app-entwicklung-planung-183gtv`; bei Konflikten in Doku-Dateien beide Seiten behalten. Es läuft höchstens **eine** Umsetzungssitzung gleichzeitig. Nach dem ersten Push prüfen, dass der Commit auf diesem Branch liegt (`git log origin/claude/app-entwicklung-planung-183gtv -1`).

## Regeln für alle drei Pakete

- **Nur die App ändern.** Verkaufs-PDF, Webseiten-Entwurf (`docs/design/…`), Mockups und Designartefakte nicht anfassen oder neu erzeugen.
- **Nutzungsbudget:** `pnpm check` einmal vor dem Commit, beim Entwickeln nur `--grep`; Kontrastprüfung `hell-kontrast.mjs` nur für die betroffenen Routen (`ROUTES=… ROLES=…`), nicht über alle 474 Seiten; Bilder nur, wo ein Paket sie verlangt, zusammengefasst. Es gibt keinen Pull Request mehr, also auch kein Warten auf eine CI.
- **Übersetzungen:** Es gibt jetzt acht Sprachen (Deutsch, Englisch, Türkisch, Ukrainisch, Polnisch, Spanisch, Französisch, Arabisch). Neue Texte deutsch schreiben, dann `node scripts/i18n.mjs todo` und `merge`; `pnpm check` schlägt bei fehlenden Übersetzungen fehl. Für die Übersetzung der sechs weiteren Sprachen **einen** Hilfsagenten mit kleinerem Modell nacheinander einsetzen, nicht mehrere parallel (Nutzungsgrenze). Arabische Texte zusätzlich auf Rechts-nach-links-Darstellung ansehen, soweit sich die Oberfläche geändert hat.
- Schemaänderung: Migration **und** Seed, `pnpm db:reset` muss laufen; jede neue Tabelle mit `club_id`; Rechte nur serverseitig; Texte deutsch.
- Das stärkste Modell nur für Paket 3 (Review der Mandantentrennung), sonst Sonnet.

## Paket 3: MANDANTENBETRIEB (noch ohne ausformulierten Prompt)

Quellen zuerst lesen: `docs/PAKETE.md` (Zeile MANDANTENBETRIEB und Abschnitt Reihenfolge), `docs/ENTSCHEIDUNGEN.md` (Eintrag zur Vertriebs-Reihenfolge: Mandantenbetrieb kommt **vor** der Sicherheitsprüfung, „Mandantentrennung ist das größte Risiko“; keine Preise oder Kauflinks in der App), `docs/ROLLEN.md` (Punkt 15: Betreiber- und Support-Zugang strikt getrennt von Vereinsrechten, zeitlich begrenzt, nur mit Freigabe des Vereins, vollständig protokolliert), `docs/PLAN.md` (Abschnitt Vertrieb), `packages/db/src/schema/people.ts` (`users` ist bewusst vereinsübergreifend, `persons` trägt `club_id`).

Inhalt laut Paketzeile: **Vereine manuell anlegen** (Betreiber-Konsole), **Zuordnung per Einladungscode**, **Personen in mehreren Vereinen**.

**Das Paket ist noch nicht ausgearbeitet, deshalb gilt:**
1. **Zuerst nur ein Konzept** (`docs/MANDANTENBETRIEB.md`, höchstens zwei Seiten): Wer ist der Betreiber (eigene Rolle außerhalb der Vereine?), wie wird ein Verein angelegt und der erste Admin eingeladen, wie sieht der Einladungscode aus (Gültigkeit, Einmalnutzung, Missbrauchsschutz), wie wählt ein Konto mit mehreren Vereinen den aktiven Verein (Wechsler in „Ich“), was sieht der Betreiber nie (Vereinsdaten), wie läuft der zeitlich begrenzte, protokollierte Support-Zugriff mit Freigabe des Vereins. Dazu die **Auswirkungen auf bestehende Stellen** (Anmeldung, Einladungen, Caches und Offline-Speicher je Verein und Benutzer, Kalenderabo, Exporte, Benachrichtigungen, Suche, Archiv, Protokoll) und eine **Prüfliste der Mandantentrennung** (jede Abfrage `club_id`, Dateizugriffe, Links, Tokens, Hintergrundjobs).
2. **Das Konzept dem Nutzer vorlegen und auf Bestätigung warten.** Erst danach bauen. Offene Fachfragen (z. B. Konto ohne Verein, Verein löschen, Datenübernahme) als Frage an den Nutzer, nicht selbst entscheiden.
3. **Umsetzung** in kleinen Schritten mit je eigenem Commit: Datenmodell und Migration (bestehender Demoverein bleibt lauffähig), Betreiber-Konsole (eigener Bereich, nur für Betreiber), Einladungscode und Beitritt, Vereinswechsel, Support-Zugriff. **API-Tests zur Mandantentrennung** für jeden bestehenden Bereich (fremder Verein: kein Zugriff, auch nicht über IDs, Dateilinks und Suche); Wiederholung der Prüfungen aus PILOT-SICHERHEIT (F01, F02, F06, F07) im Mehr-Vereine-Fall.
4. **Abschluss mit Sicherheitsreview** (starkes Modell): gezielt die Stellen, an denen `club_id` fehlen könnte, plus Kontenwechsel und Cache-Trennung; Ergebnis als kurze Liste.
5. Für die Pakete DEMO-VEREIN, PLAENE-UND-ABO, STORE-REIFE, SICHERHEITSPRUEFUNG und TESTSERVER danach **nicht weitermachen** (eigene Prompts folgen).
