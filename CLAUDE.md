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

## Regeln

- Rechte nur **serverseitig** prüfen (`actorCan`, Scopes Verein → Bereich → Mannschaft). Rollen sind Rechtepakete,
  keine Personenarten (Kassenwart ist Zusatzaufgabe). Datensparsamkeit: Gründe/Quoten/Kontaktdaten nur für Berechtigte.
- Jede Tabelle mit fachlichen Daten trägt `club_id`. Zeiten in UTC speichern, Fristen in Vereinszeitzone.
- Neue Funktion = Backend-Service + Route + Test in `api.test.ts` + App-Bildschirm + Eintrag in `docs/FUNKTIONEN.md`.
- Farben nur aus dem Theme (`useTheme`): `primary` als Fläche, `primaryText` für Text/Icons, Statusfarben mit Beschriftung.
- Schemaänderung → Migration erzeugen **und** Seed anpassen; `pnpm db:reset` muss laufen.
- Kleine, thematisch getrennte Commits; Push auf den Entwicklungsbranch.

## Ablauf pro Funktionspaket

1. Paket in `docs/FUNKTIONEN.md` wählen. 2. Verträge in `contract.ts`. 3. Service, Route, Tests.
2. App-Bildschirme; Web-Build (`pnpm --filter @clubroof/mobile export:web`) und im Browser durchklicken.
3. Prüfungen (lint, typecheck, test), Doku aktualisieren, committen, pushen.
