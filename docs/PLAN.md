# Clubroof – Analyse & Entwicklungsplan

> „Dein Verein unter einem Dach.“
> Stand: 05.10.2026 · Grundlagen:
>
> 1. _Clubroof Verkaufsmappe_ (18 Seiten, Mockups & Positionierung)
> 2. _VereinsApp – Konzept & Systemarchitektur_, überarbeitet, Stand August 2026 (21 Seiten) – **maßgeblich bei Widersprüchen**

---

## 1. Produktverständnis

### 1.1 Kernidee

Eine **modulare, vereinsweite Fußball-App**: eine zentrale digitale Vereinsstruktur, innerhalb der jede Mannschaft
ihre eigene, individuell konfigurierte Team-App besitzt. Abgrenzung: nicht „mehr Features als SpielerPlus“, sondern
eine echte Vereinsebene mit zentralem Datenmodell, rollenbasierten Verwaltungsabläufen, teamübergreifender Planung.

### 1.2 Ein Verein – später mehrere (aber getrennt)

- **Start: ein Verein.** Die App ist _die_ App dieses Vereins; Nutzer gehören genau diesem Verein an.
- **Kein Vereins-Umschalter in der App.** (Der Pfeil ▾ neben dem Vereinsnamen in den Mockups ist kein bestätigtes
  Feature und wird nicht umgesetzt, solange nicht ausdrücklich gewünscht.)
- **Später (Phase 5 „Multi-Club“):** dieselbe Plattform wird an weitere Vereine verkauft (Abo je Verein,
  59,99–99,99 €/Monat laut Finanzmodell). Jeder Verein ist ein eigener, sauber getrennter Mandant.
- **Konsequenz für die Architektur:** Jeder zentrale Datensatz trägt von Anfang an eine `club_id`. Die Ausrollung
  auf weitere Vereine wird damit eine Skalierungs- statt einer Umbaufrage – ohne dass Nutzer im MVP etwas davon merken.

### 1.3 Produktprinzipien (Konzept §1) und ihre technische Folge

| Prinzip                                                                      | Technische Konsequenz                                                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Personen gehören dem Verein; Teamzuordnungen sind zeitlich und rollenbezogen | `Person` ≠ `User`; `TeamMembership` mit Zeitraum, Saison-Historie; Profil überlebt Mannschaftswechsel |
| Komplexität verbergen; Admins wechseln bewusst in einen Arbeitsmodus         | Getrennte Navigation „Verwaltungsmodus“ mit „Zur App zurück“                                          |
| Module konfigurierbar (1. Mannschaft ≠ Bambini)                              | Modul-/Einstellungssystem mit Vererbung Verein → Bereich → Mannschaft → Nutzer                        |
| Push auf das notwendige Minimum                                              | Prioritätsebenen, Opt-in für zusätzliche Kategorien, Sammelhinweise für Trainer                       |
| Kommunikation zweckgebunden – kein Messenger                                 | Kein Gruppenchat; nur News, Umfragen, Anfragen/Freigaben, Mini-Forum                                  |
| Neue Funktionen nur bewusst aktivieren                                       | Update-Center, neue Module standardmäßig aus, versionierte Konfigurationen                            |

### 1.4 Navigation

Vier Lebensbereiche + separater Verwaltungsmodus:

| Tab                               | Frage                            | Inhalte                                                                                                                                                                                               |
| --------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home** (personenbezogen)        | Was ist für mich jetzt relevant? | Widgets: News, nächste Termine, offene Aktionen, persönliche Kasse, Umfragen, persönliche Statistik – zusammengesetzt aus Modulen, Rolle, Alter; sortiert nach Priorität + Betroffenheit + Aktualität |
| **Team** (mannschaftsbezogen)     | Alles zu meiner Mannschaft       | Navigation entsteht aus aktivierten Modulen: Übersicht, Termine, Spiele, Training, Kader, Team, Statistik, Kasse, Dokumente/Aufgaben                                                                  |
| **Verein** (organisationsbezogen) | Alles über den Gesamtverein      | Vereinsübersicht, Mannschaften, Vereinskalender, Ansprechpartner, Dokumente, Helfer & Aufgaben, Mini-Forum                                                                                            |
| **Mehr**                          | Persönlicher Einstieg            | Profil, Einstellungen, Statistik, Benachrichtigungen, **Verwaltungsmodus**                                                                                                                            |

