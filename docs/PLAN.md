# Clubroof – Analyse & Entwicklungsplan

> „Dein Verein unter einem Dach.“
> Stand: 05.10.2026 · Grundlage: *Clubroof Verkaufsmappe* (18 Seiten)

---

## 1. Analyse der Verkaufsmappe

### 1.1 Produktvision

Clubroof ist eine **Vereins-App für den ganzen Verein** (nicht nur eine Mannschaft), die Excel-Listen,
Kassenbücher, Zettel und WhatsApp-Gruppen ersetzt. Zielgruppe sind Amateur-Sportvereine – die Mockups
zeigen klar **Fußball** (Kreisliga, Jugend U11–U17, Bambini, Alte Herren).

Die sechs Leitprinzipien aus der Mappe sind gleichzeitig **Architektur-Anforderungen**:

| Prinzip (Mappe)                    | Technische Konsequenz                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Ein Dach, alle Perspektiven        | Rollen- & Kontext-basiertes UI (Home sieht je Rolle anders aus)               |
| Verwaltung, die mitdenkt           | Automatisierung: Absagefristen, Auto-Zusage, Erinnerungen (Server-Jobs)       |
| Transparenz statt Rückfragen       | Feingranulare Leserechte (Kasse, Platz, Gastspieler „für die richtigen Augen“) |
| Vom Bambini bis zur Ersten         | Hierarchie Verein → Bereich → Mannschaft, skalierbar auf 20+ Teams / 500+ Mitglieder |
| Kommunikation mit Relevanz         | Zielgruppen-genaue Benachrichtigungen, Kategorien, Ruhezeiten                 |
| Wachstum mit Ansage                | **Feature-Module pro Verein**, standardmäßig deaktiviert, vom Admin freischaltbar |

### 1.2 Navigation & Design

- **Bottom-Tab-Navigation** mit 4 Tabs: `Home` · `Team` · `Verein` · `Mehr`
- Header: Vereinswappen, „Hallo, {Name}“, **Vereins-Umschalter** (▾ → ein Nutzer kann in mehreren Vereinen sein), Glocke, Avatar
- „Mehr“ enthält Profil, Einstellungen und den **geschützten Admin-Bereich** („Verwaltung“, Admin-Modus-Badge)
- Visuelle Sprache: Weiß, Grün als Primärfarbe (Beispiel-Verein `#11882E`, Marke Clubroof hellgrün), Karten mit
  „Alle anzeigen ›“, Status-Chips (Spiel / Training / Event / Wichtig), Countdown-Elemente, Fortschrittsbalken
- **Vereinsfarbe ist konfigurierbar** (Ersteinrichtung „Primärfarbe“) → Theming zur Laufzeit nötig
- Schrift vermutlich *Poppins* (Marketing) – für die App prüfen

### 1.3 Rollen

| Rolle                   | Sieht/Tut (laut Mappe)                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| Vorstand / Admin        | Vereinsüberblick, Freigaben, Verwaltung, Rollen & Rechte, Module                 |
| Abteilungs-/Jugendleitung | Bereich (Senioren/Jugend/Bambini), erstellt Umfragen/News                     |
| Trainer / Co-Trainer    | Mehrere Teams, Kader, Trainingsplanung, Gastspielerbedarf, Teamkasse             |
| Kassenwart              | Vereins-/Teamkasse, Buchungen, Berichte                                          |
| Spieler                 | Eigene Termine, Zu-/Absage, Abwesenheit, Statistik, Profil                       |
| Elternteil              | Nur was das **eigene Kind** betrifft (Elternzugänge pro Team aktivierbar)        |
| Mitglied / Helfer       | Vereinsbereich, Events, Helfereinsätze                                           |

Eine Person kann **mehrere Rollen in mehreren Teams** haben (z. B. „Spieler“ in Herren II + „Trainer“ in E1).

### 1.4 Funktionsinventar (aus den Screens)

