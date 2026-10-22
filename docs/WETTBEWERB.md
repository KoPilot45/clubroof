# Wettbewerbsvergleich (Stand 19.10.2026)

**Belastbarkeit:** Recherche über Websuche. Die Herstellerseiten selbst waren aus der Arbeitsumgebung nicht abrufbar; die Angaben stammen aus Suchergebnissen (Hersteller-Hilfeseiten, App-Store-Texte) und Vergleichsportalen mit Affiliate-Links. Preise und Funktionsumfänge vor Entscheidungen direkt beim Anbieter prüfen. „nicht belegt“ heißt: in den Quellen nicht gefunden, nicht „gibt es nicht“.
Eigener Stand: `docs/FUNKTIONEN.md` im Umsetzungsbranch (19.10.2026).

## 1. Wer sind die Wettbewerber?

| Gruppe | Anbieter | Schwerpunkt |
| ------ | -------- | ----------- |
| Team-Apps | **SpielerPlus** (international TeamPlus), **Spond** (App), TeamSnap, SportEasy, TeamCaptain, Stack Team App | Termine, Zu-/Absagen, Aufstellung, Chat, Teamkasse |
| Vereinsverwaltung | **easyVerein**, **campai**, **Vereinsplaner**, WISO MeinVerein, ClubDesk, webling, verein.cloud, S-Verein, **Spond Club** | Mitglieder, Beiträge, Buchhaltung, Kommunikation |
| Verbands-Apps | BFV-Team-App (an SpielPLUS/DFBnet angebunden) | Spielbericht, Mannschaftskasse, Push |
| Nischen | Strafenmanager (Strafkasse), CoTrainer, foomla, Easy2Coach (Training/Aufstellung) | Einzelfunktionen |

## 2. Was die Wettbewerber belegt anbieten

- **SpielerPlus:** Basis kostenlos mit Werbung; Premium (ca. 54 € je Team und Jahr laut App-Store-Eintrag, gestaffelt bei mehreren Teams) mit Fahrgemeinschaften, Teamkasse, Aufstellungen, Rollen mit Spielerprofilen. Termine mit Zu-/Absage, Turniere, Aufgaben, Videos, News, Umfragen, Chat, Strafenkatalog. Über 410.000 Teams, über 80 Sportarten. Keine Vereinsverwaltung (Mitglieder, Beiträge, Buchhaltung) belegt.
- **Spond:** App für Teams und **Spond Club** für Vereine. Kostenlos, Einnahmen aus Transaktionsgebühr (Standard 2,5 % + 0,20 € je Zahlung, Stripe; Gebühr einpreisen oder aufschlagen). Mitgliederverwaltung, Anmeldeformulare, Admin-Rollen, Zahlungsanforderungen mit Familienrabatt und Raten, Kursanmeldungen, Untergruppen, Import aus Tabellen, **Vereinswebsite**, Fotos und Dateien teilen. SEPA-Lastschrift nicht eindeutig belegt. Neuere Nutzerkritik: Werbung im Vollbild (April 2026).
- **easyVerein:** Mitgliederverwaltung mit Zugängen, Adressen, Sitzungsprotokolle, Dateien, Vereinskalender, **Buchhaltung**, Inventar, Aufgaben, Videokonferenzen, Schnittstellen; mobil als Web-App. Tarife Essentials/Community/Office/Professional, grob 15–42 € im Monat je nach Größe, bis 50 % Nachlass für Gemeinnützige. Kritik: unübersichtliche Preise.
- **campai:** Mitgliederverwaltung, Kommunikation, Beitragsverwaltung, Rechnungen, **Vereinsbuchhaltung**, Online-Funktionen; Basic ca. 30 € im Monat bei 100 Mitgliedern (unsichere Angabe).
- **Vereinsplaner:** Vereins-App mit Chat, Beitragsübersicht, Umfragen, Helferplan, Abteilungen (Sektionen) mit eigenen Chats, Anwesenheitslisten und Terminbestätigung; Dokumentenspeicher. Kritik: lange Mindestlaufzeit, manches nur am Desktop.
- **Weitere Vereinssoftware:** WISO MeinVerein ab 10 € im Monat (bis 100 Mitglieder), webling kostenlos bis 50 Mitglieder, verein.cloud stark in der Buchhaltung, ClubDesk mit Website-Baukasten, S-Verein ab 6,90 € im Monat.
- **BFV-Team-App:** kostenlos, Mannschaftskasse mit Strafenkatalog, Push, Eltern-Kind-Verknüpfung, **Übernahme der Aufstellung in den elektronischen Spielbericht** (SpielPLUS).
- **Nischen:** TeamCaptain (Termine, Training, Aufgaben, Strafen, Rollen mit individuellen Rechten), Strafenmanager (nur Strafkasse, WhatsApp-Export), Trainings-Apps mit großen Übungsdatenbanken (CoTrainer, foomla, Easy2Coach).