**Verwaltungsmodus** („App in der App“): eigene Navigation, dichtere Darstellung, Arbeitsbereiche
_Organisation_ (News, Umfragen, Veranstaltungen, Mitglieder, Rollen, Dokumente, Freigaben),
_Sport_ (Mannschaften, Spieler, Trainer, Saisonplanung, Spielerbewegungen, Gastspielerbedarf),
_Betrieb_ (Plätze, Kabinen, Material, Schlüssel, Aufgaben, Sperrungen),
_Kontrolle_ (Audit-Log, offene Vorgänge, Import-/Sync-Status, Update-Center).

**Design-Regeln:** Farben tragen Bedeutung (rot = dringend, orange = Aktion, blau = Organisation, grün = erledigt,
grau = archiviert); Mannschafts-Badges (B1, C2, 1., AH); feste Tags für Quelle (Verein, Jugend, Senioren, Team) und
Typ (Info, Wichtig, Spiel, Training, Veranstaltung, Umfrage, Aufgabe); einheitliche Icons. Vereinsdesign wählbar
(Primär-/Akzentfarbe, hell/dunkel/automatisch) **mit automatischer Lesbarkeitsprüfung**.

### 1.5 Rollen (Konzept §7)

Rollen sind **Sammlungen von Berechtigungen für definierte Bereiche**, keine starren Menüpakete; ein Nutzer kann
mehrere Rollen gleichzeitig haben.

| Rolle                   | Typische Verwaltungsfunktionen                                                   |
| ----------------------- | -------------------------------------------------------------------------------- |
| Fulladmin               | gesamter Verein, Rollen, Module, Kommunikation, Systemeinstellungen, Updates     |
| Vorstand/Vereinsleitung | Vereinsmonitor, Kommunikation, Mitglieder, Veranstaltungen, Dokumente            |
| Sportliche Leitung      | Kadergrößen, Spielerbewegungen, Trainer, Saisonplanung, Gastspielerlogik         |
| Jugendleitung           | Jugendteams, Trainerbedarf, Jahrgangsplanung, Saisonwechsel, Jugendkommunikation |
| Trainer                 | eigene Mannschaft, Termine, Kader, Training, Team, Bedarf/Angebote, Statistik    |
| Kassenwart              | Mannschaftskasse, Buchungen, Strafen/Getränke, Abrechnung                        |
| Platz-/Materialwart     | Belegung, Sperrungen, Material, Schlüssel, Schäden, Aufgaben                     |
| Mitgliederverwaltung    | Stammdaten, Ein-/Austritte, Profilprüfung, Mannschaftszuordnung                  |
| Schiedsrichterobmann    | Schiedsrichter, Verfügbarkeit, Zuweisungen, Lehrgänge                            |

Dazu die Nutzerrollen **Spieler**, **Elternteil** (Eltern-Kind-Verknüpfung), **Mitglied/Helfer**.
**Datensparsamkeit:** fremde Trainer sehen bei der Gastspielerplanung nur _aggregierte_ Verfügbarkeit, nicht den Grund.

### 1.6 Fachlogik, die das Konzept präzisiert

**Teilnahme-Modelle (je Mannschaft):**

- _Automatische Zusage_ – alle gelten als dabei, Countdown bis Absagefrist (z. B. Senioren)
- _Aktive Zu-/Absage_ – jeder muss reagieren (z. B. Jugend/Eltern)
- _Nur Abwesenheiten_ – keine Terminreaktion, globale Abwesenheiten steuern Verfügbarkeit

**Absagefristen** je Mannschaft _und_ Terminart (Training 2 h vorher, Spiel Freitag 18:00, Turnier 3 Tage);
nach Ablauf ist reguläre Absage gesperrt, Trainer können korrigieren.

