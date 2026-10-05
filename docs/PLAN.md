# Clubroof – Analyse & Entwicklungsplan

> „Dein Verein unter einem Dach.“
> Stand: 05.10.2026 · Grundlagen:
> 1. *Clubroof Verkaufsmappe* (18 Seiten, Mockups & Positionierung)
> 2. *VereinsApp – Konzept & Systemarchitektur*, überarbeitet, Stand August 2026 (21 Seiten) – **maßgeblich bei Widersprüchen**

---

## 1. Produktverständnis

### 1.1 Kernidee

Eine **modulare, vereinsweite Fußball-App**: eine zentrale digitale Vereinsstruktur, innerhalb der jede Mannschaft
ihre eigene, individuell konfigurierte Team-App besitzt. Abgrenzung: nicht „mehr Features als SpielerPlus“, sondern
eine echte Vereinsebene mit zentralem Datenmodell, rollenbasierten Verwaltungsabläufen, teamübergreifender Planung.

### 1.2 Ein Verein – später mehrere (aber getrennt)

- **Start: ein Verein.** Die App ist *die* App dieses Vereins; Nutzer gehören genau diesem Verein an.
- **Kein Vereins-Umschalter in der App.** (Der Pfeil ▾ neben dem Vereinsnamen in den Mockups ist kein bestätigtes
  Feature und wird nicht umgesetzt, solange nicht ausdrücklich gewünscht.)
- **Später (Phase 5 „Multi-Club“):** dieselbe Plattform wird an weitere Vereine verkauft (Abo je Verein,
  59,99–99,99 €/Monat laut Finanzmodell). Jeder Verein ist ein eigener, sauber getrennter Mandant.
- **Konsequenz für die Architektur:** Jeder zentrale Datensatz trägt von Anfang an eine `club_id`. Die Ausrollung
  auf weitere Vereine wird damit eine Skalierungs- statt einer Umbaufrage – ohne dass Nutzer im MVP etwas davon merken.

### 1.3 Produktprinzipien (Konzept §1) und ihre technische Folge

| Prinzip | Technische Konsequenz |
| --- | --- |
| Personen gehören dem Verein; Teamzuordnungen sind zeitlich und rollenbezogen | `Person` ≠ `User`; `TeamMembership` mit Zeitraum, Saison-Historie; Profil überlebt Mannschaftswechsel |
| Komplexität verbergen; Admins wechseln bewusst in einen Arbeitsmodus | Getrennte Navigation „Verwaltungsmodus“ mit „Zur App zurück“ |
| Module konfigurierbar (1. Mannschaft ≠ Bambini) | Modul-/Einstellungssystem mit Vererbung Verein → Bereich → Mannschaft → Nutzer |
| Push auf das notwendige Minimum | Prioritätsebenen, Opt-in für zusätzliche Kategorien, Sammelhinweise für Trainer |
| Kommunikation zweckgebunden – kein Messenger | Kein Gruppenchat; nur News, Umfragen, Anfragen/Freigaben, Mini-Forum |
| Neue Funktionen nur bewusst aktivieren | Update-Center, neue Module standardmäßig aus, versionierte Konfigurationen |

### 1.4 Navigation

Vier Lebensbereiche + separater Verwaltungsmodus:

| Tab | Frage | Inhalte |
| --- | --- | --- |
| **Home** (personenbezogen) | Was ist für mich jetzt relevant? | Widgets: News, nächste Termine, offene Aktionen, persönliche Kasse, Umfragen, persönliche Statistik – zusammengesetzt aus Modulen, Rolle, Alter; sortiert nach Priorität + Betroffenheit + Aktualität |
| **Team** (mannschaftsbezogen) | Alles zu meiner Mannschaft | Navigation entsteht aus aktivierten Modulen: Übersicht, Termine, Spiele, Training, Kader, Team, Statistik, Kasse, Dokumente/Aufgaben |
| **Verein** (organisationsbezogen) | Alles über den Gesamtverein | Vereinsübersicht, Mannschaften, Vereinskalender, Ansprechpartner, Dokumente, Helfer & Aufgaben, Mini-Forum |
| **Mehr** | Persönlicher Einstieg | Profil, Einstellungen, Statistik, Benachrichtigungen, **Verwaltungsmodus** |