| # | Bereich                  | Funktionen                                                                                                    |
| - | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1 | **Home**                 | Nächstes Spiel mit Countdown, „Neuigkeiten für dich“, nächste Termine, offene Aktionen, Teamkasse-Kachel, Vorstand: Vereinskennzahlen |
| 2 | **Team**                 | „Meine Teams“ (Zusagequote, offene Aufgaben), Team-Cockpit mit Tabs Übersicht/Termine/Kader/Statistik, Kaderstatus, letzte Ergebnisse, Trainingswoche, Highlights (Tabellenplatz, Tore, Trainingsquote) |
| 3 | **Spielbetrieb**         | Spieldetails (Anstoß, Treffpunkt, Spielort, Trainer-Info), Zu-/Absage, **Absagefrist mit Countdown**, Teilnehmerübersicht, Kalender-Export |
| 4 | **Abwesenheit**          | Urlaub / Verletzt / Gesperrt / Sonstiges, Zeitraum, für alle oder ausgewählte Teams, Notiz                    |
| 5 | **Verein**               | Nächstes Vereinsevent, Vereinsnews, „Heute auf der Anlage“, Helfer gesucht, Austausch (Forum)                 |
| 6 | **News**                 | Artikel mit Bild, Kategorie, Aufrufe, Likes, Freigabe-Workflow (Entwürfe → „Vereinsnews freigeben“)           |
| 7 | **Umfragen**             | Einfach-Auswahl, Abstimmfrist, Ergebnisse ggf. bis Fristende verborgen, Teilnehmerzahl                        |
| 8 | **Events & Ehrenamt**    | Eventseite mit Programm, Ort, Ansprechpartner, Teilnahme; Helfer-Schichten mit Kapazität (4/6 Helfer)          |
| 9 | **Platzbelegung**        | Ressourcen (Plätze, Kunstrasen, Halle) × Tag/Woche/Monat, Typen Spiel/Training/Kurs/Event/Gesperrt, **Konfliktwarnung** |
| 10 | **Finanzen**            | Mannschaftskasse: Kassenstand, Einnahmen/Ausgaben, Buchungen mit Kategorie, Bericht-Export                    |
| 11 | **Dokumente**           | Kategorien (Ordnungen, Formulare, Trainingspläne, Sonstiges), Filter Verein/Mannschaft/Training, Suche, Upload |
| 12 | **Profile**             | Mein Profil, Spielerprofil (Verfügbarkeit, Saisonstatistik, Rückennummer, starker Fuß, Position, Sichtbarkeit Kontaktdaten, Haupt-/Zusatzteam) |
| 13 | **Benachrichtigungen**  | Inbox gruppiert (Dringend / Heute / Früher), Filter, Einstellungen je Kategorie & je Team, Erinnerungszeitpunkt, Ruhezeiten |
| 14 | **Verwaltung (Admin)**  | Kennzahlen, News & Umfragen, Spielerbewegungen (Zu-/Abgänge, Leihe), Gastspielerbörse, Veranstaltungen, Rollen & Rechte, Updates & Features |
| 15 | **Gastspielerbörse**    | Teams melden Bedarf / bieten Spieler an, Anfragen prüfen, Entscheidung beim verantwortlichen Trainer           |
| 16 | **Einrichtung**         | Vereins-Wizard (5 Schritte: Verein, Bereiche, Admins, Einstellungen, Übersicht), Team-Wizard (Teaminfo, Einstellungen, Kader, Training, Übersicht) mit Auto-Zusage, Absagefristen, Teamkasse, Gastspieler, feste Rückennummern, Elternzugänge |
| 17 | **Feature-Module**      | Trainingsplanung, Vereinsforum, Helfermodul, Kalenderexport, Erweiterte Spielerentwicklung – je aktiv/deaktiviert/einrichten |

### 1.5 Was die Mappe *nicht* beantwortet (offene Punkte)

