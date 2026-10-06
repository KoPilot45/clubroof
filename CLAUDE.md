# Clubroof – Arbeitsanleitung

Vereins-App (iOS, Android, Web) mit Web-Verwaltung. Sprache der Oberfläche und der Doku: **Deutsch**.
Grundlagen: `docs/PLAN.md`, `docs/FUNKTIONEN.md` (Stand je Funktion), `docs/ENTSCHEIDUNGEN.md`
(verbindliche Festlegungen), `docs/FARBKONZEPT.md`, `docs/DEMODATEN.md`.

## Aufbau (pnpm-Monorepo, TypeScript strict)

- `apps/api` – Fastify-Backend. `routes/` (HTTP), `services/` (Fachlogik), `api.test.ts` (Integrationstests gegen echte DB).
- `apps/mobile` – Expo SDK 57 / Expo Router. `src/app` (Bildschirme), `src/components`, `src/lib`.
- `packages/core` – gemeinsame Typen, Rechte, Rollen, Module, Fristenlogik, API-Verträge (`contract.ts`).
- `packages/db` – Drizzle-Schema, Migrationen (`drizzle/`), Demodaten (`src/seed`).
- `packages/design-tokens` – Farbkonzept (5 Vereinsfarben × hell/dunkel).

## Befehle

```
pnpm install · pnpm db:up · pnpm db:reset          # Datenbank + Demoverein
pnpm lint · pnpm typecheck · pnpm test             # vor jedem Commit
pnpm --filter @clubroof/db generate                # Migration nach Schemaänderung
```

Datenbanktests brauchen `DATABASE_URL=postgres://clubroof:clubroof@localhost:5432/clubroof`.
Demo-Logins: siehe `docs/DEMODATEN.md`, Passwort `clubroof-demo`.

## Prüfen und Browsercheck (spart Zeit und Nutzungsbudget)

Nicht jedes Mal neu zusammensetzen – diese Skripte nutzen:

```
pnpm check                     # Lint + Typprüfung + alle Tests (vor jedem Commit), knappe Ausgabe
pnpm check --grep="Kasse"      # nur passende API-Tests – schnell beim Entwickeln
pnpm check --routes            # nach neuen Bildschirmen: typisierte Routen neu erzeugen, dann prüfen
pnpm browser-check             # Web-Export bauen, API + Web starten, Start/Anmeldung prüfen
pnpm browser-check scripts/e2e/beispiel.mjs --no-build   # eigene Browserprüfung (Vorlage: beispiel.mjs)
pnpm browser-check --reset     # vorher Demodaten neu laden
```

- `pnpm check` startet PostgreSQL selbst und setzt `DATABASE_URL`. **Übersprungene Tests sind ein Fehler**
  (ohne Datenbank laufen die API-Tests nicht). Vollständige Logs liegen in `.check/`.
- Die Tests laden Demodaten mit festem Datum in die Entwicklungsdatenbank; `pnpm check` setzt sie danach
  automatisch mit `db:reset` zurück (sonst wirken Kader und Termine in der App leer oder verschoben).
- Beim Entwickeln nur den betroffenen Test (`--grep`); die komplette Prüfung **einmal vor dem Commit**.
- `scripts/lib/e2e.mjs` bietet `launch()`, `session('trainer')` (angemeldet), `loginAs`, `api`, `text`, `button`
  und `shot()`. Nach Änderungen an der Oberfläche eine Browserprüfung als Skript schreiben statt von Hand klicken.
- Der Web-Export ändert sich nur bei App-Änderungen – bei reinen API-Änderungen `--no-build`.
- Demo-Logins: `admin`, `vorstand`, `trainer`, `spieler`, `eltern`, `kasse`, `mitglied` (`@sv-gruen-weiss.example`).

## Arbeitsweise (Nutzungsbudget)

- **Screenshots nur, wenn sie nötig sind:** neue oder stark geänderte Oberfläche, optische Fragen, Fehler, die nur
  im Bild sichtbar sind. Bei Backend, Rechten, Logik und kleinen Änderungen genügen Tests und Textprüfungen.
  Wenn Bilder nötig sind: wenige, zu einer Übersicht zusammengefasst; nicht jedes Bild einzeln ansehen.