**Verwaltungsmodus** („App in der App“): eigene Navigation, dichtere Darstellung, Arbeitsbereiche
*Organisation* (News, Umfragen, Veranstaltungen, Mitglieder, Rollen, Dokumente, Freigaben),
*Sport* (Mannschaften, Spieler, Trainer, Saisonplanung, Spielerbewegungen, Gastspielerbedarf),
*Betrieb* (Plätze, Kabinen, Material, Schlüssel, Aufgaben, Sperrungen),
*Kontrolle* (Audit-Log, offene Vorgänge, Import-/Sync-Status, Update-Center).

**Design-Regeln:** Farben tragen Bedeutung (rot = dringend, orange = Aktion, blau = Organisation, grün = erledigt,
grau = archiviert); Mannschafts-Badges (B1, C2, 1., AH); feste Tags für Quelle (Verein, Jugend, Senioren, Team) und
Typ (Info, Wichtig, Spiel, Training, Veranstaltung, Umfrage, Aufgabe); einheitliche Icons. Vereinsdesign wählbar
(Primär-/Akzentfarbe, hell/dunkel/automatisch) **mit automatischer Lesbarkeitsprüfung**.

### 1.5 Rollen (Konzept §7)

Rollen sind **Sammlungen von Berechtigungen für definierte Bereiche**, keine starren Menüpakete; ein Nutzer kann
mehrere Rollen gleichzeitig haben.

| Rolle | Typische Verwaltungsfunktionen |
| --- | --- |
| Fulladmin | gesamter Verein, Rollen, Module, Kommunikation, Systemeinstellungen, Updates |
| Vorstand/Vereinsleitung | Vereinsmonitor, Kommunikation, Mitglieder, Veranstaltungen, Dokumente |
| Sportliche Leitung | Kadergrößen, Spielerbewegungen, Trainer, Saisonplanung, Gastspielerlogik |
| Jugendleitung | Jugendteams, Trainerbedarf, Jahrgangsplanung, Saisonwechsel, Jugendkommunikation |
| Trainer | eigene Mannschaft, Termine, Kader, Training, Team, Bedarf/Angebote, Statistik |
| Kassenwart | Mannschaftskasse, Buchungen, Strafen/Getränke, Abrechnung |
| Platz-/Materialwart | Belegung, Sperrungen, Material, Schlüssel, Schäden, Aufgaben |
| Mitgliederverwaltung | Stammdaten, Ein-/Austritte, Profilprüfung, Mannschaftszuordnung |
| Schiedsrichterobmann | Schiedsrichter, Verfügbarkeit, Zuweisungen, Lehrgänge |

Dazu die Nutzerrollen **Spieler**, **Elternteil** (Eltern-Kind-Verknüpfung), **Mitglied/Helfer**.
**Datensparsamkeit:** fremde Trainer sehen bei der Gastspielerplanung nur *aggregierte* Verfügbarkeit, nicht den Grund.

### 1.6 Fachlogik, die das Konzept präzisiert

**Teilnahme-Modelle (je Mannschaft):**
- *Automatische Zusage* – alle gelten als dabei, Countdown bis Absagefrist (z. B. Senioren)
- *Aktive Zu-/Absage* – jeder muss reagieren (z. B. Jugend/Eltern)
- *Nur Abwesenheiten* – keine Terminreaktion, globale Abwesenheiten steuern Verfügbarkeit

**Absagefristen** je Mannschaft *und* Terminart (Training 2 h vorher, Spiel Freitag 18:00, Turnier 3 Tage);
nach Ablauf ist reguläre Absage gesperrt, Trainer können korrigieren.