1. **Sportarten:** Nur Fußball oder von Beginn an sportartneutral (Handball, Tennis …)?
2. **Geschäftsmodell:** Preis pro Verein / Mitgliederstaffel / Freemium? (relevant für App-Store-Regeln, s. §6)
3. **Web-Oberfläche** für Vorstand/Kassenwart (große Tabellen, Export) – gewünscht?
4. **Integrationen:** fussball.de / DFBnet (Spielpläne, Ergebnisse, Tabellen), Kalender, Mitgliederverwaltung-Import (CSV)?
5. **Mitgliedsbeiträge / Zahlungen** (SEPA, Stripe) – oder nur Kassenbuch?
6. **Chat:** Die Mappe positioniert sich bewusst *gegen* Chat-Rauschen → Annahme: **kein 1:1-/Gruppenchat im MVP**, nur News, Umfragen, Forum.
7. **Team & Budget:** Wer entwickelt (solo, Agentur, Team)? Zeitrahmen bis zum Pilotverein?
8. **Markenassets:** Logo als SVG, Farbwerte, Schriftlizenzen.

---

## 2. Technische Empfehlung

### 2.1 Stack

| Schicht          | Empfehlung                                                    | Begründung                                                                                   |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Mobile-App       | **React Native + Expo (SDK aktuell), TypeScript strict**      | Eine Codebasis für iOS & Android, EAS Build/Submit für die Stores, OTA-Updates, großer Talentpool |
| Navigation       | Expo Router (dateibasiert)                                    | Deep Links (Push → Spieldetail) ohne Zusatzaufwand                                            |
| UI               | Eigenes Design-System (`packages/ui`) auf Basis von Design-Tokens, z. B. mit Tamagui oder Unistyles | Laufzeit-Theming für Vereinsfarbe, Dark Mode, Konsistenz                                      |
| State/Data       | TanStack Query + Zod-Schemas                                  | Caching, Offline-Toleranz, Typsicherheit an der API-Grenze                                    |
| Formulare        | React Hook Form + Zod                                         | Wizards (Vereins-/Team-Einrichtung)                                                          |
| Backend          | **Supabase (Region EU/Frankfurt)**: Postgres, Auth, Storage, Realtime, Edge Functions | Schneller Start, aber Standard-Postgres → kein Lock-in; **Row Level Security** löst Mandanten- und Rollenrechte direkt in der DB |
| Jobs/Automatik   | Postgres `pg_cron` + Edge Functions                           | Absagefristen, Erinnerungen, Auto-Zusage, Umfrage-Ende                                       |
| Push             | Expo Push Service (→ APNs/FCM)                                | Einheitlich für beide Plattformen                                                           |
| Monitoring       | Sentry (Crashes, Performance)                                 | Pflicht vor erstem externen Nutzer                                                          |
| Analytics        | PostHog (EU-Hosting) – opt-in                                 | DSGVO-konform, Feature-Flags optional                                                       |
| i18n             | i18next, Deutsch zuerst                                       | Alle Strings von Tag 1 externalisiert                                                       |
| Web-Admin (später) | Next.js im selben Monorepo                                  | Wiederverwendung von `core` (Typen, Validierung, API-Client)                                 |

**Alternative Flutter:** ebenfalls professionell, aber getrennte Sprache (Dart) zu einem späteren Web-Admin.
**Alternative eigenes Backend (NestJS + Postgres):** mehr Kontrolle, aber deutlich mehr Aufwand für Auth,
Storage, Realtime. Empfehlung: mit Supabase starten; Geschäftslogik in SQL-Funktionen/Edge Functions halten, damit ein
späterer Umzug möglich bleibt.

### 2.2 Repository-Struktur (Monorepo, pnpm + Turborepo)

```
clubroof/
├─ apps/
│  ├─ mobile/            # Expo-App (iOS/Android)
│  └─ admin-web/         # (Phase 4) Next.js Web-Verwaltung
├─ packages/
│  ├─ core/              # Domänentypen, Zod-Schemas, Rechte-Logik, Datumslogik
│  ├─ api/               # Typisierter Supabase-Client, Queries/Mutations
│  ├─ ui/                # Design-System (Tokens, Komponenten)
│  └─ config/            # ESLint, TSConfig, Prettier
├─ supabase/
│  ├─ migrations/        # SQL-Migrationen (versioniert)
│  ├─ functions/         # Edge Functions (Push, Einladungen, Jobs)
│  ├─ tests/             # pgTAP-Tests für RLS-Policies
│  └─ seed.sql           # Demo-Verein „SV Grün-Weiß“
├─ docs/                 # Plan, ADRs, Datenschutz-Doku
└─ .github/workflows/    # CI
```

