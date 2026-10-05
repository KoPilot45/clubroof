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

## Schnellstart (Doppelklick)

Voraussetzungen: Node.js 22, pnpm (`corepack enable`) und Docker Desktop (muss laufen).

- **Windows:** `Clubroof-starten.bat` doppelklicken.
- **Mac:** `Clubroof-starten.command` doppelklicken (beim ersten Mal Rechtsklick → Öffnen).

Die Datei prüft die Bausteine, startet die Datenbank, setzt den Demoverein auf das heutige Datum zurück und
startet Backend und App gemeinsam. Danach öffnet sich die App unter <http://localhost:8081>.
Anmelden mit einem Demo-Login aus [docs/DEMODATEN.md](docs/DEMODATEN.md), Passwort `clubroof-demo`.

## Manuell (Terminal)

```bash
pnpm install
pnpm db:up                    # Datenbank (PostgreSQL) in Docker starten
pnpm db:reset                 # Schema anlegen und Demoverein einspielen
pnpm dev                      # Backend + App in einem Fenster (Beenden: Strg + C)
```

Einzeln starten: `pnpm --filter @clubroof/api dev` (API auf <http://localhost:3000>) und
`pnpm --filter @clubroof/mobile start` (Expo: Expo Go, Simulator oder „w“ für den Browser).
Auf einem echten Handy in `apps/mobile/.env` die Adresse des Rechners eintragen
(`EXPO_PUBLIC_API_URL=http://192.168.x.x:3000`).

Weitere Befehle:

| Befehl                                       | Zweck                                                      |
| -------------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                                   | Backend und App gemeinsam starten                          |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Qualitätsprüfungen (wie in der CI)                         |
| `pnpm format`                                | Code formatieren                                           |
| `pnpm db:generate`                           | Migration aus Schemaänderungen erzeugen                    |
| `pnpm db:migrate`                            | Migrationen ausführen                                      |
| `pnpm db:seed`                               | Demoverein neu anlegen                                     |
| `pnpm db:reset`                              | Lokale Datenbank komplett zurücksetzen (nur lokal erlaubt) |

Die Datenbanktests laufen, sobald `DATABASE_URL` gesetzt ist.