**Abwesenheiten** (Urlaub, Verletzung, Krankheit, Schule/Beruf) pflegt der Spieler selbst, sie gelten für alle
relevanten Teams; Trainer dürfen stellvertretend korrigieren; getrennt von terminbezogenen Absagen.

**Gastspieler/Spielerbedarf:** Team meldet Bedarf („2–3 Spieler, bevorzugt Abwehr“), andere Trainer bieten
Kapazität an („bis zu 2 Spieler“); **der Trainer des abgebenden Teams wählt die Spieler aus**, fremde Trainer fragen
keine Einzelspieler direkt an. Der Gastspieler bleibt Mitglied seines Stammteams, wird als Event-Teilnehmer
hinzugefügt; Termin erscheint automatisch in seiner persönlichen Ansicht.

**Benachrichtigungen (Konzept §10):**

| Ebene              | Beispiele                                         | Standard                       |
| ------------------ | ------------------------------------------------- | ------------------------------ |
| Dringend           | kurzfristige Absage, wesentliche Verschiebung     | sofortiger Push + Notification |
| Persönlich wichtig | Gastspielnominierung, Kaderentscheidung, Freigabe | Push je nach Typ / Opt-in      |
| Aktion             | Umfrage, Aufgabe, Dokument, Fristerinnerung       | Notification; Push optional    |
| Info               | News, Ergebnis, Statistik                         | Notification/Feed, kein Push   |

Filter (Alle, Aktionen, Termine, Team, Verein, Verwaltung, Ungelesen), Deep Links, Aktionen verschwinden nach
Erledigung, Änderungen zeigen alt/neu, **Sammelhinweise für Trainer/Admins** statt Einzelmeldungen.

**Kommunikation (§11):** News (optional Reaktion/Lesebestätigung), Umfragen, Anfragen/Freigaben mit
zielgerichteten Kommentaren, Mini-Forum (wenige, moderierte Themen; Sichtbarkeit und Schreibrecht getrennt;
Ablaufdatum). Kein Gruppenchat.

**Einrichtung (§8):** Setup-Assistenten erzeugen Module, Navigation, Rechte und Defaults.
Konfigurationsprinzipien: _Vererbung_ (Verein → Bereich → Mannschaft → Nutzer), _Zustände_ (aktiviert / verfügbar
aber deaktiviert / übergeordnet gesperrt), _Komplexitätsstufen_ (Aus / Basis / Erweitert / Individuell),
_Einladungslogik_ (Admin lädt Trainer, Trainer laden Spieler/Eltern), _sichere Aktivierung_ (QR/Link, Zuordnung
wird verifiziert/freigegeben). Mannschafts-Vorlagen: leistungsorientiert, klassisch, Jugend, Freizeit.
Deaktivieren löscht keine historischen Daten.

**Updates (§13):** Systemupdate automatisch; Funktionsverbesserung behält Verhalten, neue Optionen aus; neues Modul
standardmäßig deaktiviert. Aktionen „Einrichten / Später / Nicht verwenden“; nur zuständige Rollen sehen relevante Updates.

**Optionaler Modul-Pool (§12):** Trainingsbibliothek, Spielerentwicklung, Belastung · Platz-/Kabinenplanung, Material,
Trikots, Schlüssel, Schäden, Wiki · Helferdienste, Turniere, Schiedsrichter · Eltern-Kind-Accounts, Fahrdienste,
Probetraining · Fundbüro, Marktplatz, Forum · Mannschaftskassen, später Mitgliedsbeiträge.

---

## 2. Technische Architektur

### 2.1 Entscheidungen (Stand 05.10.2026)

1. **Native App von Anfang an** – iOS und Android, Veröffentlichung in den Stores ist das Ziel (abweichend vom
   PWA-Ansatz des Konzepts §15).
2. **Gleichzeitig eine Web-Verwaltung** – für Vorstand, Kassenwart, Mitgliederverwaltung usw. am PC.
3. **Backend wie im Konzept:** modularer Monolith, PostgreSQL, S3-kompatibler Storage, Docker Compose,
   Caddy (nur HTTPS), VPS in Deutschland (z. B. IONOS), getrennte Backups.