## 3. Vergleich nach Funktionen

✔ = belegt, ◐ = teilweise oder nur Grundform, – = nicht belegt.

| Funktion | Clubroof | SpielerPlus | Spond / Club | easyVerein | campai | Vereinsplaner | BFV-Team-App |
| -------- | :------: | :---------: | :----------: | :--------: | :----: | :-----------: | :----------: |
| Termine, Zu-/Absage, Fristen | ✔ | ✔ | ✔ | ◐ | ◐ | ✔ | ✔ |
| Aufstellung (Spielfeld, Formationen) | ✔ | ✔ | ◐ | – | – | – | ✔ |
| Mannschaftskasse, Strafen, Getränke | ✔ | ✔ | ◐ | – | – | ◐ | ✔ |
| Fahrgemeinschaften | ✔ | ✔ | ✔ | – | – | – | – |
| Trainingsplanung, Übungen | ✔ | ◐ | – | – | – | – | – |
| Gastspieler, Spielerbedarf zwischen Teams | ✔ | – | – | – | – | – | – |
| Eltern-Kind-Zugang | ✔ | ✔ | ✔ | ◐ | ◐ | ◐ | ✔ |
| Mitgliederverwaltung, Import/Export | ✔ | – | ✔ | ✔ | ✔ | ✔ | – |
| Rollen und Rechte, eigene Rollen | ✔ (eigene Rollen geplant) | ◐ | ✔ | ✔ | ✔ | ◐ | – |
| Vereinskasse / Buchführung (4 Bereiche) | ✔ | – | – | ✔ | ✔ | ◐ | – |
| Mitgliedsbeiträge verwalten | ✔ (manuell, CSV) | – | ✔ | ✔ | ✔ | ✔ | – |
| **Online-Zahlung, SEPA-Einzug** | **–** | – | ✔ (Stripe) | ◐ | ✔ | ◐ | – |
| Platzbelegung, Material, Schlüssel | ✔ | – | – | ◐ (Inventar) | – | – | – |
| Helferdienste, Veranstaltungen | ✔ | – | ◐ | ✔ | ◐ | ✔ | – |
| Sponsoren (Anzeigen, Verwaltung) | ✔ | – | – | – | – | – | – |
| Archiv, Protokoll, Datensparsamkeit | ✔ | – | – | ◐ | – | – | – |
| Chat | – (bewusst) | ✔ | ✔ | – | ◐ | ✔ | – |
| Vereinswebsite | – | – | ✔ | ◐ | ◐ | – | – |
| Online-Anmeldung / Kurse | – | – | ✔ | ◐ | ◐ | – | – |
| Anbindung DFBnet/FUSSBALL.DE/SpielPLUS | ◐ (CSV-Import) | – | – | – | – | – | ✔ |
| Mehrere Vereine, Abo-Verkauf | – (geplant) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Push-Mitteilungen | ◐ | ✔ | ✔ | – | ◐ | ✔ | ✔ |
| Native App (iOS, Android) | ✔ | ✔ | ✔ | ◐ (Web-App) | ◐ | ✔ | ✔ |
| Sitzungsprotokolle, Videokonferenz | ◐ (Dokumente, Wiki) | – | – | ✔ | – | – | – |

## 4. Einordnung

