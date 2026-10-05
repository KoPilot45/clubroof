# Clubroof

> „Dein Verein unter einem Dach.“

Clubroof ist eine Vereins-App für iOS und Android mit Web-Verwaltung. Sie bringt Vorstand, Trainer, Eltern und
Spieler eines Fußballvereins an einem Ort zusammen: Termine & Zusagen, Teams, Vereinsleben, Ehrenamt, Kasse,
Dokumente und Verwaltung.

## Dokumentation

- [Analyse & Entwicklungsplan](docs/PLAN.md)
- [Farbkonzept](docs/FARBKONZEPT.md)
- [Demodaten](docs/DEMODATEN.md)

## Projektstruktur

```
apps/                 # (folgt) mobile – Expo-App, admin – Web-Verwaltung, api – Backend
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
pnpm db:up                    # PostgreSQL, MinIO und Mailpit starten
pnpm db:reset                 # Schema anlegen und Demoverein einspielen
```

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