**Abwesenheiten** (Urlaub, Verletzung, Krankheit, Schule/Beruf) pflegt der Spieler selbst, sie gelten für alle
relevanten Teams; Trainer dürfen stellvertretend korrigieren; getrennt von terminbezogenen Absagen.

**Gastspieler/Spielerbedarf:** Team meldet Bedarf („2–3 Spieler, bevorzugt Abwehr“), andere Trainer bieten
Kapazität an („bis zu 2 Spieler“); **der Trainer des abgebenden Teams wählt die Spieler aus**, fremde Trainer fragen
keine Einzelspieler direkt an. Der Gastspieler bleibt Mitglied seines Stammteams, wird als Event-Teilnehmer
hinzugefügt; Termin erscheint automatisch in seiner persönlichen Ansicht.

**Benachrichtigungen (Konzept §10):**

| Ebene | Beispiele | Standard |
| --- | --- | --- |
| Dringend | kurzfristige Absage, wesentliche Verschiebung | sofortiger Push + Notification |
| Persönlich wichtig | Gastspielnominierung, Kaderentscheidung, Freigabe | Push je nach Typ / Opt-in |
| Aktion | Umfrage, Aufgabe, Dokument, Fristerinnerung | Notification; Push optional |
| Info | News, Ergebnis, Statistik | Notification/Feed, kein Push |

Filter (Alle, Aktionen, Termine, Team, Verein, Verwaltung, Ungelesen), Deep Links, Aktionen verschwinden nach
Erledigung, Änderungen zeigen alt/neu, **Sammelhinweise für Trainer/Admins** statt Einzelmeldungen.

**Kommunikation (§11):** News (optional Reaktion/Lesebestätigung), Umfragen, Anfragen/Freigaben mit
zielgerichteten Kommentaren, Mini-Forum (wenige, moderierte Themen; Sichtbarkeit und Schreibrecht getrennt;
Ablaufdatum). Kein Gruppenchat.

**Einrichtung (§8):** Setup-Assistenten erzeugen Module, Navigation, Rechte und Defaults.
Konfigurationsprinzipien: *Vererbung* (Verein → Bereich → Mannschaft → Nutzer), *Zustände* (aktiviert / verfügbar
aber deaktiviert / übergeordnet gesperrt), *Komplexitätsstufen* (Aus / Basis / Erweitert / Individuell),
*Einladungslogik* (Admin lädt Trainer, Trainer laden Spieler/Eltern), *sichere Aktivierung* (QR/Link, Zuordnung
wird verifiziert/freigegeben). Mannschafts-Vorlagen: leistungsorientiert, klassisch, Jugend, Freizeit.
Deaktivieren löscht keine historischen Daten.

**Updates (§13):** Systemupdate automatisch; Funktionsverbesserung behält Verhalten, neue Optionen aus; neues Modul
standardmäßig deaktiviert. Aktionen „Einrichten / Später / Nicht verwenden“; nur zuständige Rollen sehen relevante Updates.

**Optionaler Modul-Pool (§12):** Trainingsbibliothek, Spielerentwicklung, Belastung · Platz-/Kabinenplanung, Material,
Trikots, Schlüssel, Schäden, Wiki · Helferdienste, Turniere, Schiedsrichter · Eltern-Kind-Accounts, Fahrdienste,
Probetraining · Fundbüro, Marktplatz, Forum · Mannschaftskassen, später Mitgliedsbeiträge.

---

## 2. Technische Architektur

### 2.1 Was das Konzept vorgibt

Modularer Monolith · PostgreSQL · S3-kompatibler Object Storage · Docker/Docker Compose · Caddy/Nginx (nur HTTPS) ·
selbst verwalteter VPS (z. B. IONOS, ca. 4 vCPU/4 GB) · Backups (Provider + DB-Dump + separater Storage) ·
Frontend als **Next.js-PWA**, native Apps erst in Phase 5.