### 2.2 Aufteilung App ↔ Web-Verwaltung

|            | Mobile App (Expo)                                                                                                        | Web-Verwaltung (Next.js)                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zielgruppe | alle Mitglieder, Spieler, Eltern, Trainer                                                                                | Rollen mit Verwaltungsrechten                                                                                                                                             |
| Inhalte    | Home, Team, Verein, Mehr + **schlanker Verwaltungsmodus** für unterwegs (Freigaben, News, Absagen, Gastspieler-Anfragen) | vollständige Verwaltung: Organisation, Sport, Betrieb, Kontrolle (Konzept §6), Setup-Assistenten, Massenbearbeitung, Tabellen, Exporte, Importe, Audit-Log, Update-Center |
| Stärke     | Push, schnelle Reaktion, Kamera/QR                                                                                       | große Bildschirme, Tabellen, Tastatur, Dateien                                                                                                                            |

Beide nutzen **dieselbe API, dieselbe Rechteprüfung und dieselben Fachregeln** (`packages/core`). Eine Funktion
wird einmal im Backend gebaut und erscheint dort, wo sie sinnvoll ist. Warum keine Web-Verwaltung aus der Expo-App
heraus (Expo Web)? Dichte Tabellen, Filter, Mehrfachauswahl und Exporte lassen sich mit Web-Technik deutlich
besser und schneller bauen; die App bleibt dafür schlank.

### 2.3 Stack

| Schicht        | Wahl                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mobile App     | Expo (React Native) + Expo Router, TypeScript strict, TanStack Query, React Hook Form + Zod, i18next (de)                                                                                                    |
| Web-Verwaltung | Next.js (App Router), TypeScript, TanStack Query/Table, React Hook Form + Zod, Tailwind + Komponentenbibliothek (z. B. shadcn/ui)                                                                            |
| Gemeinsam      | `packages/core` (Typen, Zod-Schemas, Rechte-, Fristen-, Vererbungslogik), `packages/api-client` (aus OpenAPI generiert), `packages/design-tokens` (Farben, Abstände, Schrift – gleiche Optik in App und Web) |
| Backend / API  | Node.js + TypeScript, NestJS als modularer Monolith, REST + OpenAPI                                                                                                                                          |
| Datenbank      | PostgreSQL + Drizzle ORM (versionierte SQL-Migrationen)                                                                                                                                                      |
| Auth           | eigene Auth: E-Mail + Passwort (Argon2) und Magic Link, Tokens für App, sichere Cookies für Web, **2FA für privilegierte Rollen**                                                                            |
| Jobs           | pg-boss (Queue auf Postgres) für Fristen, Erinnerungen, Sammelhinweise, Push-Versand                                                                                                                         |
| Push           | Expo Push Service (APNs/FCM); E-Mail über SMTP-Anbieter in der EU                                                                                                                                            |
| Dateien        | S3-kompatibel (MinIO lokal/selbst gehostet oder IONOS S3)                                                                                                                                                    |
| App-Builds     | EAS Build/Submit, interne Tests über TestFlight und Google Play Internal Testing                                                                                                                             |
| Betrieb        | Docker Compose, Caddy, Sentry (oder selbst gehostetes GlitchTip), Uptime-Monitoring, nächtliche Backups                                                                                                      |

### 2.4 Repository-Struktur

```
clubroof/
├─ apps/
│  ├─ mobile/      # Expo-App: iOS, Android
│  ├─ admin/       # Next.js Web-Verwaltung
│  └─ api/         # Backend (modularer Monolith, NestJS)
├─ packages/
│  ├─ core/        # Domänentypen, Zod-Schemas, Rechte- und Fristenlogik (von App und API geteilt)
│  ├─ design-tokens/ # Farben, Abstände, Typografie für App und Web
│  ├─ api-client/  # generierter, typisierter API-Client
│  └─ config/      # ESLint, TSConfig, Prettier
├─ infra/          # Docker Compose, Caddy, Backup-Skripte
├─ docs/           # Plan, Architekturentscheidungen (ADRs)
└─ .github/workflows/
```