### 2.3 Domänenmodell (Kern)

```
Organisation
  Club ─┬─ Department (Senioren, Jugend, Bambini …)
        │     └─ Team (Saison, Liga, Altersklasse, TeamSettings)
        ├─ ClubSettings (Farbe, Logo, Module)
        ├─ Facility (Platz 1, Kunstrasen, Halle) ── FacilityBooking
        └─ ModuleActivation (feature_key, enabled, config)

Personen & Rechte
  User (Login) ── Person (Profil im Verein) ── Membership(club)
  RoleAssignment(person, role, scope: club | department | team)
  GuardianLink(parent_person → child_person)          # Elternzugang
  Invitation(code/link, Zielrolle, Scope, Ablauf)

Spielbetrieb
  Event(type: match | training | club_event | meeting, team?, facility?, start, Treffpunkt, Gegner …)
  Attendance(event, person, status: yes | no | maybe | open, Begründung, Zeitstempel)
  Absence(person, reason, from, to, teams[])
  MatchResult, PlayerStats(Tore, Assists, Einsätze)
  GuestPlayerRequest / GuestPlayerOffer
  PlayerTransfer(Zugang, Abgang, Leihe)

Kommunikation
  NewsPost(Status: draft → pending → published, Zielgruppe, Bild)
  Poll + PollOption + PollVote (Frist, Ergebnis-Sichtbarkeit)
  ForumThread + ForumPost
  Notification + NotificationPreference(Kategorie, Team, Ruhezeiten, Erinnerung)

Ehrenamt & Organisation
  HelperShift(event, Aufgabe, Zeit, Kapazität) + HelperSignup
  Document(Kategorie, Scope, Datei in Storage)
  Task / „Offene Aktionen“ (abgeleitet aus Fristen, Freigaben, Umfragen)

Finanzen
  CashBook(scope: club | team) + Transaction(Betrag, Kategorie, Beleg, Datum)
```

**Mandantentrennung:** Jede fachliche Tabelle trägt `club_id`; RLS-Policies prüfen Mitgliedschaft und Rolle
im passenden Scope. Rechte werden zentral als Funktionen modelliert (z. B. `can(person, 'cashbook.read', team_id)`),
nicht in der App verstreut.

### 2.4 Querschnittsthemen (von Tag 1)

- **Rechtekonzept** als eigenes Modul inkl. Tests – das ist das Herzstück („Ein Dach, alle Perspektiven“).
- **Feature-Module:** Jede Funktion ab Phase 2 steckt hinter einem `feature_key`; UI und RLS respektieren die Aktivierung.
- **Zeitzonen & Fristen:** alle Zeiten in UTC speichern, Vereinszeitzone (Europe/Berlin) für Fristenberechnung.
- **Offline-Toleranz:** gecachte Lesedaten (Termine, Kader) – keine vollständige Offline-Synchronisation im MVP.
- **Barrierefreiheit:** Kontraste (auch bei frei gewählter Vereinsfarbe prüfen!), Screenreader-Labels, Schriftgrößen.
- **Umgebungen:** `dev` (lokal, Supabase CLI) · `staging` (Testflight / interne Tests) · `production`.

---

## 3. Datenschutz & Recht (kritisch – Vereine verarbeiten Daten von Kindern)

- **DSGVO:** Hosting in der EU, Auftragsverarbeitungsvertrag (AVV) Clubroof ↔ Verein (Verein = Verantwortlicher),
  Verzeichnis der Verarbeitungstätigkeiten, TOMs.
- **Minderjährige:** Konten unter 16 nur über Elternzugang/Einwilligung; Elternteil sieht nur verknüpfte Kinder;
  Fotos/Kontaktdaten Minderjähriger standardmäßig eingeschränkt sichtbar.
- **Datensparsamkeit & Sichtbarkeit:** „Kontaktdaten sichtbar für: Team & Trainer“ (siehe Spielerprofil) als Standard.
- **Betroffenenrechte:** Datenexport, **Konto-Löschung in der App** (Apple- und Google-Pflicht), Austritt aus Verein.
- **Gesundheitsdaten:** „Verletzt“ ist potenziell ein Gesundheitsdatum (Art. 9 DSGVO) → nur Status ohne Details,
  Sichtbarkeit auf Trainer begrenzen.