**Wo Clubroof vorn liegt (Alleinstellung oder Breite):**
1. **Eine App für Team und Verein:** Wettbewerber trennen Team-App (SpielerPlus, Spond) und Vereinssoftware (easyVerein, campai). Clubroof verbindet Mannschaftsebene und Vereinsebene mit Rechten über beide.
2. **Gastspieler und Spielerbedarf zwischen Mannschaften:** in keiner Quelle belegt.
3. **Rechte- und Datenschutzmodell:** Rollen als Rechtepakete mit Geltungsbereich, Datensparsamkeit (Gründe nur für Berechtigte), Archiv, Protokoll, Einwilligungen bei Kindern.
4. **Vereinskasse mit steuerlichen Bereichen**, Haushaltsplan, Kassenprüfung, Spenden zusätzlich zur Mannschaftskasse.
5. **Platzbelegung, Material, Schlüssel, Helferschichten, Sponsoren** im selben System.
6. **Einrichtungsassistenten** und Module je Verein, Bereich, Mannschaft; **Desktop** neben der App.

**Wo Wettbewerber vorn liegen oder Clubroof Lücken hat:**
1. **Zahlungsabwicklung:** Spond (Stripe, Raten, Familienrabatt) und campai bieten Online-Zahlung; Clubroof erfasst Beiträge nur manuell oder per CSV (Entscheidung K2: erste Fassung ohne SEPA-Lastschrift).
2. **Vereinswebsite und Online-Anmeldung:** Spond Club, ClubDesk.
3. **Anbindung an den Verband** (BFV-Team-App mit Spielbericht, SpielPLUS): Clubroof hat nur den DFBnet-CSV-Import.
4. **Chat:** Wettbewerber setzen auf Gruppenchats; Clubroof verzichtet bewusst (Entscheidung). Das kann ein Verkaufshindernis sein; Alternative wäre ein moderierter Kommentarbereich je Termin.
5. **Reife und Reichweite:** SpielerPlus hat über 410.000 Teams, eine große Übungs- und Trainer-Community. Clubroof hat noch keinen Mandantenbetrieb, kein Abo und keine Store-Version.
6. **Preismodell:** Spond ist kostenlos, SpielerPlus günstig je Team, easyVerein ab etwa 15 € im Monat. Clubroof braucht ein klares Preisargument (ein Preis für Team und Verein, keine Werbung durch Dritte).

## 5. Empfehlungen (Vorschlag, noch nicht beschlossen)

1. **Zahlungen:** Entscheiden, ob Online-Zahlung (Stripe) oder SEPA-Lastschrift kommt, vor allem für Beiträge. Hebt Clubroof gegenüber Spond/campai auf Augenhöhe. Rechtlich prüfen (Zahlungsdienste, Gebühren).
2. **Verbandsanbindung:** Spielplan und Ergebnisse (FUSSBALL.DE/DFBnet) als Quelle; Spielbericht-Übergabe wäre ein starkes Argument gegen die BFV-App.
3. **Online-Anmeldung** (Beitrittsformular mit Freigabe, Kurse) mit Anschluss an Mitgliederverwaltung und Beiträge.
4. **Kommunikation:** Kommentare je Termin und News als Ersatz für Chat prüfen, damit „kein Chat“ nicht als Lücke wirkt.
5. **Vertriebsaussage schärfen:** „Team und Verein in einer App mit klarem Rechtekonzept“ statt „mehr Funktionen als SpielerPlus“ (so schon in `PLAN.md`).
6. Geplante Pakete mit Wettbewerbsbezug: MANDANTENBETRIEB, PLAENE-UND-ABO, STORE-REIFE, WEB-PUSH, IMPORT-KONTOAUSZUG.

## Quellen