Backend-Seite übernehme ich vollständig. **Offen ist die Frontend-Frage**, weil sie mit dem Ziel
„später im Apple App Store und Google Play“ zusammenhängt:

### 2.2 Entscheidung: Frontend (PWA vs. App-Store-fähig von Anfang an)

| | A) Next.js-PWA (wie Konzept) | B) Expo / React Native (iOS + Android + Web aus einer Codebasis) |
| --- | --- | --- |
| Start | am schnellsten, keine Store-Konten nötig | etwas mehr Setup, Testversionen über TestFlight/Play Testing |
| Push auf iPhone | nur wenn die PWA zum Home-Bildschirm hinzugefügt wurde (iOS ≥ 16.4), Zustellung weniger zuverlässig | native Push (APNs/FCM), zuverlässig |
| Weg in die Stores | späterer **Neubau der Oberfläche** nötig; reine „Web-Hüllen“ lehnt Apple häufig ab | bereits erledigt – nur noch veröffentlichen |
| Web-Version | ja | ja (Expo Web), Verwaltungsmodus auch am PC nutzbar |
| Aufwand bis Store | doppelt (PWA + später native App) | einmal |

**Empfehlung: B.** Push ist laut Konzept ein Kernbaustein („dringend = sofortiger Push“), und das Store-Ziel steht
fest. Mit Expo entsteht *eine* Codebasis für iPhone, Android und Browser; der Verein kann trotzdem früh im Browser
testen. Das Backend bleibt exakt wie im Konzept (eigene API, Postgres, Docker, EU-Hosting).

### 2.3 Stack (bei Entscheidung B)

| Schicht | Wahl |
| --- | --- |
| App (iOS/Android/Web) | Expo + Expo Router, TypeScript strict, TanStack Query, React Hook Form + Zod, i18next (de) |
| Design-System | eigenes `packages/ui` mit Design-Tokens, Laufzeit-Theming (Vereinsfarbe, hell/dunkel), Kontrastprüfung |
| Backend / API | Node.js + TypeScript, modularer Monolith (z. B. NestJS oder Fastify), REST/OpenAPI mit generiertem, typisiertem Client |
| Datenbank | PostgreSQL + Prisma oder Drizzle (Migrationen versioniert); Row Level Security als zweite Schutzlinie |
| Auth | eigene Auth mit sicheren Passwort-Hashes (Argon2) + Magic Link, **2FA für privilegierte Rollen** |
| Jobs | Queue (z. B. pg-boss auf Postgres) für Fristen, Erinnerungen, Sammelhinweise, Push-Versand |
| Push | Expo Push (APNs/FCM) + Web Push für Browser |
| Dateien | S3-kompatibler Storage (z. B. MinIO selbst gehostet oder IONOS S3) |
| Betrieb | Docker Compose, Caddy, VPS in Deutschland, Backups 3-fach getrennt, Sentry/GlitchTip, Uptime-Monitoring |

### 2.4 Repository-Struktur