- Impressum, Datenschutzerklärung, Nutzungsbedingungen (in App & Store-Eintrag verlinkt).
- **Empfehlung:** frühzeitig Datenschutz-Fachanwalt/-beratung einbinden (vor dem ersten Pilotverein).

---

## 4. Phasenplan

Aufwände grob für **1–2 erfahrene Entwickler:innen**; bei Solo-Entwicklung entsprechend länger.

### Phase 0 – Fundament (≈ 2–3 Wochen)
- Monorepo, TypeScript strict, Linting, Formatierung, Commit-Konventionen (Conventional Commits)
- CI (GitHub Actions): Lint, Typecheck, Unit-Tests, RLS-Tests; EAS Build für interne Builds
- Expo-App-Grundgerüst mit Tab-Navigation, Theming (Tokens + Vereinsfarbe), i18n, Sentry
- Supabase-Projekt (EU), Migrations-Workflow, Seed „SV Grün-Weiß“
- Auth: E-Mail (Magic Link / OTP) + Apple + Google Sign-In
- Design-System-Basis: Karten, Listenzeilen, Chips, Buttons, Header mit Vereins-Umschalter
- Architekturentscheidungen als ADRs in `docs/adr/`

### Phase 1 – MVP „Spielbetrieb“ (≈ 8–10 Wochen) → erster Pilotverein
Ziel: Ein Verein kann WhatsApp-Gruppen für Termine & Zusagen ersetzen.
- Vereins-Ersteinrichtung (Wizard), Bereiche, Teams, Team-Wizard inkl. Team-Einstellungen
- Einladungen per Link/QR, Rollen & Rechte (Admin, Trainer, Spieler, Elternteil), Elternverknüpfung
- Termine (Spiel, Training inkl. Serien), Zu-/Absage, **Absagefristen**, Auto-Zusage, Teilnehmerübersicht
- Abwesenheiten (Urlaub/Verletzt/Gesperrt/Sonstiges) wirken automatisch auf Termine
- Team-Cockpit (Übersicht, Termine, Kader), „Meine Teams“
- Rollenabhängige Home-Seite (Spieler/Trainer/Vorstand)
- Vereinsnews (einfach) + Benachrichtigungen (Push + Inbox + Einstellungen inkl. Ruhezeiten)
- Profil, Konto-Löschung, Datenexport
- Kalender-Export (ICS)

### Phase 2 – „Vereinsleben“ (≈ 6–8 Wochen)
- Verein-Tab: Vereinsevents, „Heute auf der Anlage“
- Events mit Programm & **Helfer-Schichten**
- Umfragen (Fristen, verborgene Ergebnisse)
- News-Freigabe-Workflow, Likes, Aufrufe
- **Dokumentenbibliothek** (Storage, Kategorien, Suche, Rechte)
- **Platzbelegung** mit Konflikterkennung
- Feature-Modul-Verwaltung („Updates & Features“)

### Phase 3 – „Verwaltung“ (≈ 6–8 Wochen)
- Mannschafts-/Vereinskasse (Buchungen, Belege, PDF/CSV-Export)
- **Gastspielerbörse** (Bedarf/Angebot/Anfrage-Workflow)
- Spielerbewegungen (Zu-/Abgänge, Leihe)
- Statistiken (Trainingsquote, Tore, Assists, Einsätze), Ergebnisse
- Vereinsforum / Austausch
- Admin-Kennzahlen, offene Anfragen

### Phase 4 – Store-Launch & Skalierung
- Öffentliche Store-Veröffentlichung (siehe §5), Landingpage, Support-Prozess
- Web-Verwaltung für Vorstand/Kassenwart
- Abrechnung/Lizenzen für Vereine
- Integrationen (fussball.de-Daten, CSV-Mitgliederimport)
- Weitere Sportarten

