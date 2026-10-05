# Clubroof

> „Dein Verein unter einem Dach.“

Clubroof ist eine Vereins-App für iOS und Android mit Web-Verwaltung. Sie bringt Vorstand, Trainer, Eltern und
Spieler eines Fußballvereins an einem Ort zusammen: Termine & Zusagen, Teams, Vereinsleben, Ehrenamt, Kasse,
Dokumente und Verwaltung.

## Dokumentation

- [Analyse & Entwicklungsplan](docs/PLAN.md)
- [Farbkonzept](docs/FARBKONZEPT.md)
- [Demodaten](docs/DEMODATEN.md)
- [Funktionsliste mit Umsetzungsstand](docs/FUNKTIONEN.md)
- [Festlegungen](docs/ENTSCHEIDUNGEN.md)

## Projektstruktur

```
apps/
  api/                # Backend (Fastify, PostgreSQL): Login, Home, Termine, Zu-/Absagen
  mobile/             # App für iOS, Android und Web (Expo SDK 57, Expo Router)
  admin/              # (folgt) Web-Verwaltung
packages/
  core/               # Fachliche Grundlagen: Rollen, Berechtigungen, Module, Aufzählungen
  design-tokens/      # Farbkonzept (5 Vereinsfarben × hell/dunkel), Abstände, Typografie
  db/                 # Datenbankschema (Drizzle/PostgreSQL), Migrationen, Demodaten
infra/                # Docker Compose für die lokale Entwicklung
```

## Lokale Entwicklung

Voraussetzungen: Node.js 22, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env          # optional: eigene Datenbank-URL
pnpm db:up                    # Datenbank (PostgreSQL) in Docker starten
pnpm db:reset                 # Schema anlegen und Demoverein einspielen
```

Backend und App starten (zwei Terminals):

```bash
pnpm --filter @clubroof/api dev       # API auf http://localhost:3000
pnpm --filter @clubroof/mobile start  # Expo: App in Expo Go, im Simulator oder mit „w“ im Browser
```

Anmelden mit einem Demo-Login aus [docs/DEMODATEN.md](docs/DEMODATEN.md), Passwort `clubroof-demo`.
Auf einem echten Handy in `apps/mobile/.env` die Adresse des Rechners eintragen
(`EXPO_PUBLIC_API_URL=http://192.168.x.x:3000`).

Weitere Befehle:

| Befehl                                       | Zweck                                                      |
| -------------------------------------------- | ---------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Qualitätsprüfungen (wie in der CI)                         |
| `pnpm format`                                | Code formatieren                                           |
| `pnpm db:generate`                           | Migration aus Schemaänderungen erzeugen                    |
| `pnpm db:migrate`                            | Migrationen ausführen                                      |
| `pnpm db:seed`                               | Demoverein neu anlegen                                     |
| `pnpm db:reset`                              | Lokale Datenbank komplett zurücksetzen (nur lokal erlaubt) |

Die Datenbanktests laufen, sobald `DATABASE_URL` gesetzt ist.