- [SpielerPlus Premium](https://www.spielerplus.de/lp/premium) · [SpielerPlus im App Store](https://apps.apple.com/de/app/spielerplus-teamorganisation/id914253760) · [Was kostet SpielerPlus-Premium](https://support.spielerplus.de/hc/en-us/articles/34465527889041-What-does-TeamPlus-Premium-cost) · [Teamodo vs. SpielerPlus](https://www.teamodo.de/teamodo-vs-spielerplus)
- [Spond Vereinssoftware](https://www.spond.com/de/vereinssoftware/) · [Spond Transaktionsgebühr](https://help.spond.com/club/en/articles/58192-what-is-the-transaction-fee-in-spond-club) · [Spond Zahlungsanforderungen](https://help.spond.com/club/en/articles/188096-managing-payment-requests-in-spond-club) · [Klubraum vs. Spond](https://klubraum.com/de/blog/spond-alternative/) (Wettbewerber, nicht neutral) · [Spond bei Capterra](https://www.capterra.com/p/181253/Spond/) · [Spond bei Marlvel](https://marlvel.ai/apps/com-spond)
- [easyVerein-Kosten (trusted.de)](https://trusted.de/easyverein-kosten) · [easyVerein-Alternativen](https://trusted.de/easyverein-alternativen) · [Vereinssoftware-Vergleich (OMR)](https://omr.com/de/reviews/contenthub/software-fuer-mitgliederverwaltung) · [campai-Alternativen](https://trusted.de/campai-alternativen) · [Vereinsplaner vs. campai](https://trusted.de/vereinsplaner-vs-campai)
- [Vereinsplaner App](https://vereinsplaner.com/en/b/mobile-app) · [Vereinsverwaltung kostenlos (OMR)](https://omr.com/de/reviews/contenthub/vereinsverwaltung-kostenlos-software)
- [BFV-Team-App](https://apps.appfollow.io/ios/bfv-team-app/1403863269?country=us) · [TeamCaptain](https://apps.apple.com/co/app/teamcaptain/id6737807434) · [Strafenmanager](https://apps.apple.com/de/app/strafenmanager/id6745397267) · [CoTrainer](https://apps.apple.com/de/app/cotrainer/id6499470120)
- [TeamSnap vs. SportEasy (G2)](https://www.g2.com/compare/sporteasy-vs-teamsnap) · [TeamSnap vs. Spond (G2)](https://www.g2.com/compare/spond-vs-teamsnap)

## Nachtrag 22.10.2026: zweite Recherche

**Belastbarkeit:** wieder Websuche (Hersteller-Hilfeseiten, App-Store-Texte, Vergleichsportale, teils Wettbewerber-Blogs mit Eigeninteresse). Herstellerseiten ließen sich nicht direkt abrufen. Preise und Funktionen vor jeder öffentlichen Aussage beim Anbieter prüfen. „nicht belegt“ heißt nicht „gibt es nicht“.

### Neu oder genauer belegt

| Anbieter | Art | Belegt |
| --- | --- | --- |
| SpielerPlus („TeamPlus“) | Team-App | Basis kostenlos, Premium ca. 53,99 € je Team und Jahr (5,99 € monatlich), Mengenrabatt je Team; Vereinslizenz-Preise nicht belegt |
| Spond / Spond Club | Team-App + Verein | kostenlos, Zahlungen 2,5 % + 0,20 € (Euroraum; im Okt. 2026 Aktion 1,25 % + 0,10 € für Vereine in Deutschland); Mitgliederverwaltung, Zahlungen, Vereinswebsite; Werbung in der App (laut Wettbewerber nicht abschaltbar, ungeprüft); laut einem Vergleich kein Elternportal |
| easyVerein | Vereinssoftware | Einstieg 7,14 / 12,24 / 15,30 / 19,38 € im Monat (Essentials, Community, Office, Professional) für Größe Small (bis 100 Mitglieder), Preis steigt mit Mitgliedern und Admins; Buchhaltung laut mehreren Quellen erst ab Office, DATEV, SEPA-Lastschrift und Mahnwesen; bis 50 % Nachlass für Gemeinnützige; mobile App: Quellen widersprüchlich |
| easy2coach | Team-App | grafische Aufstellung auf dem Spielfeld, Taktikboard, über 2.500 Übungen, Teamkasse, kostenlos; Club-Premium ohne genannten Preis |
| Teamodo | Team-App + Verein | kostenlose Basis (Termine, Zusagen, Teamkasse, Chat, Aufstellung bis 30 Teammitglieder); Vereinstarif ca. 50–100 € im Monat je nach Zahl der Mannschaften; Rollen (Trainerteam, Kassenwart, sportliche Leitung), Übungsdatenbank, Spielerbewertung |
| Vereinsplaner | Vereinssoftware + App | Free bis 5 Accounts, Pro 119 €/Jahr (bis 50), Premium 179 €/Jahr (bis 100); Zu-/Absagen, Teilnehmerlisten, Erinnerungen, kostenlose Mitglieder-App |
| unsere-vereinsapp.de | Vereinsapp | ab 6 € im Monat bis 100 Mitglieder, alle Funktionen, Eventkalender, Buchung von Plätzen und Hallen, Dokumente, Rollen |
| campai | Vereinssoftware | ca. 30 € im Monat bei 100 Mitgliedern (unsichere Angabe), Buchhaltung, Beiträge |
| SportMember | Vereinssoftware | Basic kostenlos, Pro 22 € im Monat (122 Mitglieder) |
| Weitere | – | Webling kostenlos bis 50 Mitglieder; Collmex ab 11,95 €; Heja kostenlos mit Gruppenchat; Teamy mit Anwesenheit und Aufgaben (Fahrdienste, Material); Klubraum als neue Vereins-App (Freemium); DFBnet-App (Liveticker, Ergebnisse, Aufstellungen, Spielbericht für Vereinsmelder und Staffelleiter) |

### Was das für Clubroof bedeutet

**Bestätigt (Alleinstellung bleibt plausibel):**
- Team-Apps (Spond, SpielerPlus, easy2coach, Teamodo) und Vereinssoftware (easyVerein, campai, Vereinsplaner) sind weiter getrennte Welten, die Annäherung läuft von beiden Seiten (Spond Club, Teamodo-Vereinstarif, Vereinsplaner mit App). Der Unterschied „ein Rechtekonzept über Mannschaft und Verein“ trägt, ist aber **nicht mehr konkurrenzlos**: Teamodo nennt Rollen für Kassenwart und sportliche Leitung.
- **Keine Werbung durch Dritte** ist ein belegbarer Unterschied zu SpielerPlus (Basis mit Werbung) und Spond (Werbung laut Wettbewerber).
- Steuerliche Bereiche, Haushaltsplan, Kassenprüfung in der Vereinskasse: bei Team-Apps nicht belegt; bei easyVerein/campai gibt es Buchhaltung, aber nicht gemeinsam mit Mannschaftsalltag.
- Gastspieler und Spielerbedarf zwischen Mannschaften: weiterhin in keiner Quelle belegt.

**Wo Clubroof nachzieht oder ehrlich benennen sollte:**
1. **Online-Zahlung und SEPA** (Spond, easyVerein, campai). Weiter Lücke (Entscheidung K2).
2. **Taktikboard und große Übungsbibliothek** (easy2coach: über 2.500 Übungen; Teamodo: Übungsdatenbank). Clubroof hat Trainingsplanung mit eigener Übungsbibliothek, aber ohne Taktikboard und ohne mitgelieferte Übungen.
3. **Gruppenchat** (Heja, Teamodo, Spond) bleibt Verkaufshindernis; das Forum ersetzt ihn nur teilweise.
4. **Vereinswebsite** (ClubDesk, Spond Club) fehlt.
5. **Verbandsanbindung** (DFBnet-App, FUSSBALL.DE): nur Importdateien.
6. **Preiswahrnehmung:** viele Bausteine sind kostenlos oder sehr günstig (Spond, easy2coach, Teamodo-Basis, Vereinsplaner Free, unsere-vereinsapp ab 6 €). Bezahlte Vereinssoftware beginnt bei etwa 7–30 € im Monat für 100 Mitglieder. Die Beispiel-Tarife der Webseite (29 / 49 / 89 € für bis 300 / 500 / 1.000 Mitglieder) liegen im Rahmen von campai, aber über easyVerein-Small; sie müssen über den Zusammenschluss von Team und Verein begründet werden, nicht über den Preis.

### Folgen für die Webseite (Entwurf)
- Vergleichstabelle „Team-Apps / Vereinssoftware / Clubroof“ angepasst: Mitgliederverwaltung bei Team-Apps „Teilweise“ (Spond Club), Desktop bei Team-Apps „Web“.
- Kein Satz wie „als einzige“ oder „keine andere App“. Aussagen zu Wettbewerbern bleiben Kategorien, keine Namen.
- Offene Entscheidung: **Gemeinnützigkeits-Nachlass** (easyVerein: bis 50 %) und **Preisstaffel** vor der Veröffentlichung klären.