Backend-Module (je eigener Ordner mit klaren Schnittstellen): `identity`, `club`, `teams`, `permissions`,
`modules` (Konfiguration & Vererbung), `events` (Termine/Teilnahme/Abwesenheit), `squad` (Kader/Gastspieler),
`communication` (News/Umfragen/Forum), `notifications`, `finance`, `documents`, `facilities`, `audit`, `integrations`.

### 2.5 Datenmodell (nach Konzept §14, ergänzt)

| Objekt                                          | Bedeutung                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Club / OrgUnit                                  | Verein; Bereiche Senioren/Jugend/Frauen/AH (Baum)                                                       |
| User                                            | Login, Auth, persönliche Einstellungen                                                                  |
| Person                                          | reale Person; bleibt über Mannschaftswechsel bestehen; ein User kann Personen verwalten (Eltern → Kind) |
| Season                                          | Saisonbezug und Historisierung                                                                          |
| Team / TeamMembership                           | Mannschaft; zeitlich definierte Zuordnung mit Funktion (Spieler, Trainer, Betreuer)                     |
| Role / Permission / RoleAssignment              | Rolle = Berechtigungsbündel, zugewiesen mit Scope (Verein / Bereich / Team)                             |
| ModuleConfig                                    | Modul + Zustand + Komplexitätsstufe + Optionen je Ebene, versioniert                                    |
| Event / EventParticipant                        | Training, Spiel, Veranstaltung; Teilnahme inkl. Gastspiel                                               |
| Absence                                         | globale Abwesenheit einer Person                                                                        |
| Match / Squad / Lineup                          | Spieldaten, Kader, Aufstellung, Ergebnis, Tore/Assists/Karten                                           |
| PlayerDemand / PlayerOffer                      | Spielerbedarf und Kapazitätsangebote                                                                    |
| Announcement / Poll / Task / ForumTopic         | Kommunikation und Aktionen                                                                              |
| Notification                                    | Ebene, Status, Zustellung, Erledigung                                                                   |
| CashAccount / Transaction                       | Mannschaftskasse, persönliche Konten, Strafen/Getränke                                                  |
| Document, Facility/Booking, AuditLog, ImportJob | Dokumente, Platzbelegung, Audit, Importe                                                                |

Alle fachlichen Tabellen tragen `club_id`. Berechtigungen werden **immer serverseitig** im Kontext Verein,
Bereich, Mannschaft und Rolle geprüft; die App blendet nur aus.

**Integrationen:** generischer Provider-Layer (manuell, CSV/SFTP; später FUSSBALL.DE/DFBnet, FuPa, SpielerPlus-Export
nur über offizielle Wege). Die interne Datenquelle bleibt immer eindeutig führend.

---

## 3. Datenschutz & Sicherheit

- Hosting in Deutschland/EU, AVV mit dem Verein, Verzeichnis der Verarbeitungstätigkeiten, TOMs
- Minderjährige: Eltern-Kind-Verknüpfung, eingeschränkte Sichtbarkeit von Kontaktdaten/Fotos
- Verletzung/Krankheit sind Gesundheitsdaten → nur für zuständigen Trainer sichtbar, andere sehen aggregiert „nicht verfügbar“
- Audit-Log für Rollen, Spielerbewegungen, wichtige Mitteilungen, Konfiguration
- 2FA für privilegierte Rollen, HTTPS überall, getrennte Backups (App, DB, Dateien) mit Kopie außerhalb des Servers
- Datenexport und Konto-Löschung in der App (für die App Stores Pflicht)
- Frühzeitig Datenschutzberatung einbinden

---

## 4. Phasenplan (Konzept §17, angepasst an App + Web-Verwaltung)