```
clubroof/
├─ apps/
│  ├─ mobile/      # Expo-App: iOS, Android, Web
│  └─ api/         # Backend (modularer Monolith)
├─ packages/
│  ├─ core/        # Domänentypen, Zod-Schemas, Rechte- und Fristenlogik (von App und API geteilt)
│  ├─ ui/          # Design-System
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

| Objekt | Bedeutung |
| --- | --- |
| Club / OrgUnit | Verein; Bereiche Senioren/Jugend/Frauen/AH (Baum) |
| User | Login, Auth, persönliche Einstellungen |
| Person | reale Person; bleibt über Mannschaftswechsel bestehen; ein User kann Personen verwalten (Eltern → Kind) |
| Season | Saisonbezug und Historisierung |
| Team / TeamMembership | Mannschaft; zeitlich definierte Zuordnung mit Funktion (Spieler, Trainer, Betreuer) |
| Role / Permission / RoleAssignment | Rolle = Berechtigungsbündel, zugewiesen mit Scope (Verein / Bereich / Team) |
| ModuleConfig | Modul + Zustand + Komplexitätsstufe + Optionen je Ebene, versioniert |
| Event / EventParticipant | Training, Spiel, Veranstaltung; Teilnahme inkl. Gastspiel |
| Absence | globale Abwesenheit einer Person |
| Match / Squad / Lineup | Spieldaten, Kader, Aufstellung, Ergebnis, Tore/Assists/Karten |
| PlayerDemand / PlayerOffer | Spielerbedarf und Kapazitätsangebote |
| Announcement / Poll / Task / ForumTopic | Kommunikation und Aktionen |
| Notification | Ebene, Status, Zustellung, Erledigung |
| CashAccount / Transaction | Mannschaftskasse, persönliche Konten, Strafen/Getränke |
| Document, Facility/Booking, AuditLog, ImportJob | Dokumente, Platzbelegung, Audit, Importe |

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

## 4. Phasenplan (Konzept §17, technisch präzisiert)

| Phase | Schwerpunkt | Ergebnis |
| --- | --- | --- |
| **0 – Projektbasis** | Monorepo, CI, Design-System-Grundlagen, Docker-Setup, Auth, Rechte- und Modul-Kern, Wireframes der Hauptflows (Spieler, Trainer, Fulladmin) | lauffähiges Gerüst, Architekturentscheidungen dokumentiert |
| **1 – Fundament** | Verein, Bereiche, Nutzer/Personen, Rollen, Einladungen (QR/Link), Teams + Setup-Assistent, Termine, drei Teilnahme-Modelle, Absagefristen, Abwesenheiten, News, Notification-Center + Push, Home-Dashboard, Verwaltungsmodus-Grundgerüst | **ein Verein produktiv nutzbar** |
| **2 – Teamorganisation** | Kader, Gastspieler, Statistik (Aus/Basis/Erweitert), Kasse (Strafen/Getränke), Umfragen, Dokumente | SpielerPlus-nahe Kernfunktionen mit Vereinslogik |
| **3 – Verwaltungsportal** | Saisonplanung, Spielerbedarf-Börse, Ressourcen/Plätze, Aufgaben/Helfer, Rollenmodule, Audit, Update-Center, Mini-Forum | Vereinsprozesse über Mannschaftsgrenzen hinweg |
| **4 – Erweiterungen** | Integrationen, Trainingsplanung, Material, Turniere, Community-Module | nur nach echtem Bedarf |
| **5 – Multi-Club & Stores** | weitere Vereine als Mandanten, Abo-Abrechnung, größere Infrastruktur, Veröffentlichung in App Store / Google Play | Skalierung auf Basis derselben Architektur |

Bei Entscheidung B kann die Store-Veröffentlichung auch früher erfolgen (z. B. nach Phase 1/2) – technisch ist sie dann kein Umbau mehr.

---

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

1. **Frontend: A (PWA) oder B (Expo, iOS/Android/Web)?** → Empfehlung B (§2.2)
2. Welche Teamfunktionen gehören in Phase 1, welche bleiben Module? (Konzept §18)
3. Rollen- und Berechtigungsgrenzen im Detail; was dürfen Eltern sehen und stellvertretend bearbeiten?
4. Welche Statistiken für Jugend, Senioren, Trainer?
5. Umfang der Vereinsgestaltung (Farben, Logo, Startseitenmodule)
6. Welche Automationen/Reminder sind Standard, ohne den ruhigen Push-Ansatz zu verletzen?
7. Welche Funktionen brauchen Freigabeprozesse?
8. Welche externen Datenquellen haben eine offiziell nutzbare Schnittstelle?

**Nächster Schritt laut Konzept:** Wireframes der wichtigsten User-Flows für Spieler, Trainer und Fulladmin –
die Mockups der Verkaufsmappe sind dafür eine sehr gute Basis.