- **Artefakte, wenn sie sinnvoll sind:** wenn Vorstand oder Team etwas ansehen oder entscheiden soll (Entwurfs-
  oder Schriftvergleiche, Rollen-/Rechteübersicht, Funktionsstand, Klick-Entwürfe) – nicht als Ersatz für Code
  und nicht zum Sparen. Ein Artefakt kostet so viel wie jede andere Seite.
- Pro Funktionspaket eine frische Sitzung (`CLAUDE.md` und `docs/` tragen den Stand); Wünsche bündeln;
  bei Kleinigkeiten ohne Rückfrage nach Vorgabe entscheiden und die Entscheidung benennen.
- Große Dateien nur ausschnittsweise lesen; mechanische Suche/Auswertung an Hilfsagenten mit kleinerem Modell geben.
- Das stärkste Modell nur für Sicherheitsprüfung und große Umbauten, sonst Sonnet.

## Regeln

- **Texte sind Deutsch und zugleich der Übersetzungsschlüssel** (Englisch: `packages/core/src/locales/en.ts`). Neue Oberflächen-/Servertexte einfach deutsch schreiben;
  danach `node scripts/i18n.mjs todo` (fehlende Texte als JSON), übersetzen, `node scripts/i18n.mjs merge datei.json`. `pnpm check` schlägt bei fehlenden
  Übersetzungen fehl. Feste Bezeichnungen, die nicht übersetzt werden sollen: `<T verbatim>`. Keine Zeichenketten aus Fragmenten zusammenbauen,
  die einzeln übersetzt werden müssten (besser eine Vorlage-Zeichenkette mit `${name}`; Aufzählungen mit `' · '` verbinden). Datum/Zahl über `lib/format.ts`
  bzw. `dateFormat` aus `lib/i18n.ts`, nie `Intl…('de-DE')` direkt.

- Rechte nur **serverseitig** prüfen (`actorCan`, Scopes Verein → Bereich → Mannschaft). Rollen sind Rechtepakete,
  keine Personenarten (Kassenwart ist Zusatzaufgabe). Datensparsamkeit: Gründe/Quoten/Kontaktdaten nur für Berechtigte.
- Jede Tabelle mit fachlichen Daten trägt `club_id`. Zeiten in UTC speichern, Fristen in Vereinszeitzone.
- Neue Funktion = Backend-Service + Route + Test in `api.test.ts` + App-Bildschirm + Eintrag in `docs/FUNKTIONEN.md`
  - Eintrag in der Hilfe (`apps/mobile/src/lib/help-content.ts`).
- Zwischenüberschriften: `<Section title=…>` bzw. `<T variant="section">` (Oswald, Großbuchstaben, Akzentlinie in Vereinsfarbe) – keine eigenen Überschriftenstile.
- Große Zahlen: `<T variant="figure">`; Titel in Kopfzeilen: `variant="headline"` (Oswald). Alle anderen Texte laufen in Open Sans (`T` bzw. `Text` aus `components/app-text.tsx`); bei eingebundenen Schriften nie `fontWeight` voraussetzen.
- Farben nur aus dem Theme (`useTheme`): `primary` als Fläche, `primaryText` für Text/Icons, Statusfarben mit Beschriftung.
- Schemaänderung → Migration erzeugen **und** Seed anpassen; `pnpm db:reset` muss laufen.
- Kleine, thematisch getrennte Commits; Push auf den Entwicklungsbranch.

## Ablauf pro Funktionspaket

1. Paket in `docs/FUNKTIONEN.md` wählen. 2. Verträge in `contract.ts`. 3. Service, Route, Tests.
2. App-Bildschirme; Browserprüfung als Skript (`pnpm browser-check …`, siehe oben) statt von Hand durchklicken.
3. `pnpm check`, Doku aktualisieren, committen, pushen.
