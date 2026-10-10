/**
 * Inhalte der Hilfe („Mehr → Hilfe & Anleitung“): kurze Anleitungen und häufige Fragen.
 * Abschnitte für Trainer, Kasse, Eltern und Verwaltung erscheinen nur bei passender Rolle.
 * Bei neuen Funktionen hier ergänzen (siehe CLAUDE.md).
 */

export type HelpAudience = 'all' | 'parent' | 'coach' | 'treasurer' | 'member' | 'admin';

export type HelpEntry = {
  id: string;
  question: string;
  answer: string;
  /** Springt direkt zur Funktion */
  link?: { label: string; href: string };
};

export type HelpSection = {
  id: string;
  title: string;
  audience: HelpAudience;
  entries: HelpEntry[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'start',
    title: 'Erste Schritte',
    audience: 'all',
    entries: [
      {
        id: 'overview',
        question: 'Wo finde ich was?',
        answer:
          'Unten gibt es fünf Bereiche:\n• Home: dein Überblick – nächste Spiele (zum Wischen), Offenes, deine Woche, Neuigkeiten und dein Schnellzugriff.\n• Team: alles zu deiner Mannschaft (Kader, Statistik, Kasse …).\n• Termine: deine nächsten Termine und der Kalender.\n• Verein: News, Umfragen, Dokumente, Helferdienste, Mannschaften des Vereins.\n• Mehr: dein Profil, Einstellungen, Abwesenheiten und diese Hilfe.',
      },
      {
        id: 'login',
        question: 'Ich habe mein Passwort vergessen.',
        answer:
          'Tippe auf der Anmeldeseite auf „Passwort vergessen?“. Du bekommst einen Link per E-Mail, mit dem du ein neues Passwort festlegst. Im Konto kannst du es jederzeit ändern.',
        link: { label: 'Konto & Einstellungen', href: '/account' },
      },
      {
        id: 'dark',
        question: 'Kann ich die App dunkel darstellen?',
        answer:
          'Ja. Unter „Mehr → Konto & Einstellungen → Darstellung“ wählst du Hell, Dunkel oder „Wie Gerät“. Die Wahl gilt auf allen deinen Geräten.',
        link: { label: 'Darstellung ändern', href: '/account' },
      },
      {
        id: 'comfort',
        question: 'Kann ich die Schrift vergrößern, die App sperren oder sie ohne Netz nutzen?',
        answer:
          'Ja. Unter „Mehr → Konto & Einstellungen“ stellst du die Schriftgröße ein (Normal, Groß, Sehr groß) und kannst die App mit Face ID, Fingerabdruck oder Gerätecode sperren. Ohne Internet zeigt die App die zuletzt geladenen Termine, News und Kader; oben erscheint dann ein Hinweis. Antworten und Änderungen sind erst mit Verbindung möglich.',
        link: { label: 'Einstellungen öffnen', href: '/account' },
      },
      {
        id: 'route',
        question: 'Wie komme ich zum Spielort?',
        answer:
          'Im Termin steht beim Ort der Button „Route“. Er öffnet die Karten-App deines Handys (oder Google Maps im Browser) mit dem Spielort. Trainer können beim Anlegen einen Maps-Link oder Koordinaten hinterlegen, sonst wird die eingetragene Adresse verwendet.',
      },
      {
        id: 'tile-hints',
        question: 'Was bedeuten die Hinweise unter den Kacheln?',
        answer:
          'Die kleine Zeile unter dem Namen einer Kachel zeigt, was für dich gerade wichtig ist, z. B. „Du hast 12,50 € offen“, „Antwort fehlt“ oder „2 zur Freigabe“. Die Farbe verstärkt den Text: Orange heißt, es gibt etwas zu tun. Was du nicht sehen darfst, wird nicht angezeigt.',
      },
      {
        id: 'language',
        question: 'Kann ich die Sprache der App ändern?',
        answer:
          'Ja. Unter „Mehr → Konto & Einstellungen → Sprache“ wählst du Deutsch, English oder „Automatisch“ (Sprache deines Geräts). Die Wahl gilt auf allen deinen Geräten, auch für Push-Nachrichten. Texte, die Trainer oder Vorstand selbst schreiben (z. B. News), bleiben in der Sprache der Verfasser.',
        link: { label: 'Sprache ändern', href: '/account' },
      },
      {
        id: 'colors',
        question: 'Was bedeuten die Farben und Abzeichen?',
        answer:
          'Rot steht für Dringendes, Orange für etwas, das du erledigen sollst, Blau für Informationen und Grün für Erledigtes. Farben haben immer auch eine Beschriftung. Kleine Zahlen an Kacheln zeigen offene Punkte, z. B. unbeantwortete Umfragen.',
      },
    ],
  },
  {
    id: 'events',
    title: 'Termine und Zusagen',
    audience: 'all',
    entries: [
      {
        id: 'quick-access',
        question: 'Wie ändere ich den Schnellzugriff auf Home?',
        answer:
          'Ganz unten auf Home findest du den Schnellzugriff – Abkürzungen zu Seiten, die du oft brauchst. Tippe auf „Hinzufügen“, wähle die Einträge aus und speichere. „Zurücksetzen“ stellt die Voreinstellung für deine Rolle wieder her. Die Auswahl gilt auf allen deinen Geräten.',
      },
      {
        id: 'respond',
        question: 'Wie sage ich zu oder ab?',
        answer:
          'Öffne den Termin (Home, Termine oder Team) und tippe auf Zusagen, Unsicher oder Absagen. Bei „Absagen“ und „Unsicher“ kannst du einen Grund wählen oder schreiben – das ist freiwillig. Den Grund sehen nur das Trainerteam und du selbst.',
      },
      {
        id: 'deadline',
        question: 'Was ist die Absagefrist?',
        answer:
          'Jede Mannschaft legt fest, bis wann Zu- und Absagen möglich sind. Der Countdown steht am Termin („Frist: Noch 2 Tage“). Danach wende dich an dein Trainerteam – es kann die Rückmeldung für dich ändern.',
      },
      {
        id: 'absence',
        question: 'Ich bin im Urlaub oder verletzt. Muss ich jeden Termin absagen?',
        answer:
          'Nein. Trage eine Abwesenheit ein (Urlaub, Verletzt, Krank, Sonstiges). Alle betroffenen Termine werden automatisch abgesagt, das Trainerteam sieht es sofort. Löschst du die Abwesenheit, werden die automatischen Absagen zurückgenommen.',
        link: { label: 'Abwesenheit eintragen', href: '/absences/new' },
      },
      {
        id: 'club-events',
        question: 'Wie funktionieren Veranstaltungen des Vereins?',
        answer:
          'Bei Vereinsveranstaltungen (z. B. Jahreshauptversammlung, Turnier) kannst du Zusagen, Absagen oder „Unsicher“ wählen – ohne Begründung. Zusätzlich gibt es oft „Helfer gesucht“: Trage dich in eine Schicht ein.',
        link: { label: 'Veranstaltungen ansehen', href: '/club-events' },
      },
      {
        id: 'calendar',
        question: 'Kann ich alle Termine im Handy-Kalender sehen?',
        answer:
          'Ja, mit dem Kalender-Abo: „Mehr → Kalender-Abo“, Abo-Link erstellen und im Kalender des Handys hinzufügen. Dort erscheinen deine Termine, die deiner Kinder und die Vereinstermine. Der Link ist geheim – gib ihn nicht weiter. Du kannst ihn jederzeit erneuern.',
        link: { label: 'Kalender-Abo', href: '/calendar' },
      },
      {
        id: 'club-calendar',
        question: 'Wo sehe ich die Termine des ganzen Vereins?',
        answer:
          'Unter „Verein → Heute auf der Anlage → Kalender anzeigen“. Dort stehen alle Trainings, Spiele und Veranstaltungen aller Mannschaften. Zu- und Absagen anderer Mannschaften siehst du dort nicht; Termine deiner eigenen Mannschaften öffnest du mit einem Tipp.',
        link: { label: 'Vereinskalender', href: '/club-calendar' },
      },
      {
        id: 'carpool',
        question: 'Wie organisiere ich eine Fahrgemeinschaft?',
        answer:
          'Bei Auswärtsspielen und Turnieren gibt es im Termin den Bereich „Fahrgemeinschaften“. Tippe auf „Ich fahre“ und gib die freien Plätze an, oder wähle bei einem Auto „Mitfahren“. Wer keine Mitfahrt hat, tippt auf „Mitfahrt suchen“. Eltern buchen für ihre Kinder.',
      },
    ],
  },
  {
    id: 'team',
    title: 'Mannschaft und Statistik',
    audience: 'all',
    entries: [
      {
        id: 'roster',
        question: 'Wo sehe ich Kader, Rückennummern und Verfügbarkeit?',
        answer:
          'Unter „Team → Kader“. Dort stehen Trainerteam und Spieler mit Nummer und Position. Wer gerade abwesend ist, ist gekennzeichnet; den Grund sehen nur Berechtigte.',
      },
      {
        id: 'stats',
        question: 'Was zeigt die Statistik?',
        answer:
          'Unter „Team → Statistik“ findest du oben die Saison-Bilanz und darunter Kacheln: Kader, Training, Torschützen, Scorer, Karten und Ergebnisse. Jede Auswertung hat einen eigenen Zeitraum: gesamte Saison, letzter Monat oder ein selbst gewählter Zeitraum. Die Trainingsbeteiligung sehen alle Personen der Mannschaft.',
      },
      {
        id: 'tasks',
        question: 'Wie funktionieren Mannschaftsaufgaben?',
        answer:
          'Unter „Team → Aufgaben“ stehen Dinge wie Trikotwäsche, Fahrdienst oder Kuchen. Offene Aufgaben übernimmst du mit „Ich übernehme“ (Eltern auch für ihr Kind) und hakst sie ab, wenn sie erledigt sind.',
      },
      {
        id: 'guest',
        question: 'Was sind Gastspieler?',
        answer:
          'Wenn eine Mannschaft für ein Spiel Spieler braucht, meldet das Trainerteam einen Bedarf. Andere Mannschaften können Spieler abstellen. Du siehst dann den Einsatz im Termin als „Gastspieler“.',
      },
    ],
  },
  {
    id: 'cash',
    title: 'Mannschaftskasse',
    audience: 'all',
    entries: [
      {
        id: 'cash-view',
        question: 'Was sehe ich in der Kasse?',
        answer:
          'Unter „Team → Kasse“ steht der Kassenstand mit Einnahmen und Ausgaben, deine eigenen Buchungen („Mein Konto“) und die letzten Buchungen der Mannschaft. Die Statistik zeigt Diagramme und Auswertungen. Die Kasse sieht die ganze Mannschaft.',
      },
      {
        id: 'cash-fines',
        question: 'Wofür bekomme ich Strafen und wo stehen sie?',
        answer:
          'Strafen und ihre Beträge legen Trainerteam und Kassenwart im Strafenkatalog fest („Team → Strafenkatalog“). Wurde dir eine Strafe vergeben, steht sie als offener Betrag auf deinem Konto und du bekommst eine Benachrichtigung.',
      },
      {
        id: 'cash-pay',
        question: 'Wie bezahle ich meinen offenen Betrag?',
        answer:
          'Tippe in „Mein Konto“ auf „Bezahlen / Zahlung melden“. Du siehst die Bezahlinfos der Mannschaft (IBAN zum Kopieren, PayPal, bar). Nach dem Bezahlen tippst du „Ich habe bezahlt“. Sobald die Kasse den Eingang bestätigt hat, ist dein Konto ausgeglichen.',
      },
    ],
  },
  {
    id: 'club',
    title: 'Verein',
    audience: 'all',
    entries: [
      {
        id: 'news',
        question: 'Wo stehen Neuigkeiten?',
        answer:
          'Auf der Startseite und unter „Verein → News“. Dringende Meldungen stehen oben und erreichen dich auch per Push. Mit „Gefällt mir“ und Kommentaren kannst du reagieren.',
        link: { label: 'News', href: '/news' },
      },
      {
        id: 'polls',
        question: 'Wie nehme ich an Umfragen teil?',
        answer:
          'Offene Umfragen erscheinen auf der Startseite im Band „Offen“ – tippe sie an und antworte direkt – und unter „Verein → Umfragen“.',
        link: { label: 'Umfragen', href: '/polls' },
      },
      {
        id: 'docs',
        question: 'Wo finde ich Satzung, Formulare und Pläne?',
        answer:
          'Unter „Verein → Dokumente“. Du kannst suchen und nach Art filtern (Ordnungen, Formulare, Trainingspläne). Mannschaftsdokumente findest du zusätzlich im Team-Bereich.',
        link: { label: 'Dokumente', href: '/documents' },
      },
      {
        id: 'helpers',
        question: 'Wie melde ich mich als Helfer?',
        answer:
          'Unter „Verein → Helfer gesucht“ siehst du Veranstaltungen mit freien Schichten. Tippe auf „Eintragen“; mit „Austragen“ nimmst du die Anmeldung zurück.',
        link: { label: 'Helfer gesucht', href: '/helpers' },
      },
      {
        id: 'contacts',
        question: 'An wen kann ich mich wenden?',
        answer:
          'Unter „Verein → Ansprechpartner“ stehen Vorstand, Leitung und Trainer mit Telefon und E-Mail (je nach Freigabe). Mit einem Tipp auf das Symbol rufst du an oder schreibst.',
        link: { label: 'Ansprechpartner', href: '/contacts' },
      },
      {
        id: 'more-modules',
        question: 'Was sind Fundbüro, Forum und Vereinswissen?',
        answer:
          'Das sind optionale Funktionen, die dein Verein einschalten kann: Fundbüro & Marktplatz für Gesuchtes und Gefundenes, ein kleines Forum für wenige Themen und Vereinswissen mit Artikeln wie „Wo gibt es den Schlüssel?“. Sie erscheinen nur, wenn sie aktiv sind.',
      },
    ],
  },
  {
    id: 'notify',
    title: 'Benachrichtigungen',
    audience: 'all',
    entries: [
      {
        id: 'push',
        question: 'Welche Meldungen bekomme ich und wie stelle ich sie ein?',
        answer:
          'Unter „Mehr → Benachrichtigungen → Einstellungen“ wählst du je Thema: Push, nur in der App oder aus. Dort kannst du auch einzelne Mannschaften stummschalten. Dringendes (z. B. kurzfristige Absagen) kommt immer an.',
        link: { label: 'Einstellungen', href: '/notification-settings' },
      },
      {
        id: 'quiet',
        question: 'Werde ich nachts gestört?',
        answer:
          'Nein. In der Ruhezeit (22 bis 7 Uhr) gibt es keine Push-Nachrichten außer bei dringenden Meldungen. Alles andere wartet bis zum Morgen.',
      },
      {
        id: 'push-browser',
        question: 'Ich nutze die App im Browser – bekomme ich Push?',
        answer:
          'Push-Nachrichten gibt es in der App auf dem Handy. Im Browser erscheinen alle Meldungen im Benachrichtigungs-Center (Glocke oben).',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Konto und Datenschutz',
    audience: 'all',
    entries: [
      {
        id: 'profile',
        question: 'Wie ändere ich mein Profil und mein Foto?',
        answer:
          'Unter „Mehr → Profil & Statistik“. Dort kannst du Foto, Position, Kontaktdaten und die Sichtbarkeit deiner Kontaktdaten ändern. Du bestimmst, wer sie sehen darf.',
      },
      {
        id: 'who-sees',
        question: 'Wer sieht meine Daten?',
        answer:
          'So wenig wie nötig: Gründe für Absagen und Abwesenheiten sehen nur das Trainerteam und du. Kontaktdaten sehen nur die Personen, die du freigibst. Eltern sehen die Daten ihrer Kinder. Trainingsbeteiligung und Kassenstand sieht die eigene Mannschaft.',
      },
      {
        id: '2fa',
        question: 'Was ist die 2-Faktor-Anmeldung?',
        answer:
          'Ein zusätzlicher Schutz: Nach dem Passwort fragt die App einen Code ab – aus einer Authenticator-App oder per E-Mail (6 Stellen, 10 Minuten gültig, nur einmal nutzbar). Du richtest ihn unter „Mehr → Konto & Einstellungen“ ein. Pflicht ist er nur für das Administrationskonto, wenn der Verein es verlangt.',
        link: { label: 'Konto & Einstellungen', href: '/account' },
      },
    ],
  },
  {
    id: 'parents',
    title: 'Für Eltern',
    audience: 'parent',
    entries: [
      {
        id: 'children',
        question: 'Wie verwalte ich mein Kind?',
        answer:
          'Unter „Mehr → Meine Kinder“ (und auf Home und Termine) siehst du Termine, Zusagen und Abwesenheiten deiner Kinder. Du sagst für sie zu oder ab, trägst Abwesenheiten ein und bekommst ihre Benachrichtigungen. Das Kind braucht dafür kein eigenes Login.',
      },
      {
        id: 'children-pay',
        question: 'Wo sehe ich, was mein Kind schuldet?',
        answer:
          'Im Team-Bereich der Mannschaft unter „Kasse → Konto <Name>“. Dort steht der offene Betrag, und du kannst die Zahlung melden.',
      },
    ],
  },
  {
    id: 'coach',
    title: 'Für Trainerteams',
    audience: 'coach',
    entries: [
      {
        id: 'coach-event',
        question: 'Wie lege ich einen Termin an oder sage ihn ab?',
        answer:
          '„Team → Termin anlegen“: Training, Spiel oder Mannschaftstermin. Spiele bekommen die Art Liga, Pokal oder Testspiel. Zum Wiederholen wählst du „Wöchentlich bis …“ und das Enddatum (bis zu etwa einem Jahr). Die Treffzeit berechnet die App aus den Regeln deiner Mannschaft; im einzelnen Termin kannst du sie überschreiben. Im Termin änderst du mit „Termin bearbeiten“ einzelne Termine oder „diesen und folgende“. Mit „Termin absagen“ wird die Mannschaft sofort benachrichtigt.',
      },
      {
        id: 'coach-manage',
        question: 'Wie bearbeite ich Kader, Kassenwart und Treffpunkt-Regeln?',
        answer:
          '„Team → Kader → Mannschaft bearbeiten“: Spieler aus der Vereinsliste hinzufügen oder aus dem Kader nehmen, Funktion (Spieler, Co-Trainer, Betreuer) und Rückennummer ändern, den Kassenwart bestimmen. Unten stellst du ein, wie viele Minuten vor Spielen und Trainings ihr euch trefft, den Standard-Treffpunkt und die Schreibweisen eurer Mannschaft im DFBnet. Co-Trainer haben dieselben Rechte wie der Trainer.',
        link: { label: 'Kader', href: '/team' },
      },
      {
        id: 'coach-import',
        question: 'Wie importiere ich den Spielplan aus dem DFBnet?',
        answer:
          '„Mannschaft bearbeiten → Spielplan importieren“: CSV-Datei aus dem DFBnet wählen, Vorschau prüfen (neu, geändert, unverändert, übersprungen) und übernehmen. Die Mannschaft bekommt eine Sammelmeldung. Ein erneuter Import aktualisiert Verlegungen, statt Spiele doppelt anzulegen. Innerhalb von 24 Stunden kannst du den Import rückgängig machen.',
      },
      {
        id: 'coach-override',
        question: 'Wie ändere ich Zusagen anderer?',
        answer:
          'Tippe im Termin bei „Teilnehmer“ auf eine Person und wähle Zusage, Unsicher oder Absage. Das geht auch nach Ablauf der Frist (bis eine Woche nach Beginn).',
      },
      {
        id: 'coach-lineup',
        question: 'Wie stelle ich die Aufstellung auf und führe den Spielbericht?',
        answer:
          'Im Spieltermin: „Aufstellung erstellen“ (Startelf und Bank). Der Entwurf ist nur für das Trainerteam sichtbar; erst „Veröffentlichen“ benachrichtigt die Nominierten. Nach dem Spiel trägst du Ergebnis, Tore, Vorlagen und Karten im Spielbericht ein – erst dann zählen sie in der Statistik.',
      },
      {
        id: 'coach-attendance',
        question: 'Was bringt „Anwesenheit erfassen“?',
        answer:
          'Nach Beginn eines Termins hakst du ab, wer wirklich da war (vorausgewählt sind die Zusagen). Danach zählt für Trainingsquote und Statistik die Anwesenheit statt der Zusage. Auf Home erinnert dich ein Hinweis an Trainings der letzten Woche.',
      },
      {
        id: 'coach-plan',
        question: 'Wie plane ich das Training?',
        answer:
          'Im Training: „Plan erstellen“ mit Schwerpunkt, Ablauf und Notizen. Die Übungsbibliothek („Team → Übungen“) füllst du selbst; mit „Zum Training“ hängst du eine Übung an einen der nächsten Pläne. Spieler sehen nur Schwerpunkt und Material.',
      },
      {
        id: 'coach-modules',
        question: 'Wie stelle ich Funktionen meiner Mannschaft ein?',
        answer:
          'Unter „Team → Funktionen“ schaltest du z. B. Statistik, Kasse oder Aufgaben für deine Mannschaft ein und aus. Was der Verein oder Bereich ausgeschaltet hat, bleibt gesperrt.',
      },
      {
        id: 'coach-invite',
        question: 'Wie lade ich neue Spieler ein?',
        answer:
          '„Mehr → Einladen“: persönlich per E-Mail oder als Mannschafts-Link bzw. QR-Code zum Selbstregistrieren. Bei Links gibst du neue Anfragen frei, bevor jemand die App nutzen kann.',
      },
      {
        id: 'coach-cash',
        question: 'Was darf das Trainerteam in der Kasse?',
        answer:
          'Buchen, Strafen vergeben, Einzahlungen erfassen und den Strafenkatalog pflegen – gemeinsam mit dem Kassenwart. Alles Weitere steht im Abschnitt „Kassenverwaltung“.',
      },
    ],
  },
  {
    id: 'treasurer',
    title: 'Kassenverwaltung',
    audience: 'treasurer',
    entries: [
      {
        id: 'tr-start',
        question: 'Wo finde ich die Funktionen?',
        answer:
          '„Team → Kasse → Kassenverwaltung“. Dort liegen als Kacheln: Einnahme/Ausgabe, Einzahlungen, Strafe vergeben, Getränke-Strichliste, Umlage, Beiträge, Buchungen & Storno, Kassenwart, Bezahlinfos und Kassenprüfung.',
      },
      {
        id: 'tr-payments',
        question: 'Wie buche ich Einzahlungen?',
        answer:
          'Unter „Einzahlungen“ Personen anhaken, Betrag prüfen (der offene Betrag ist vorausgefüllt), Zahlungsart wählen und buchen – auch mehrere auf einmal. Schneller: In „Offene Beträge“ die Person antippen.',
      },
      {
        id: 'tr-claims',
        question: 'Wie funktionieren Umlage, Beiträge und Getränke?',
        answer:
          'Umlage: Gesamtbetrag auf gewählte Personen aufteilen oder festen Betrag je Person fordern. Beiträge: z. B. 5 € monatlich, die App bucht sie allen Spielern zum Fälligkeitstag. Getränke: Preis festlegen und je Person Striche zählen. Alle Betroffenen werden benachrichtigt.',
      },
      {
        id: 'tr-storno',
        question: 'Ich habe mich verbucht. Was tun?',
        answer:
          'Buchungen werden nie gelöscht, sondern storniert: „Buchungen & Storno“, Buchung antippen, optional Grund eintragen. Die Buchung bleibt durchgestrichen sichtbar und steht im Änderungsprotokoll. Zum Korrigieren neu buchen.',
      },
      {
        id: 'tr-notice',
        question: 'Was ist mit „Ich habe bezahlt“-Meldungen?',
        answer:
          'Mitglieder melden Zahlungen in ihrem Konto. Du siehst sie in der Kassenverwaltung unter „Zahlungsmeldungen“ und bestätigst mit „Eingegangen“ – dann wird die Einzahlung gebucht – oder „Nicht gefunden“.',
      },
      {
        id: 'tr-more',
        question: 'Erinnerung, Bezahlinfos und Kassenprüfung?',
        answer:
          'Erinnerungen an offene Beträge verschickst du per Knopf oder lässt sie monatlich automatisch laufen (Einstellungen). Unter „Bezahlinfos & Einstellungen“ hinterlegst du IBAN und PayPal und bestimmst, ob alle die offenen Beträge der anderen sehen. „Kassenprüfung“ hält den Stand mit Prüfer fest. Berichte gibt es als Excel und PDF.',
      },
    ],
  },
  {
    id: 'member',
    title: 'Für Vereinsmitglieder',
    audience: 'member',
    entries: [
      {
        id: 'member-what',
        question: 'Was kann ich als Vereinsmitglied?',
        answer:
          'Du siehst den Vereinsüberblick, alle Vereinstermine und News, kannst bei Veranstaltungen zu- oder absagen und dich als Helfer eintragen. Eigene News kannst du schreiben; sie werden nach Freigabe durch den Vorstand veröffentlicht.',
      },
      {
        id: 'member-news',
        question: 'Wie schreibe ich eine News?',
        answer:
          'Unter „Verein → News schreiben“. Reiche die News zur Freigabe ein; der Vorstand prüft sie und veröffentlicht sie oder meldet sich bei dir.',
      },
    ],
  },
  {
    id: 'admin',
    title: 'Verwaltung',
    audience: 'admin',
    entries: [
      {
        id: 'admin-start',
        question: 'Wo ist die Verwaltung?',
        answer:
          'Über das Schild-Symbol oben rechts oder „Mehr → Verwaltung“. Mit „Beenden“ kehrst du zur normalen App zurück. Unten wechselst du zwischen Übersicht, Mitgliedern, Teams, Festen und News.',
      },
      {
        id: 'admin-roles',
        question: 'Wie vergebe ich Rollen?',
        answer:
          'Unter „Verwaltung → Rollen & Aufgaben“ siehst du je Rolle die Personen. „Alle anzeigen“ öffnet die vollständige Liste mit Suche; „<Rolle> hinzufügen“ vergibt die Rolle an weitere Personen. Rollen sind Rechtepakete und gelten für Verein, Bereich oder Mannschaft. Der letzte Fulladmin kann nicht entfernt werden.',
        link: { label: 'Rollen & Aufgaben', href: '/admin/roles' },
      },
      {
        id: 'admin-members',
        question: 'Wie lege ich Mitglieder an oder importiere sie?',
        answer:
          'Einzeln unter „Mitglieder → Mitglied anlegen“ oder per CSV-Import (Vorschau vor der Übernahme, Dubletten werden übersprungen). Austritte beenden Mannschaftszugehörigkeiten und sperren den App-Zugang. In der Mitgliederliste filterst du nach Rolle, Trainerteam, individuellen Rechten oder fehlendem App-Zugang.',
      },
      {
        id: 'admin-permissions',
        question: 'Wie vergebe ich einzelne Rechte an ein Mitglied?',
        answer:
          'Im Mitglied unter „Rollen & Zusatzaufgaben → Individuelle Rechte“: Liste aller Rechte zum An- und Abwählen. Sie gelten zusätzlich zu den Rollen für den ganzen Verein, jede Änderung steht im Änderungsprotokoll. Ein Recht für nur eine Mannschaft vergibst du besser über eine Rolle mit Geltungsbereich.',
      },
      {
        id: 'admin-schedule-import',
        question: 'Wie importiere ich den Vereinsspielplan aus dem DFBnet?',
        answer:
          'Unter „Verwaltung → Spielplan-Import“ die CSV-Datei wählen. Namen aus dem DFBnet ordnest du einmal euren Mannschaften zu (die Schreibweise wird gemerkt), danach legt der Import alle Spiele der Mannschaften an. Spiele zwischen zwei eigenen Mannschaften erscheinen bei beiden. Pokal-, Liga- und Testspiele werden erkannt; Spiele, die nicht in der Datei stehen (z. B. Testspiele und Turniere), legen Trainer, sportliche Leitung oder Verwaltung selbst an.',
      },
      {
        id: 'admin-modules',
        question: 'Wie schalte ich Funktionen ein oder aus?',
        answer:
          'Unter „Verwaltung → Module“. Neue Funktionen erscheinen im Update-Center; du richtest sie ein, schiebst sie auf oder entscheidest dich dagegen. Einzelne Bereiche und Mannschaften lassen sich zusätzlich abweichend einstellen.',
      },
      {
        id: 'admin-season',
        question: 'Wie funktioniert der Saisonwechsel?',
        answer:
          'In zwei Schritten unter „Mannschaften & Saison“: Folgesaison vorbereiten (Mannschaften, Trainerteams und Aufgaben werden kopiert, der Kader ist planbar) und dann starten. Kasse, Dokumente und künftige Termine gehen auf die Nachfolgemannschaft über.',
      },
      {
        id: 'admin-audit',
        question: 'Wo sehe ich, wer was geändert hat?',
        answer:
          'Im „Änderungsprotokoll“ (Verwaltung): Rollenvergaben, Absagen, Modulwechsel, Kassenbuchungen und Stornos mit Person und Zeitpunkt.',
      },
    ],
  },
];
