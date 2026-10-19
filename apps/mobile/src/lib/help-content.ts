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
        id: 'area-overview',
        question: 'Was zeigt die Abteilungsübersicht im Team-Tab?',
        answer:
          'Sportliche Leitung, Jugendleitung und Vorstand sehen im Reiter „Team“ eine Übersicht über die Abteilungen (Senioren, Frauen, Jugend) – ohne Zugriff in die einzelnen Mannschaften. Oben stehen die Kennzahlen, darunter eine Karte je Mannschaft mit Kader, Trainerteam, Trainingsbeteiligung der letzten 4 Wochen und dem nächsten Spiel. Die Ampel gilt nur für die Trainingsbeteiligung: gut ab 65 %, mittel 50–64 %, niedrig darunter; bei weniger als 3 erfassten Einheiten steht „zu wenig Daten“. Wer auch selbst in einer Mannschaft ist, schaltet oben zwischen „Meine Mannschaft“ und „Übersicht“ um.',
      },
      {
        id: 'time-picker',
        question: 'Wie stelle ich eine Uhrzeit ein?',
        answer:
          'Tippe auf die Uhrzeit: Es öffnet sich ein Fenster mit zwei Drehwalzen wie bei einem Wecker – links die Stunde, rechts die Minute (in 5er-Schritten). Wische oder scrolle, bis die richtige Zeit in der Mitte steht, und tippe auf „Übernehmen“. Beim Anlegen eines Termins wählst du Beginn und Ende; die Dauer zeigt die App darunter.',
      },
      {
        id: 'invite-audience',
        question:
          'Wie lade ich nur bestimmte Mannschaften oder Personen zu einer Veranstaltung ein?',
        answer:
          'Beim Planen einer Veranstaltung wählst du oben die Gruppe („Ganzer Verein“, eine Abteilung …). Mit „Mannschaften oder Personen auswählen“ lädst du gezielt ein: Setze im Fenster Häkchen bei Mannschaften oder suche Personen. Die Auswahl erscheint als Chips; mit „×“ nimmst du jemanden wieder heraus. Nur die Eingeladenen werden benachrichtigt. Einzelne Personen darfst du nur mit dem Recht für die Mitgliederliste einladen.',
      },
      {
        id: 'admin-area',
        question: 'Wo finde ich die Verwaltung und die Vereinskasse?',
        answer:
          'Unter „Mehr“ stehen direkt unter deinem Profil zwei Zugänge: „Admin-Verwaltung“ (violett) für alle mit Verwaltungsrechten und „Vereinskasse“ (blau) für alle mit Kassenzugriff. Beide öffnen einen eigenen Bereich mit farbigem Kopfband und „Beenden“ oben sowie einer Leiste mit Reitern unten. Die Verwaltung hat die Reiter Übersicht, Mitglieder, Sport, Inhalte und Verein – du siehst nur, wofür du Rechte hast. In der Vereinskasse gibt es Übersicht, Buchung, Beiträge, Planung und Prüfung. Funktionen mit „Bald verfügbar“ folgen in einem späteren Update.',
      },
      {
        id: 'cash-overview',
        question: 'Was ist die Kassenübersicht?',
        answer:
          'Der Vorstand sieht – wenn der Verein es in „Einsicht“ freigibt – unter „Verein → Vereinsleben → Kassenübersicht“ eine reine Anzeige: Kassenstand gesamt, Einnahmen und Ausgaben, die einzelnen Kassen und die Beitragsquote. Buchungen, Belege und Funktionen gibt es dort nicht; die Vereinskasse selbst führen Kassenwart und Kassenprüfer.',
        link: { label: 'Kassenübersicht', href: '/club-cash-overview' },
      },
      {
        id: 'archive',
        question: 'Wie sehe ich vergangene Termine?',
        answer:
          'Im Reiter „Termine“ schaltest du oben auf „Vergangen“ oder öffnest das „Archiv“. Dort stehen alle vergangenen Termine, die neuesten zuerst, nach Wochen und Monaten gruppiert; beim Scrollen werden ältere nachgeladen. Filtere nach Zeitraum (letzte 7 Tage, Monat, Saison oder eigener Zeitraum), Mannschaft und Art. Spiele zeigen das Ergebnis, Trainings die Anwesenheit („14 von 20 da“). Ob du auch siehst, wer da war, stellt dein Trainerteam pro Mannschaft ein.',
        link: { label: 'Archiv', href: '/events/archive' },
      },
      {
        id: 'calendar-grid',
        question: 'Was bedeuten die Felder im Kalender?',
        answer:
          'Im Kalender zeigt jedes Feld die Termine des Tages als Kürzel der Mannschaft: kräftig grün sind Spiele, hellblau Training, hellorange mit gestricheltem Rand Vereinstermine; abgesagte Termine sind rot umrandet und durchgestrichen. „+2“ heißt: zwei weitere Termine. Tippe auf einen Tag, um seine Termine unter dem Kalender zu sehen; „Heute“ springt zum heutigen Tag.',
      },
      {
        id: 'team-switch',
        question: 'Wie wechsle ich die Mannschaft?',
        answer:
          'Im Reiter „Team“ steht oben eine Leiste mit deinen Mannschaften (seitlich wischbar). Die Zahl zeigt, was offen ist: fehlende Rückmeldungen zum nächsten Termin und offene Aufgaben. Die aktive Mannschaft ist grün; die zuletzt gewählte merkt sich die App.',
      },
      {
        id: 'path',
        question: 'Wie komme ich zurück oder in einen anderen Bereich?',
        answer:
          'Auf jeder Unterseite siehst du oben deinen Weg, zum Beispiel „Team › Kasse › Strafenkatalog“. Tippe auf eine frühere Stufe, um dorthin zurückzugehen, oder auf den runden Pfeil für einen Schritt zurück. Bei langen Wegen steht „…“ für die ausgelassenen Stufen; ein Tipp zeigt sie als Liste. Die untere Leiste bleibt sichtbar, der aktuelle Bereich ist markiert.',
      },
      {
        id: 'first-start',
        question: 'Wie melde ich mich an oder richte einen Verein ein?',
        answer:
          'Mit Einladungslink oder Einladungscode (auch per QR-Code scannen) trittst du deinem Verein bei – der Verein wird danach auf diesem Gerät gemerkt. Hast du schon ein Konto, melde dich mit E-Mail und Passwort an („Zeigen“ macht das Passwort sichtbar). Einen neuen Verein richtest du mit dem Einrichtungscode (Format CR-XXXX-XXXX) ein, den du von Clubroof nach Zahlungseingang erhältst; er gilt einmal.',
      },
      {
        id: 'dates',
        question: 'Wie wähle ich ein Datum?',
        answer:
          'Mit den Pfeilen verschiebst du das Datum um einen Tag. Tippst du auf das Datum selbst, öffnet sich ein Kalender: Wische oder tippe auf die Pfeile, um den Monat zu wechseln, tippe auf einen Tag zum Auswählen oder wähle „Heute“. Nicht erlaubte Tage sind ausgegraut.',
      },
      {
        id: 'facility-grid',
        question: 'Wie lese ich die Platzbelegung?',
        answer:
          'Unter „Verein → Platzbelegung“ siehst du einen Stundenplan. Tag: eine Spalte je Platz, die Zeit läuft nach unten. Woche: Platz wählen, Spalten Montag bis Sonntag, das Wochenende steht abgesetzt darunter; Wischen wechselt die Woche. Termine sind Blöcke in der Farbe ihrer Mannschaft, Sperrungen sind schraffiert, Überschneidungen tragen ein Warnzeichen. Tippe auf einen Block für Details; verschieben kannst du hier nichts.',
        link: { label: 'Platzbelegung', href: '/facilities' },
      },
      {
        id: 'club-schedule',
        question: 'Wo sehe ich alle Spiele des Vereins?',
        answer:
          'Unter „Verein → Spielplan“. Dort stehen alle Spiele einer Woche, nach Tagen sortiert. Mit den Pfeilen oder durch Wischen wechselst du die Woche, mit dem Filter zeigst du nur Senioren oder Jugend. Mannschaften ohne Spiel stehen unter „Spielfrei“. Tippe auf ein Spiel deiner Mannschaft, um Details und Rückmeldungen zu sehen.',
        link: { label: 'Spielplan', href: '/club-schedule' },
      },
      {
        id: 'referee',
        question: 'Ich bin Schiedsrichter – wo trage ich meine Einsätze ein?',
        answer:
          'Unter „Verein → Schiedsrichter“. Der Verband setzt dich bei fremden Spielen ein; trage den Einsatz dort mit Spiel, Ort, Datum und Beginn ein. Er erscheint unter „Termine“ und in deinem Kalenderabo. Überschneidet er sich mit einem deiner Termine, bekommst du einen Hinweis; auf Wunsch wird für den Tag eine Abwesenheit eingetragen. Dort pflegst du auch deine Stufe und das Ablaufdatum deiner Lizenz.',
        link: { label: 'Schiedsrichter', href: '/referees' },
      },
      {
        id: 'sponsors',
        question: 'Was ist die Zeile „Unterstützt von … Anzeige“ und wo sehe ich alle Sponsoren?',
        answer:
          'Wenn dein Verein das Sponsoren-Modul nutzt, zeigt ein kleines Wischelement auf Home, im Team-Reiter und im Verein-Reiter bis zu drei Sponsoren, die der Verein als Werbung freigegeben hat. Es ist immer als „Anzeige“ gekennzeichnet und wechselt alle paar Sekunden von selbst; du kannst auch wischen. Ein Tipp öffnet die Seite des Sponsors. Alle Sponsoren findest du unter „Verein → Sponsoren“. Die App wertet nicht aus, wer was ansieht oder antippt. Manche Sponsoren stellt der Verein so ein, dass Jugendspieler sie nicht sehen.',
        link: { label: 'Unsere Sponsoren', href: '/sponsors' },
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
        id: 'club-code',
        question: 'Was ist das Vereinskürzel und wie ändere ich die Vibration?',
        answer:
          'Das Kürzel (2 bis 4 Zeichen, z. B. „SGW“) steht groß im Plakat der Startseite und ersetzt das Wappen, solange kein Logo hochgeladen ist. Die Vereinsadministration ändert es unter „Verwaltung → Verein & Design“, mit Vorschau. Die Vibration bei Auswahl und Bestätigung schaltest du auf dem Handy unter „Mehr → Konto & Einstellungen → Vibration“ aus; bei eingestellter „Bewegung reduzieren“ des Geräts bleiben auch die Animationen aus.',
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
        id: 'offline-respond',
        question: 'Kann ich ohne Internet zu- oder absagen?',
        answer:
          'Ja. Deine Antwort wird auf dem Gerät gemerkt, sofort angezeigt („Wird gesendet“) und automatisch gesendet, sobald du wieder online bist. Lehnt der Server sie ab – z. B. weil die Frist abgelaufen ist –, bekommst du eine Meldung.',
      },
      {
        id: 'swipe',
        question: 'Geht das auch schneller – per Wischen?',
        answer:
          'Ja. Bei offenen Terminen und ungelesenen Benachrichtigungen wischst du die Zeile nach links: Es erscheint „Zusagen“ bzw. „Gelesen“. Tippe darauf – oder wische ganz durch, dann passiert es sofort. Alles geht auch ohne Wischen über die Knöpfe in der Zeile.',
      },
      {
        id: 'search',
        question: 'Wie suche ich nach Terminen, Personen oder News?',
        answer:
          'Tippe oben rechts auf die Lupe und gib mindestens zwei Buchstaben ein. Du findest Termine, Mitglieder, News und Mannschaften. Personen siehst du nur, wenn du auch sonst ihr Profil sehen darfst (z. B. aus deiner Mannschaft oder deine Kinder).',
      },
      {
        id: 'tile-figures',
        question: 'Was bedeutet die kleine Zahl oben rechts an den Kacheln?',
        answer:
          'Die Kennzahl zeigt auf einen Blick, was dort los ist: bei Terminen und Veranstaltungen das Datum des nächsten (TT.MM.), beim Kader die Zahl der Spieler, bei der Statistik die Bilanz (Siege-Remis-Niederlagen), bei der Kasse den Kassenstand, bei Aufgaben und Umfragen die offenen, bei News, Dokumenten und Wissen die neuen, beim Spielplan die Spiele der Woche, bei Helfern die freien Plätze. Orange heißt: Hier wartet etwas auf dich. Kacheln ohne sinnvolle Zahl haben keine Kennzahl.',
      },
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
          'Öffne den Termin (Home, Termine oder Team) und tippe auf Zusagen, Unsicher oder Absagen. Bei „Absagen“ kannst du einen Grund wählen oder schreiben – das ist freiwillig; bei „Unsicher“ bitten wir um eine kurze Begründung. Den Grund sehen nur das Trainerteam und du selbst.',
      },
      {
        id: 'responses-overview',
        question: 'Wer sieht, wie viele zu- und abgesagt haben?',
        answer:
          'Im Spiel- und Trainingstermin zeigt ein bunter Balken mit der Zahl der Zusagen, Unsicheren, Absagen und offenen Antworten; auf der Startseite steht er auch unter dem nächsten Spiel. Das Trainerteam sieht ihn immer. Ob Spieler und Eltern Zahlen und Namen sehen, stellt das Trainerteam unter „Mannschaft bearbeiten“ ein; ist es aus, siehst du nur deine eigene Antwort und die deiner Kinder. Tippe auf den Balken (oder „Kader ›“), um die vollständige Kaderliste als Fenster zu öffnen: Zusagen, Unsicher, Offen, Absagen und ganz unten Abwesend (längere Ausfälle). Gründe und das Ende einer Abwesenheit sieht nur das Trainerteam.',
      },
      {
        id: 'helpers-strip',
        question: 'Wo finde ich offene Helferdienste?',
        answer:
          'Im Reiter „Verein“ zwischen Newsticker und Sponsoren steht „Helfer gesucht“: Wische durch die Karten, tippe eine an und trage dich in der Helfer-Ansicht in eine Schicht ein. Gibt es keine offenen Schichten, fehlt der Abschnitt.',
      },
      {
        id: 'archive',
        question: 'Wo finde ich gelöschte Einträge?',
        answer:
          'Gelöschte Wissensartikel, Übungen, Aufgaben, Sponsoren, Dokumente und ausgemustertes Material landen im Archiv; bei Dokumenten bleibt die Datei erhalten, bis das Archiv bereinigt wird. Das Trainerteam öffnet das Archiv seiner Mannschaft unter „Team → Archiv“ (gelöschte Aufgaben und Dokumente, wiederherstellen). Die Administration öffnet das ganze Archiv unter „Verwaltung → Abo & Kontrolle → Archiv“: Dort stellst du einen Eintrag mit „Wiederherstellen“ wieder her. Ist sein Name inzwischen vergeben, fragt dich die App nach einem neuen Namen. Endgültig gelöscht wird nie automatisch: „Bereinigen“ entfernt, was älter als die Standardfrist ist (derzeit 2 Jahre), „Archiv leeren“ löscht alles; beides nur auf deinen Anstoß und mit Bestätigung. „Archiv exportieren“ speichert alle archivierten Einträge als Datei.',
      },
      {
        id: 'edit-content',
        question: 'Kann ich etwas nachträglich ändern, das ich angelegt habe?',
        answer:
          'Ja. Was du angelegt hast, lässt sich später bearbeiten – über „Bearbeiten“ im „…“-Menü oder den Knopf im Detail: Umfragen (Frage, Beschreibung und Frist; die Antworten nur, solange noch niemand abgestimmt hat), Veranstaltungen mit Helferschichten, Abwesenheiten und Dokumente (Titel, Art und Sichtbarkeit – die Datei bleibt, zum Austauschen löschst du sie und lädst neu hoch), außerdem Forum-Themen und eigene Antworten, Kommentare (auch löschen), Übungen, Aushänge im Fundbüro und Marktplatz, Spielerbedarf und Angebote der Spielerbörse (die Anzahl nicht unter die schon eingetragenen Spieler) Platzsperrungen, Beitragsarten und Rücklagen der Vereinskasse (ein geänderter Betrag einer Beitragsart gilt für künftige Beiträge), Ausrüstung (Bezeichnung, Anzahl, Lagerort, Zustand) und deine Schiedsrichter-Einsätze. Das Formular ist dasselbe wie beim Anlegen, nur vorausgefüllt. Geänderte Inhalte tragen den Vermerk „bearbeitet“ mit der Zeit. Wichtige Änderungen wie Zeit, Ort oder Frist melden wir den Beteiligten. Kassenbuchungen werden nicht geändert: Fehler korrigierst du mit Stornieren und neu Buchen – so bleibt alles nachvollziehbar.',
      },
      {
        id: 'deadline',
        question: 'Was ist die Absagefrist?',
        answer:
          'Jede Mannschaft legt fest, bis wann Zu- und Absagen möglich sind. Der Countdown steht am Termin („Frist: Noch 2 Tage“). Danach bleibt deine Antwort sichtbar (Schloss „Frist abgelaufen“), ändern kann sie nur dein Trainerteam.',
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
      {
        id: 'about',
        question: 'Wo finde ich AGB, Datenschutz, Impressum und Support?',
        answer:
          'Unter „Mehr → Über Clubroof“: AGB, Datenschutzerklärung, Privatsphäre-Einstellungen, Impressum, Neuigkeiten (Changelog) sowie Links zu Support und „Funktion anfragen“ auf der Webseite.',
        link: { label: 'Privatsphäre-Einstellungen', href: '/about/privacy' },
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
        id: 'team-wizard',
        question: 'Wie lege ich eine neue Mannschaft an?',
        answer:
          'In der Verwaltung unter „Mannschaften & Saison“ führt dich der Assistent: im Schnellstart (ca. 5 Minuten, Empfehlungen vorausgewählt) oder ausführlich (ca. 15 Minuten, jeder Schritt erklärt). Du legst Name, Abteilung, Altersklasse, Spielform und Liga fest, wählst „Automatisch zugesagt“ (empfohlen) oder „Aktive Zu-/Absage“ mit Fristen (Training 24 Std., Spiele 48 Std. vorbelegt), planst wöchentliche Trainings mit Zeitraum und Platz, wählst Trainerteam und Kader und stellst Funktionen, Sichtbarkeit und einen Willkommenstext ein. In der Zusammenfassung springst du mit „Ändern“ in jeden Schritt. Erst dort wird die Mannschaft angelegt – danach bekommst du einen fertigen Einladungstext zum Weiterschicken.',
        link: { label: 'Mannschaft anlegen', href: '/admin/team-new' },
      },
      {
        id: 'coach-matches',
        question: 'Wo sehe ich auf einen Blick, wer zum nächsten Spiel kann?',
        answer:
          'Im Team-Tab unter „Nächste Spiele“: Wische durch die nächsten drei Spiele. Jede Karte zeigt den Balken mit zugesagt, unsicher, abgesagt, offen und abwesend. Tippe auf eine Karte, um die Rückmeldungen im Einzelnen zu sehen.',
        link: { label: 'Team', href: '/team' },
      },
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
        id: 'coach-roster-import',
        question: 'Wie importiere ich den Kader meiner Mannschaft aus einer Datei?',
        answer:
          'Unter „Verwaltung → Importieren“ den Bereich „Kader einer Mannschaft“ und deine Mannschaft wählen, Excel- oder CSV-Datei hochladen, Spalten zuordnen und die Vorschau prüfen. Vorhandene Mitglieder erkennt Clubroof an Nummer, E-Mail oder Name mit Geburtsdatum und nimmt sie in den Kader auf; neue Mitglieder legt nur die Mitgliederverwaltung an. Rückennummern werden auf Doppelte geprüft. Innerhalb von 24 Stunden kannst du den Import rückgängig machen.',
      },
      {
        id: 'coach-events-import',
        question: 'Kann ich Trainings und Spiele aus einer Datei anlegen?',
        answer:
          'Ja: „Verwaltung → Importieren → Termine einer Mannschaft“, Mannschaft wählen und eine Excel- oder CSV-Datei mit Datum, Beginn, Art, Gegner und Platz hochladen. Die Vorschau zeigt Dubletten, belegte Plätze und Termine in der Vergangenheit. Termine werden still angelegt, die Mannschaft bekommt keine Meldung. Den DFBnet-Spielplan importierst du weiter unter „Spielplan-Import“. Innerhalb von 24 Stunden kannst du den Import rückgängig machen.',
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
          'Im Spieltermin: „Aufstellung erstellen“. Der Planer zeigt ein Spielfeld: Wähle oben 7er, 9er oder 11er und eine Formation, ziehe dann Spieler aus der Kaderleiste auf eine Position oder auf die Bank (oder tippe zuerst den Spieler und dann den Platz an). Ziehst du einen Spieler auf einen besetzten Platz, tauschen beide; zurück in die Kaderleiste nimmt ihn aus der Aufstellung. Die Punkte und Balken zeigen die Trainingsbeteiligung der letzten vier Wochen – nur das Trainerteam sieht sie. „Entwurf speichern“ ist nur für das Trainerteam sichtbar; „Veröffentlichen“ benachrichtigt die Nominierten. Ob Spieler und Eltern die veröffentlichte Aufstellung sehen, stellst du unter „Mannschaft bearbeiten“ ein. Nach dem Spiel trägst du Ergebnis, Tore, Vorlagen und Karten im Spielbericht ein – erst dann zählen sie in der Statistik.',
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
          'Unter „Team → Funktionen“ schaltest du z. B. Statistik, Kasse oder Aufgaben für deine Mannschaft ein und aus. Was der Verein oder Abteilung ausgeschaltet hat, bleibt gesperrt.',
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
        id: 'club-cash',
        question: 'Wie funktioniert die Vereinskasse?',
        answer:
          'Die Vereinskasse ist von den Mannschaftskassen getrennt und liegt unter „Verein → Vereinskasse“ (wenn das Modul aktiv ist). Der Kassenwart (Verein) legt Konten mit Anfangsbestand an, bucht Einnahmen und Ausgaben mit Kategorie, optionaler Kostenstelle, Belegnummer und Belegfoto und bucht um zwischen Konten. Buchungen werden nie gelöscht, sondern mit Begründung storniert. Die Kategorien gehören zu den vier steuerlichen Bereichen (ideell, Vermögensverwaltung, Zweckbetrieb, wirtschaftlicher Geschäftsbetrieb). Kassenprüfer lesen alles, buchen aber nicht. Wer außerdem einsehen darf (z. B. der Vorstand), stellt die Vereinsadministration unter „Einrichtung“ ein.',
        link: { label: 'Vereinskasse', href: '/club-cash' },
      },
      {
        id: 'club-funds',
        question: 'Wie funktionieren Kassen und Abteilungen?',
        answer:
          'Der Verein kann mehrere Kassen führen, z. B. eine Jugendkasse. Unter „Admin-Verwaltung → Verein → Abteilungen“ legst du Abteilungen an (z. B. Senioren, Frauen, Jugend); danach fragt die App, ob die Abteilung eine eigene Kasse bekommen soll. Unter „Kassen“ legst du Kassen an, ordnest sie einer oder mehreren Abteilungen zu und bestimmst genau eine Hauptkasse. Ohne eigene Kasse laufen die Buchungen einer Abteilung über die Hauptkasse. Jede Kasse hat eigene Konten und Beiträge; in der Vereinskasse wechselst du oben zwischen „Alle“ und einer einzelnen Kasse. Kassen werden nie gelöscht, nur stillgelegt. Eine Umbuchung zwischen Konten verschiedener Kassen wird in beiden Kassen gebucht, ein Storno wirkt in beiden. Die Rolle Kassenwart (Verein) kann für den ganzen Verein oder nur für eine Abteilung vergeben werden und gilt dann nur für deren Kassen.',
        link: { label: 'Kassen', href: '/club-cash/funds' },
      },
      {
        id: 'club-budget',
        question: 'Wie funktionieren Haushaltsplan, Rücklagen und Jahresabschluss?',
        answer:
          'In der Vereinskasse unter „Planung“. Im Haushaltsplan legst du je Kasse und Jahr Planbeträge je Kategorie fest; „Soll-Ist“ zeigt mit Fortschrittsbalken, wie viel davon gebucht ist – ab 90 % wird gewarnt, über 100 % ist die Zeile rot. „Plan aus dem Vorjahr übernehmen“ spart Tipparbeit. Rücklagen sind zweckgebundene Töpfe innerhalb einer Kasse: Du kannst nur den freien Kassenbestand binden. Der Jahresabschluss zeigt die Einnahmen-Ausgaben-Rechnung nach den vier Bereichen mit Vorjahr, die Bestände und die Rücklagen; du kannst ihn als PDF oder CSV (für Excel) öffnen. Nach Jahresende schließt der Kassenwart das Jahr ab: Danach sind Buchungen, Stornos, Plan und Rücklagen dieses Jahres gesperrt, und nur die Administration kann es mit Begründung wieder öffnen. Die App führt eine einfache Einnahmen-Ausgaben-Rechnung und ersetzt keine Steuerberatung.',
        link: { label: 'Haushaltsplan', href: '/club-cash/budget?mode=plan' },
      },
      {
        id: 'club-stats',
        question: 'Wo finde ich die Auswertungen der Vereinskasse?',
        answer:
          'In der Vereinskasse unter „Übersicht“ mit dem Knopf „Alle Auswertungen ›“ (auch über „Beitragsstatistik“ und „Plan gegen Ist“ in den Reitern Beiträge und Planung). Oben wählst du ein Thema (Überblick, Einnahmen & Ausgaben, Plan gegen Ist, Beiträge, Abteilungen) und einen Zeitraum (Monat, Quartal, Jahr, Saison); er gilt für alle Karten. Fahre oder tippe über ein Diagramm, dann stehen die genauen Werte in der Zeile darüber. „Als Tabelle“ zeigt dieselben Zahlen ohne Grafik. Jede Karte nennt die wichtigste Aussage in einem Satz.',
        link: { label: 'Auswertungen', href: '/club-cash/stats' },
      },
      {
        id: 'club-audit',
        question: 'Wie läuft die Kassenprüfung?',
        answer:
          'Kassenprüfer beginnen unter „Vereinskasse → Prüfung → Kassenprüfung“ eine Prüfung für ein Jahr – für den ganzen Verein oder nur für ihre Kasse. Die App zieht auf Wunsch zufällige Stichproben; jede Buchung wird abgehakt oder mit Begründung beanstandet, den Beleg siehst du direkt. Dazu kommen freie Vermerke. Sind alle Stichproben erledigt, gibst du den Prüfbericht mit deinem Ergebnis ab; danach ist er nicht mehr änderbar und dient als Grundlage der Entlastung. Die Kassenführung sieht abgegebene Berichte (auch als PDF oder CSV). Prüfer buchen nicht, der Kassenwart prüft nicht.',
        link: { label: 'Kassenprüfung', href: '/club-cash/audit' },
      },
      {
        id: 'club-donations',
        question: 'Wie erstelle ich eine Zuwendungsbestätigung (Spendenquittung)?',
        answer:
          'Unter „Vereinskasse → Prüfung → Spenden“ erfasst der Kassenwart die Spende mit Name, Anschrift, Betrag und Datum; sie steht als Einnahme im Kassenbuch. Eine Zuwendungsbestätigung gibt es erst, wenn die Administration unter „Steuerdaten“ Finanzamt, Steuernummer, Bescheid, Zeitraum und Zweck eingetragen und die Vorlage freigegeben hat – nachdem sie von deiner Steuerberatung oder deinem Verband rechtlich geprüft wurde. Jede Änderung der Steuerdaten setzt die Freigabe zurück. Danach stellst du die Bestätigung mit einem Tipp aus (laufende Nummer, Betrag auch in Buchstaben) und öffnest sie als PDF. Eine Spende mit ausgestellter Bestätigung kann nicht storniert werden. Die App ersetzt keine Steuerberatung.',
        link: { label: 'Spenden', href: '/club-cash/donations' },
      },
      {
        id: 'club-claims',
        question: 'Wie funktionieren Auslagen und Fahrtkosten?',
        answer:
          'Jedes Mitglied reicht unter „Verein → Auslage einreichen“ Kosten mit Beleg (Foto) oder Fahrtkosten ein – bei Fahrtkosten rechnet die App aus den Kilometern (30 Cent je km). Der Kassenwart sieht die Auslagen unter „Vereinskasse → Buchung → Auslagen“, genehmigt oder lehnt mit Begründung ab und erstattet: Dabei entsteht eine Ausgabe im Kassenbuch. Du bekommst zu jedem Schritt eine Benachrichtigung. Eine erstattete Auslage kann nicht storniert werden.',
        link: { label: 'Auslagen', href: '/club-cash/claims' },
      },
      {
        id: 'club-allowances',
        question: 'Was ist mit Übungsleiter- und Ehrenamtspauschale?',
        answer:
          'Unter „Vereinskasse → Buchung → Pauschalen“ siehst du je Person und Jahr, wie viel von der Übungsleiterpauschale bzw. der Ehrenamtspauschale schon ausgezahlt ist (Fortschrittsbalken, Warnung bei fast ausgeschöpft). Eine Auszahlung, die den Freibetrag überschreiten würde, bucht die App nicht stillschweigend: Du bekommst eine Rückfrage und kannst sie nach steuerlicher Klärung bewusst trotzdem buchen. Die Freibeträge (ab 2026: 3.300 € bzw. 960 €) bitte steuerlich prüfen lassen; die App ersetzt keine Steuerberatung.',
        link: { label: 'Pauschalen', href: '/club-cash/allowances' },
      },
      {
        id: 'club-grants',
        question: 'Wie verwalte ich Zuschüsse, Sponsoren, Mannschaftszuschüsse und Inventar?',
        answer:
          'Zuschüsse: Unter „Vereinskasse → Buchung → Zuschüsse“ legst du Förderungen mit Geber, Betrag und Frist für den Verwendungsnachweis an und führst sie von „Geplant“ über „Beantragt“ und „Bewilligt“ bis zum Eingang (Buchung als Einnahme); überfällige Nachweise sind rot. Sponsoren: Beim Buchen einer Einnahme wählst du den Sponsor; unter „Sponsoren“ siehst du die Einnahmen je Sponsor und Jahr. Mannschaftszuschuss: Ausgabe der Vereinskasse und Einnahme der Mannschaftskasse in einem Schritt. Inventar: Unter „Planung → Inventar“ erfasst du Anschaffungen mit Wert und Standort; Gegenstände werden mit Grund ausgesondert, nicht gelöscht.',
        link: { label: 'Zuschüsse', href: '/club-cash/grants' },
      },
      {
        id: 'club-fees',
        question: 'Wie verwalte ich die Mitgliedsbeiträge?',
        answer:
          'In der Vereinskasse unter „Mitgliedsbeiträge“. Lege zuerst unter „Beitragsarten & Mitglieder“ die Beitragsarten (Betrag und Rhythmus) an und ordne sie den Mitgliedern zu. Mit „Sollstellung erzeugen“ entstehen die fälligen Forderungen (nie doppelt). Zahlungen buchst du an der Forderung oder per Kontoauszug-Import (CSV): die App ordnet Eingänge per Mitgliedsnummer oder Name zu, wenn der Betrag genau passt, und zeigt alles vor dem Buchen. Bei Rückständen erinnerst du in drei Stufen selbst (Erinnerung, Mahnung, letzte Mahnung); das Mitglied bzw. die Eltern bekommen eine Benachrichtigung.',
        link: { label: 'Mitgliedsbeiträge', href: '/club-cash/fees' },
      },
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
          'Einzeln unter „Mitglieder → Mitglied anlegen“ oder per Import aus Excel oder CSV („Importieren“): Bereich wählen, Vorlage laden, Datei hochladen, Spalten zuordnen, Vorschau prüfen (neu, aktualisiert, Dublette, Fehler), bei Dubletten überspringen, aktualisieren oder neu anlegen. Der Import wird ganz oder gar nicht übernommen und lässt sich 24 Stunden lang rückgängig machen. Austritte beenden Mannschaftszugehörigkeiten und sperren den App-Zugang. In der Mitgliederliste filterst du nach Rolle, Trainerteam, individuellen Rechten oder fehlendem App-Zugang.',
      },
      {
        id: 'admin-import-areas',
        question: 'Was lässt sich außer Mitgliedern importieren?',
        answer:
          'Unter „Verwaltung → Importieren“ auch Sponsoren, Plätze und Räume (mit Spielstätte) sowie Material und Schlüssel – jeweils mit Vorlage, Spaltenzuordnung, Vorschau und Rückgängig innerhalb von 24 Stunden. Trainer importieren Kader und Termine ihrer Mannschaft.',
      },
      {
        id: 'admin-permissions',
        question: 'Wie vergebe ich einzelne Rechte an ein Mitglied?',
        answer:
          'Im Mitglied unter „Rollen & Aufgaben → Individuelle Rechte“: Liste aller Rechte zum An- und Abwählen. Sie gelten zusätzlich zu den Rollen für den ganzen Verein, jede Änderung steht im Änderungsprotokoll. Ein Recht für nur eine Mannschaft vergibst du besser über eine Rolle mit Geltungsbereich.',
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