| Phase                     | Schwerpunkt                                                                                                                                                                                                                                           | Ergebnis                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **0 – Projektbasis**      | Monorepo, CI, Docker-Entwicklungsumgebung, API-Gerüst, App-Gerüst, Web-Gerüst, Auth, Rechte- und Modul-Kern, Design-Tokens; parallel: Wireframes Spieler/Trainer/Fulladmin, Store-Konten beantragen                                                   | alles läuft lokal, erster TestFlight-/Play-Testbuild |
| **1 – Fundament**         | **Web:** Vereins-Setup, Bereiche, Mannschaften + Setup-Assistent, Mitglieder, Rollen, Einladungen. **App:** Einladung annehmen (QR/Link), Home, Team, Termine, drei Teilnahme-Modelle, Absagefristen, Abwesenheiten, News, Notification-Center + Push | **ein Verein produktiv nutzbar** (Pilot)             |
| **2 – Teamorganisation**  | Kader, Gastspieler, Statistik (Aus/Basis/Erweitert), Kasse (Strafen/Getränke), Umfragen, Dokumente                                                                                                                                                    | SpielerPlus-nahe Kernfunktionen mit Vereinslogik     |
| **3 – Verwaltungsportal** | Saisonplanung, Spielerbedarf-Börse, Plätze/Ressourcen, Helfer & Aufgaben, Audit-Log, Update-Center, Mini-Forum                                                                                                                                        | Vereinsprozesse über Mannschaftsgrenzen hinweg       |
| **4 – Erweiterungen**     | Integrationen (CSV, FUSSBALL.DE …), Trainingsplanung, Material, Turniere, Community-Module                                                                                                                                                            | nur nach echtem Bedarf                               |
| **5 – Multi-Club**        | weitere Vereine als Mandanten, Abo-Abrechnung, größere Infrastruktur                                                                                                                                                                                  | Skalierung auf Basis derselben Architektur           |

Öffentliche Store-Veröffentlichung: sobald der Pilotverein Phase 1 stabil nutzt (Testbuilds laufen ab Phase 0).

## 5. App-Store-Checkliste (für später, aber früh vorbereiten)

- Apple Developer Program als **Organisation** (D-U-N-S-Nummer nötig, Vorlauf mehrere Wochen), Google Play Console als Organisation
- Bundle-/Package-ID früh festlegen (z. B. `de.clubroof.app`)
- Datenschutzangaben (Apple Privacy Labels, Google Data Safety), Impressum, Datenschutzerklärung
- Konto-Löschung in der App, Demo-Zugang für die Prüfung, ggf. „Sign in with Apple“ bei Social Logins
- Abo-Modell: Verein bucht und zahlt außerhalb der App (B2B) → für Mitglieder ist die App kostenlos; das ist mit den Store-Richtlinien in der Regel vereinbar, vor dem Launch prüfen

---

## 6. Qualität & Arbeitsweise

- TypeScript strict, ESLint/Prettier, Conventional Commits, geschützter `main`, Pull Requests mit Review
- Tests: Unit-Tests für Rechte-, Fristen- und Vererbungslogik (`core`), API-Integrationstests gegen echte Postgres-Instanz,
  E2E-Tests der Hauptflows (Einladen → Zusagen → Frist → Absage gesperrt)
- CI: Lint, Typecheck, Tests, Docker-Build; Deployment auf Staging automatisch, Produktion per Freigabe
- Umgebungen: lokal (Docker Compose) · Staging · Produktion

---

## 7. Offene Entscheidungen

1. ~~Frontend~~ → entschieden: native App (Expo) + Web-Verwaltung (Next.js), siehe §2.1
2. Welche Teamfunktionen gehören in Phase 1, welche bleiben Module? (Konzept §18)
3. Rollen- und Berechtigungsgrenzen im Detail; was dürfen Eltern sehen und stellvertretend bearbeiten?
4. Welche Statistiken für Jugend, Senioren, Trainer?
5. Umfang der Vereinsgestaltung (Farben, Logo, Startseitenmodule)
6. Welche Automationen/Reminder sind Standard, ohne den ruhigen Push-Ansatz zu verletzen?
7. Welche Funktionen brauchen Freigabeprozesse?
8. Welche externen Datenquellen haben eine offiziell nutzbare Schnittstelle?

**Nächster Schritt laut Konzept:** Wireframes der wichtigsten User-Flows für Spieler, Trainer und Fulladmin –
die Mockups der Verkaufsmappe sind dafür eine sehr gute Basis.