**Meilensteine:** interne Demo nach Phase 0 → TestFlight/Play Internal Testing mit Pilotverein ab Mitte Phase 1 →
Store-Release frühestens nach Phase 1 + Pilotfeedback (empfohlen: nach Phase 2).

---

## 5. Weg in die App Stores – Checkliste

| Schritt | Apple App Store | Google Play |
| ------- | --------------- | ----------- |
| Konto | Apple Developer Program (99 $/Jahr), als **Organisation** mit D-U-N-S-Nummer (Firmenname statt Privatname im Store) | Play Console (25 $ einmalig), Organisationskonto |
| App-ID | Bundle ID, z. B. `de.clubroof.app` – **früh festlegen, später nicht änderbar** | Package Name identisch |
| Tests | TestFlight (intern/extern) | Internal → Closed Testing (neue Privatkonten: 12 Tester über 14 Tage Pflicht) |
| Datenschutz | App Privacy „Nutrition Labels“ | Data-Safety-Formular |
| Pflichten | In-App-Kontolöschung, Sign in with Apple (wenn Google-Login angeboten), Demo-Zugang für Review | In-App-Kontolöschung + Lösch-URL, Zielgruppe & Inhalte deklarieren |
| Assets | Icon, Screenshots (6,7"/6,5"/iPad falls unterstützt), Beschreibung | Icon, Feature-Grafik, Screenshots |
| Build/Release | EAS Build + EAS Submit, automatisiert aus CI | dito |

**Achtung Geschäftsmodell:** Werden digitale Funktionen *in der App* verkauft, verlangen Apple/Google ihre
In-App-Kauf-Systeme. Ein B2B-Modell (Verein schließt Lizenz über Web ab, App ist für Mitglieder kostenlos) ist üblich
und mit den Richtlinien vereinbar – sollte aber vor dem Launch geprüft werden.

---

## 6. Qualitätssicherung & Arbeitsweise

- **Tests:** Unit (Jest) für `core` (Rechte, Fristen), Komponenten (React Native Testing Library),
  **RLS-Tests (pgTAP)** – jede Policy hat einen Test, E2E-Flows mit Maestro (Einladen → Zusagen → Absagen)
- **Code-Review** über Pull Requests, geschützter `main`-Branch, CI muss grün sein
- **Versionierung:** SemVer, Changelog, OTA-Updates nur für JS-Änderungen, Store-Release für native Änderungen
- **Sicherheit:** Secrets nur in EAS/Supabase/GitHub Secrets, Dependabot, keine Service-Keys in der App
- **Design:** Mockups aus der Mappe in Figma als verbindliche Quelle pflegen, Design-Tokens daraus ableiten

---

## 7. Risiken

| Risiko | Gegenmaßnahme |
| ------ | ------------- |
| Rechtekonzept wird zu komplex | Früh modellieren, zentral testen, wenige Standardrollen + Scopes |
| Feature-Umfang (17 Bereiche) sprengt MVP | Strikte Phasen, Feature-Module, Pilotverein entscheidet Prioritäten |
| Akzeptanz bei Ehrenamtlichen | Einfache Onboarding-Wizards, Einladung per Link ohne Passwort, Pilotverein eng begleiten |
| DSGVO / Kinderdaten | Privacy by Design, Rechtsberatung, AVV-Vorlage |
| Push-Zustellung/Spam-Gefühl | Kategorien, Ruhezeiten, Bündelung, keine Werbe-Pushes |
| Konkurrenz (Spielerplus, Teamy, easyVerein, Vereinsflieger …) | Fokus auf Alleinstellung: ganzer Verein + Ehrenamt + Gastspielerbörse |

---

## 8. Nächste Schritte

1. Offene Fragen aus §1.5 klären (vor allem Sportart, Geschäftsmodell, Team/Zeitrahmen).
2. Stack-Entscheidung bestätigen (Empfehlung: Expo + Supabase EU).
3. Bundle-ID/Domain sichern, Developer-Konten (Apple mit D-U-N-S, Google) beantragen – dauert teils Wochen.
4. Phase 0 starten: Monorepo, CI, App-Gerüst, Datenbankschema für Verein/Team/Rollen.
5. Pilotverein gewinnen und Termine für Feedback-Runden festlegen.
