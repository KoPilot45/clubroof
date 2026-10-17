# Übergabeprompt: Nachträglich bearbeiten (Paket BE)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **BE** (`docs/PAKETE.md`, Zeile BE) macht alles bearbeitbar, was Nutzer in der App anlegen. Es ist in **drei Stufen** geteilt; setze eine Stufe nach der anderen um
(nach jeder Stufe `pnpm check`, Doku, Push). Die Entscheidungen des Vorstands (Umfragen mit Stimmen, Rechte, „bearbeitet“-Spur und Benachrichtigungen, Kassen bleiben beim Stornieren) stehen in der Zeile.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`, Zeile **BE** vollständig lesen; `docs/FUNKTIONEN.md`.
3. Vorbilder lesen: `apps/mobile/src/app/event-edit/[id].tsx` und die Server-Route `PATCH /events/:eventId` (Termin bearbeiten, „Zuletzt geändert“), das Sponsor-Bearbeiten-Fenster aus SP2 und `app/admin/news/[id].tsx` (News bearbeiten).

## Vorgehen je Objekt (jeweils eigener Commit)
1. **Daten:** `edited_at` ergänzen (Migration, Seed); `pnpm db:reset` muss laufen.
2. **Vertrag, Service, Route:** `Update…Input` als Teilmenge des Anlegen-Typs, `PATCH`, **Rechte in der Service-Schicht** (Ersteller **oder** Recht für den Bereich, Scopes Verein → Bereich → Mannschaft, `actorCan`), `edited_at` setzen, Audit und Benachrichtigung nach den Regeln der Paketzeile. Test in `api.test.ts` (Ersteller, Fremder → 403, Berechtigter, Sonderregeln).
3. **App:** Eintrag „Bearbeiten“ im „…“-Menü bzw. Stift-Symbol (nur für Berechtigte, Recht kommt vom Server in den Daten, **nie** nur in der App geraten); das **Anlege-Formular im Modus „bearbeiten“** (vorausgefüllt, „… bearbeiten“, „Änderungen speichern“, Dialog beim Verlassen), „bearbeitet · vor …“-Zeile. Gemeinsamer Baustein, keine Einzellösungen je Bildschirm.

## Reihenfolge
- **Stufe 1:** Umfragen, Vereinsveranstaltungen mit Helferschichten, Abwesenheiten, Dokumente.
- **Stufe 2:** Forum (Thema, Beiträge), Kommentare (bearbeiten und löschen), Übungen, Aushänge, Spielerbedarf/Angebote, Platzsperrungen.
- **Stufe 3:** Beitragsarten und Rücklagen in der App voll bearbeitbar, Ausrüstung, Schiedsrichter-Einsätze, Einladungscodes (erst prüfen, was sich ändern lässt).

## Zum Schluss je Stufe
Hilfe (`help-content.ts`, Abschnitt „Inhalte ändern“, Kasse mit Storno-Hinweis), `docs/FUNKTIONEN.md`, Übersetzungen (`node scripts/i18n.mjs todo` / `merge`), Browserprüfung `scripts/e2e/bearbeiten.mjs`.
Am Ende kurze Liste erledigt / bewusst abweichend / offen. Kassenbuchungen werden **nicht** bearbeitet (Stornieren und neu Buchen).
