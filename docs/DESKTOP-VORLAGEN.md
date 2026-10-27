# Desktop-Vorlagen (Paket DT2)

Erzeugt aus `apps/mobile/src/lib/desktop-templates.json` mit `node scripts/desktop-vorlagen.mjs --write`; nicht von Hand ändern.
Jede Route unter `apps/mobile/src/app` hat eine Vorlage; `pnpm check` prüft die Vollständigkeit.

| Kürzel | Vorlage |
| ------ | ------- |
| A | Liste bzw. Detailseite |
| B | Formular (eine Spalte, 720 px, Speichern-Leiste unten) |
| C | Tabelle mit Filterleiste |
| D | Kachelraster / Übersicht |
| E | Assistent (720 px) |
| F | Bericht und Diagramme (Spalten) |
| S | Sonderfall mit eigenem Entwurf |
| H | Hauptseite (Paket DT) |
| U | bewusst unverändert |

Status: **fertig** = Seite für den Desktop umgesetzt, **Breite** = nur die Breite der Vorlage (Inhalt wie auf dem Handy), **offen** = noch zuzuordnen.

| Route | Vorlage | Status | Notiz |
| ----- | ------- | ------ | ----- |
| `(tabs)/index` | H | fertig | Hauptseite (Paket DT, umgesetzt) |
| `(tabs)/mehr` | H | fertig | Hauptseite (Paket DT, umgesetzt) |
| `(tabs)/team` | H | fertig | Hauptseite (Paket DT, umgesetzt) |
| `(tabs)/termine` | H | fertig | Hauptseite (Paket DT, umgesetzt) |
| `(tabs)/verein` | H | fertig | Hauptseite (Paket DT, umgesetzt) |
| `about/[page]` | U | fertig | Textseite, bewusst unverändert (lange Zeilen vermeiden, 960 px) |
| `about/privacy` | U | fertig | Textseite, bewusst unverändert (lange Zeilen vermeiden, 960 px) |
| `absences/index` | A | Breite | Liste bzw. Detailseite |
| `absences/new` | B | Breite | Formular |
| `account` | B | Breite | Formular |
| `admin/archive` | C | fertig | Tabelle mit Filterleiste |
| `admin/area/[key]` | D | fertig | Kachelraster / Übersicht |
| `admin/audit` | C | fertig | Tabelle mit Filterleiste |
| `admin/club` | B | Breite | Formular |
| `admin/club-event-new` | B | Breite | Formular |
| `admin/club-events` | C | fertig | Tabelle mit Filterleiste |
| `admin/departments` | C | Breite | Tabelle mit Filterleiste |
| `admin/funds` | C | Breite | Tabelle mit Filterleiste |
| `admin/import` | E | fertig | Assistent |
| `admin/index` | D | fertig | Kachelraster / Übersicht |
| `admin/invites` | C | Breite | Tabelle mit Filterleiste |
| `admin/member-effective` | B | Breite | Formular |
| `admin/member-new` | B | Breite | Formular |
| `admin/member-permissions` | B | Breite | Formular |
| `admin/member/[id]` | A | Breite | Liste bzw. Detailseite |
| `admin/members` | C | fertig | Tabelle mit Filterleiste |
| `admin/modules` | B | Breite | Formular |
| `admin/news/[id]` | A | Breite | Liste bzw. Detailseite |
| `admin/news/index` | A | Breite | Liste bzw. Detailseite |
| `admin/news/new` | B | Breite | Formular |
| `admin/role-edit` | B | fertig | Formular |
| `admin/role/[key]` | A | Breite | Liste bzw. Detailseite |
| `admin/roles` | C | fertig | Tabelle mit Filterleiste |
| `admin/sponsors` | C | Breite | Tabelle mit Filterleiste |
| `admin/support` | B | fertig | Formular |
| `admin/team-new` | E | fertig | Assistent |
| `admin/team/[id]` | A | Breite | Liste bzw. Detailseite |
| `admin/teams` | C | fertig | Tabelle mit Filterleiste |
| `admin/transfer-new` | B | Breite | Formular |
| `admin/transfers` | C | fertig | Tabelle mit Filterleiste |
| `admin/unit/[id]` | A | Breite | Liste bzw. Detailseite |
| `bausteine` | D | Breite | Kachelraster / Übersicht |
| `board` | A | Breite | Liste bzw. Detailseite |
| `calendar` | S | fertig | Sonderfall mit eigenem Entwurf |
| `club-calendar` | S | fertig | Sonderfall mit eigenem Entwurf |
| `club-cash-overview` | D | Breite | Kachelraster / Übersicht |
| `club-cash/allowances` | C | fertig | Tabelle mit Filterleiste |
| `club-cash/area/[key]` | D | fertig | Kachelraster / Übersicht |
| `club-cash/audit/[id]` | A | Breite | Liste bzw. Detailseite |
| `club-cash/audit/index` | A | Breite | Liste bzw. Detailseite |
| `club-cash/budget` | F | fertig | Bericht / Diagramme |
| `club-cash/claims` | C | fertig | Tabelle mit Filterleiste |
| `club-cash/closing` | F | fertig | Bericht / Diagramme |
| `club-cash/donations` | C | fertig | Tabelle mit Filterleiste |
| `club-cash/entries` | C | fertig | Tabelle mit Filterleiste |
| `club-cash/fee-import` | E | fertig | Assistent |
| `club-cash/fee-setup` | B | Breite | Formular |
| `club-cash/fees` | C | fertig | Tabelle mit Filterleiste |
| `club-cash/funds` | C | Breite | Tabelle mit Filterleiste |
| `club-cash/grants` | C | fertig | Tabelle mit Filterleiste |
| `club-cash/index` | D | fertig | Kachelraster / Übersicht |
| `club-cash/inventory` | C | fertig | Tabelle mit Filterleiste |
| `club-cash/manage` | B | Breite | Formular |
| `club-cash/new` | B | Breite | Formular |
| `club-cash/reserves` | C | fertig | Tabelle mit Filterleiste |
| `club-cash/setup` | E | fertig | Assistent |
| `club-cash/sponsors` | C | Breite | Tabelle mit Filterleiste |
| `club-cash/stats` | F | fertig | Bericht / Diagramme |
| `club-cash/tax` | C | Breite | Tabelle mit Filterleiste |
| `club-cash/team-grants` | C | fertig | Tabelle mit Filterleiste |
| `club-events` | A | Breite | Liste bzw. Detailseite |
| `club-schedule` | A | Breite | Liste bzw. Detailseite |
| `club-team/[id]` | A | Breite | Liste bzw. Detailseite |
| `club-teams` | A | Breite | Liste bzw. Detailseite |
| `contacts` | A | Breite | Liste bzw. Detailseite |
| `demo/cash` | E | fertig | Assistent |
| `demo/club` | E | fertig | Assistent |
| `demo/team` | E | fertig | Assistent |
| `demo/team-cash` | E | fertig | Assistent |
| `documents` | A | Breite | Liste bzw. Detailseite |
| `documents-upload` | B | Breite | Formular |
| `equipment/damages` | C | Breite | Tabelle mit Filterleiste |
| `equipment/index` | D | Breite | Kachelraster / Übersicht |
| `equipment/items` | C | Breite | Tabelle mit Filterleiste |
| `equipment/rooms` | C | Breite | Tabelle mit Filterleiste |
| `event-edit/[id]` | B | Breite | Formular |
| `events/[id]` | S | fertig | Sonderfall mit eigenem Entwurf |
| `events/archive` | A | Breite | Liste bzw. Detailseite |
| `events/index` | A | Breite | Liste bzw. Detailseite |
| `exchange/[id]` | A | Breite | Liste bzw. Detailseite |
| `exchange/index` | A | Breite | Liste bzw. Detailseite |
| `exchange/new-demand` | B | Breite | Formular |
| `exchange/new-offer` | B | Breite | Formular |
| `exercises` | A | Breite | Liste bzw. Detailseite |
| `expense-claims` | A | Breite | Liste bzw. Detailseite |
| `export` | B | Breite | Formular |
| `facilities/block-new` | B | Breite | Formular |
| `facilities/index` | S | fertig | Sonderfall mit eigenem Entwurf |
| `forgot` | S | fertig | Sonderfall mit eigenem Entwurf |
| `forum/[id]` | A | Breite | Liste bzw. Detailseite |
| `forum/index` | A | Breite | Liste bzw. Detailseite |
| `help` | D | Breite | Kachelraster / Übersicht |
| `helpers` | A | Breite | Liste bzw. Detailseite |
| `import` | E | fertig | Assistent |
| `join-code` | B | Breite | Formular |
| `join/[token]` | S | fertig | Sonderfall mit eigenem Entwurf |
| `login` | S | fertig | Sonderfall mit eigenem Entwurf |
| `match/[id]/lineup` | S | fertig | Sonderfall mit eigenem Entwurf |
| `match/[id]/report` | S | fertig | Sonderfall mit eigenem Entwurf |
| `news/[id]` | A | Breite | Liste bzw. Detailseite |
| `news/index` | A | Breite | Liste bzw. Detailseite |
| `no-club` | S | fertig | Einzelkarte auf Seite ohne Navigation (wie Anmeldung) |
| `notification-settings` | B | Breite | Formular |
| `notifications` | A | Breite | Liste bzw. Detailseite |
| `operator/club` | D | fertig | Kachelraster / Übersicht |
| `operator/index` | C | fertig | Tabelle mit Filterleiste |
| `polls/[id]` | A | Breite | Liste bzw. Detailseite |
| `polls/index` | A | Breite | Liste bzw. Detailseite |
| `polls/new` | B | Breite | Formular |
| `profile/[id]` | A | Breite | Liste bzw. Detailseite |
| `referees` | A | Breite | Liste bzw. Detailseite |
| `reset/[token]` | S | fertig | Sonderfall mit eigenem Entwurf |
| `schedule-import` | E | fertig | Assistent |
| `search` | A | Breite | Liste bzw. Detailseite |
| `setup` | E | fertig | Assistent |
| `sponsor/[id]` | A | Breite | Liste bzw. Detailseite |
| `sponsors` | A | Breite | Liste bzw. Detailseite |
| `teams/[id]/archive` | C | fertig | Tabelle mit Filterleiste |
| `teams/[id]/cash` | D | Breite | Kachelraster / Übersicht |
| `teams/[id]/cash-admin` | D | Breite | Kachelraster / Übersicht |
| `teams/[id]/cash-closings` | C | fertig | Tabelle mit Filterleiste |
| `teams/[id]/cash-drinks` | C | Breite | Tabelle mit Filterleiste |
| `teams/[id]/cash-entries` | C | Breite | Tabelle mit Filterleiste |
| `teams/[id]/cash-fees` | C | Breite | Tabelle mit Filterleiste |
| `teams/[id]/cash-levy` | B | Breite | Formular |
| `teams/[id]/cash-new` | B | Breite | Formular |
| `teams/[id]/cash-pay` | B | Breite | Formular |
| `teams/[id]/cash-payments` | C | Breite | Tabelle mit Filterleiste |
| `teams/[id]/cash-settings` | B | Breite | Formular |
| `teams/[id]/cash-setup` | E | fertig | Assistent |
| `teams/[id]/cash-stats` | F | fertig | Bericht / Diagramme |
| `teams/[id]/cash-treasurers` | C | Breite | Tabelle mit Filterleiste |
| `teams/[id]/event-new` | B | Breite | Formular |
| `teams/[id]/fines` | C | Breite | Tabelle mit Filterleiste |
| `teams/[id]/jerseys` | C | Breite | Tabelle mit Filterleiste |
| `teams/[id]/manage` | B | Breite | Formular |
| `teams/[id]/modules` | B | Breite | Formular |
| `teams/[id]/roster` | C | fertig | Tabelle mit Filterleiste |
| `teams/[id]/stats/[kind]` | F | Breite | Bericht / Diagramme |
| `teams/[id]/stats/index` | F | fertig | Bericht / Diagramme |
| `teams/[id]/tasks` | C | Breite | Tabelle mit Filterleiste |
| `training-plan/[id]` | S | fertig | Sonderfall mit eigenem Entwurf |
| `wiki/[id]` | A | Breite | Liste bzw. Detailseite |
| `wiki/index` | A | Breite | Liste bzw. Detailseite |
