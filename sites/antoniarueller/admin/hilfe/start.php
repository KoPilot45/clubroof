<?php
declare(strict_types=1);
defined('AR_ROOT') || exit;

// Hilfe: Kapitel 1–3 (Schnellstart, Grundlagen, Hero & Abschnitte)
return [
    [
        'id' => 'schnellstart', 'title' => 'Schnellstart', 'icon' => 'home',
        'intro' => 'In zehn Minuten die Verwaltung verstehen: anmelden, Aufbau, Entwurf und Veröffentlichen.',
        'articles' => [
            [
                'id' => 'anmelden', 'title' => 'Anmelden', 'shot' => 'login', 'alt' => 'Anmeldeseite der Verwaltung mit E-Mail-Feld und Knopf „Code senden“',
                'lead' => 'Du brauchst kein Passwort: Die Verwaltung schickt dir bei jeder Anmeldung einen Code per E-Mail.',
                'legend' => ['Deine E-Mail-Adresse (die, die die Inhaberin eingetragen hat)', '„Code senden“ schickt dir den Code'],
                'steps' => [
                    'Öffne die Adresse der Verwaltung (Seitenadresse + **/admin/**) und trage deine **E-Mail-Adresse** ein.',
                    'Klicke auf **Code senden**. Nach wenigen Sekunden kommt eine E-Mail mit einem achtstelligen Code (zweimal vier Ziffern). Schau auch im Spam-Ordner nach.',
                    'Gib den Code ein und bestätige mit **Anmelden**. Der Code gilt nur kurz und nur einmal.',
                    'Hast du in „Mein Konto“ zusätzlich ein Passwort gesetzt, fragt die Anmeldung auch danach. Mit „Passwort vergessen?“ bekommst du einen Link zum Zurücksetzen.',
                ],
                'tips' => ['Auf dem eigenen Rechner bleibst du angemeldet. Auf fremden Geräten meldest du dich mit **Abmelden** (oben rechts) wieder ab.'],
                'warn' => ['Nach fünf falschen Eingaben sperrt die Anmeldung für kurze Zeit. Warte dann einfach ein paar Minuten.'],
            ],
            [
                'id' => 'aufbau', 'title' => 'So ist die Verwaltung aufgebaut', 'shot' => 'uebersicht', 'alt' => 'Startseite der Verwaltung mit Menü links, Suche oben und Karte der Website',
                'lead' => 'Das Menü links ist so geordnet wie die Webseite von oben nach unten. Wer die Seite kennt, findet alles sofort.',
                'legend' => ['Hauptmenü: ein Punkt je Abschnitt der Seite', 'Suche (auch mit [[Strg]]+[[K]]): findet Menüpunkte, Einträge und Hilfe', '„Deine Website“: alle Abschnitte mit Anzahl der Einträge und Link in die Vorschau', '„Startklar?“: was vor dem Livegang noch fehlt'],
                'steps' => [
                    'Links stehen die Hauptpunkte: **Hero-Bereich**, **Arbeiten**, **Podcast**, **Über mich**, **Lebenslauf**, **Off the record**, **Kontakt**, **Seite & Design**, **Englisch**, **Mediathek**, **Suche & Recht**, **Auswertung**, **Hilfe** und **System**.',
                    'Ein Klick klappt den Punkt auf und zeigt die Unterpunkte. Eine kleine Zahl dahinter zeigt offene **Entwürfe**.',
                    'Die Übersicht zeigt „Deine Website“ mit allen Abschnitten und die Liste **Startklar?** mit Aufgaben, die vor dem Livegang noch offen sind.',
                    'Oben findest du **Seite ansehen** (öffnet die echte Seite), das **?** (Hilfe zur aktuellen Seite) und **Abmelden**.',
                ],
                'tips' => ['Auf dem Handy öffnet das Symbol mit den drei Strichen oben links das Menü.'],
            ],
            [
                'id' => 'entwurf', 'title' => 'Entwurf, Veröffentlichen und Vorschau', 'shot' => 'speicherleiste', 'alt' => 'Speicher-Leiste am unteren Rand eines Formulars',
                'lead' => 'Nichts geht aus Versehen live: Erst „Veröffentlichen“ macht eine Änderung für alle Besucher sichtbar.',
                'legend' => ['**Veröffentlichen**: sofort für alle sichtbar', '**Als Entwurf speichern**: nur für dich, die Seite bleibt unverändert', 'Status: wann zuletzt automatisch gesichert wurde', '**Live**: Vorschau der Seite direkt neben dem Formular', '**Vorschau**: öffnet die Seite mit allen Entwürfen in einem neuen Tab', '**English**: dieselbe Vorschau auf Englisch', '**Abbrechen** verlässt das Formular, **?** erklärt Tastenkürzel'],
                'steps' => [
                    'Ändere, was du ändern möchtest. Beim Tippen sichert die Verwaltung alles **automatisch als Entwurf** (der Status unten zeigt „Entwurf gesichert um …“).',
                    'Prüfe das Ergebnis mit **Live** (neben dem Formular) oder **Vorschau** (eigener Tab). Beides zeigt die Seite so, wie sie nach dem Veröffentlichen aussehen würde.',
                    'Wenn alles stimmt: **Veröffentlichen**. Jetzt sehen es alle Besucher.',
                    'Hast du etwas verworfen? Oben im Formular steht bei offenen Entwürfen ein gelber Hinweis mit **Jetzt veröffentlichen** und **Verwerfen**.',
                ],
                'after' => 'Besucher sehen immer nur den zuletzt veröffentlichten Stand – nie einen Entwurf.',
                'tips' => ['Tastenkürzel: [[Strg]]+[[S]] speichert als Entwurf, [[Strg]]+[[Enter]] veröffentlicht.', 'Der Schieberegler in Listen und der Stern bei Referenzen wirken **sofort** und brauchen kein Veröffentlichen.'],
            ],
            [
                'id' => 'suche', 'title' => 'Suchen und Tastenkürzel', 'shot' => 'suche', 'alt' => 'Suchfenster der Verwaltung mit Treffern',
                'lead' => 'Die Suche springt zu jeder Stelle der Verwaltung: Menüpunkte, Referenzen, Folgen und diese Hilfe.',
                'legend' => ['Suchfeld (öffnet mit [[Strg]]+[[K]], auf dem Mac [[Cmd]]+[[K]])', 'Treffer: mit den Pfeiltasten wählen, mit [[Enter]] öffnen'],
                'steps' => ['Drücke [[Strg]]+[[K]] oder klicke oben auf **Suchen**.', 'Tippe ein Wort, zum Beispiel einen Titel oder „Mediathek“.', 'Wähle einen Treffer mit den Pfeiltasten und drücke [[Enter]]. Mit [[Esc]] schließt du das Fenster.'],
                'terms' => ['Strg + K' => 'Suche öffnen', 'Strg + S' => 'Als Entwurf speichern', 'Strg + Enter' => 'Veröffentlichen', 'Esc' => 'Fenster oder Menü schließen'],
            ],
        ],
    ],
    [
        'id' => 'grundlagen', 'title' => 'Grundlagen', 'icon' => 'check',
        'intro' => 'Listen, Papierkorb, frühere Fassungen, Hervorhebungen und Bilder: Das gilt überall.',
        'articles' => [
            [
                'id' => 'listen', 'title' => 'Listen: ausblenden, sortieren, bearbeiten', 'shot' => 'liste-referenzen', 'alt' => 'Liste der Referenzen mit Schieberegler, Stern und Bearbeiten-Knopf',
                'lead' => 'Alle Sammlungen (Referenzen, Folgen, Stationen …) funktionieren gleich.',
                'legend' => ['**Hinzufügen** legt einen neuen Eintrag an', 'Der **Stern** hebt eine Referenz als Featured hervor (nur bei Referenzen)', 'Der **Schieberegler** blendet den Eintrag auf der Seite ein oder aus', '**Bearbeiten** öffnet das Formular', 'Am **Griff** ziehen ändert die Reihenfolge'],
                'steps' => [
                    'Einen Eintrag **ausblenden**: Schieberegler ausschalten. Er bleibt erhalten und lässt sich jederzeit wieder einschalten. Das wirkt sofort.',
                    'Die **Reihenfolge ändern**: Die Zeile am Griff packen und ziehen. Ohne Maus: Menü **⋯** → „Nach oben“ oder „Nach unten“.',
                    'Mehrere Einträge auf einmal: Kästchen links ankreuzen, dann erscheint oben eine Leiste mit „Einblenden“, „Ausblenden“ und „In den Papierkorb“.',
                    'Bei mehr als sechs Einträgen hilft das Suchfeld, mit den Filtern „Entwürfe“ und „Ausgeblendet“ siehst du nur diese.',
                    'Über **⋯** kannst du einen Eintrag auch **duplizieren** oder in den **Papierkorb** verschieben.',
                ],
                'tips' => ['Bei Referenzen bestimmt die Reihenfolge die Nummerierung („01, 02 …“) und die Anordnung im Schnittplatz.'],
            ],
            [
                'id' => 'papierkorb', 'title' => 'Papierkorb und Rückgängig', 'shot' => 'papierkorb', 'alt' => 'Papierkorb mit entfernten Einträgen',
                'lead' => 'Nichts wird sofort endgültig gelöscht: Entfernte Einträge landen im Papierkorb.',
                'legend' => ['Entfernte Einträge mit Zeitpunkt', 'Wiederherstellen oder endgültig löschen'],
                'steps' => [
                    'Nach dem Entfernen erscheint unten kurz ein Hinweis mit **Rückgängig**.',
                    'Später findest du den Eintrag unter **System → Papierkorb**. Dort kannst du ihn **wiederherstellen** oder **endgültig löschen**.',
                    '„Papierkorb leeren“ löscht alles darin endgültig.',
                ],
                'warn' => ['Endgültig gelöschte Einträge lassen sich nur noch aus einer Sicherung zurückholen (Kapitel „System“).'],
                'open' => ['Papierkorb öffnen', 'p=trash'],
            ],
            [
                'id' => 'fassungen', 'title' => 'Frühere Fassungen', 'lead' => 'Jedes Veröffentlichen wird gesichert. So kannst du zu einem älteren Stand zurück.',
                'steps' => [
                    'Öffne den Eintrag oder Bereich und scrolle ganz nach unten zu **Frühere Fassungen**.',
                    'Klappe die Liste auf. Dort stehen Datum, Uhrzeit und wer gespeichert hat.',
                    'Klicke bei der gewünschten Fassung auf **Als Entwurf laden**. Der veröffentlichte Stand bleibt unverändert.',
                    'Prüfe den Entwurf in der Vorschau und veröffentliche ihn, wenn er passt.',
                ],
                'tips' => ['Es werden bis zu 25 Fassungen pro Eintrag aufbewahrt.'],
            ],
            [
                'id' => 'hervorheben', 'title' => 'Texte hervorheben', 'lead' => 'Große Überschriften und einige Texte können einzelne Wörter kursiv, in Großschrift oder in der Akzentfarbe zeigen.',
                'steps' => [
                    'Markiere das Wort im Feld und klicke über dem Feld auf **Kursiv**, **GROSS** oder **Akzent**. Die Vorschau darunter zeigt, wie es wirkt.',
                    'Von Hand geht es auch: Setze das Wort in die Zeichen aus der Tabelle unten.',
                ],
                'terms' => ['*Wort*' => 'kursiv (Serifenschrift)', '**Wort**' => 'GROSSSCHRIFT', '==Wort==' => 'in der Akzentfarbe'],
            ],
            [
                'id' => 'bilder', 'title' => 'Bilder hochladen und entfernen', 'shot' => 'bild-feld', 'alt' => 'Bildfeld mit Vorschau, rotem Kreuz und Fokuspunkt',
                'lead' => 'Ein gewähltes Bild wird sofort hochgeladen, optimiert und als Vorschau gezeigt.',
                'legend' => ['Das **rote X** entfernt das Bild (mit Rückfrage)', 'Der **Fokuspunkt**: Klick ins Bild, dort bleibt der Ausschnitt sichtbar', '**Datei wählen**: vom Computer hochladen', '**Aus Mediathek wählen**: schon hochgeladenes Bild nutzen'],
                'steps' => [
                    'Klicke auf **Datei wählen** (oder wähle ein Bild **Aus Mediathek**). JPG, PNG, WebP und AVIF gehen. Die Vorschau erscheint sofort.',
                    'Das Bild wird automatisch als **WebP** gespeichert und auf höchstens 1600 Pixel verkleinert, damit die Seite schnell bleibt. Der **Dateiname bleibt erhalten**.',
                    'Klicke im Bild auf die **wichtige Stelle** (z. B. das Gesicht): Wird das Bild zugeschnitten, bleibt dieser Teil sichtbar.',
                    'Zum Entfernen auf das **rote X** klicken und „Ja, entfernen“ bestätigen. Die Datei bleibt in der Mediathek.',
                ],
                'after' => 'Ein neues oder entferntes Bild erscheint erst nach **Veröffentlichen** auf der Seite.',
                'tips' => ['Bei Fotos immer die **Bildbeschreibung (Alt-Text)** ausfüllen: Sie hilft Menschen mit Screenreader und der Suche.'],
            ],
        ],
    ],
    [
        'id' => 'hero', 'title' => 'Hero-Bereich & Abschnitte', 'icon' => 'palette',
        'intro' => 'Das Erste auf der Seite, Leitfragen, Menü, Farben und das Ein- und Ausblenden ganzer Abschnitte.',
        'articles' => [
            [
                'id' => 'hero-bereich', 'title' => 'Hero-Bereich: Name, Einleitung und Foto', 'shot' => 'hero', 'alt' => 'Formular des Hero-Bereichs',
                'lead' => 'Der „Hero“ ist der große Auftakt der Seite: Name, ein Satz zu dir, Foto.',
                'legend' => ['Vor- und Nachname (erscheinen groß)', 'Einleitung: der erste Satz unter dem Namen', '„Aktuell“: eine Zeile pro Eintrag', 'Foto, am besten freigestellt', 'Alt-Text (Pflicht)'],
                'steps' => [
                    'Öffne **Hero-Bereich → Startbild & Einleitung**.',
                    'Trage **Vorname** und **Nachname** ein, schreibe die **Einleitung** (kurz!) und die Zeile **oben** (z. B. „Journalistin · Bremen“).',
                    'Unter **Aktuell** steht pro Zeile ein Eintrag, zum Beispiel wo gerade gearbeitet wird.',
                    'Lade das **Foto** hoch und beschreibe es im Feld **Bildbeschreibung**.',
                    '**Veröffentlichen**.',
                ],
                'open' => ['Hero-Bereich öffnen', 'p=group&g=hero'],
            ],
            [
                'id' => 'leitfragen', 'title' => 'Leitfragen („Was mich antreibt“)', 'lead' => 'Die kurzen, nummerierten Fragen direkt unter dem Auftakt.',
                'steps' => [
                    'Öffne **Hero-Bereich → Leitfragen**. Jede Frage ist ein Eintrag mit Nummer und Text.',
                    'Mit **Hinzufügen** legst du eine neue Frage an, die Reihenfolge änderst du per Ziehen.',
                    'Im Text kannst du Wörter **hervorheben** (kursiv, GROSS, Akzent).',
                    'Die Überschrift des Abschnitts und der Text rechts daneben stehen unter **Hero-Bereich → Abschnittstexte**.',
                ],
                'open' => ['Leitfragen öffnen', 'p=list&c=questions'],
            ],
            [
                'id' => 'abschnitte', 'title' => 'Abschnittstexte: Abschnitte ein- und ausblenden, Texte ändern', 'shot' => 'abschnitte', 'alt' => 'Abschnittstexte mit Schiebereglern und Textfeldern',
                'lead' => 'Zu jedem Menüpunkt gehört als erster Punkt „Abschnittstexte“: Dort hat jeder Abschnitt eine eigene Karte mit Schieberegler zum Ein- und Ausblenden und allen seinen Texten.',
                'legend' => ['Schieberegler: Abschnitt auf der Seite zeigen oder ausblenden', '„Inhalte bearbeiten“ springt zu den Einträgen des Abschnitts', 'Texte: Abschnittsname, Überschrift, Beschriftungen'],
                'steps' => [
                    'Öffne bei **Hero-Bereich**, **Arbeiten**, **Über mich** oder **Kontakt** den ersten Punkt **Abschnittstexte**. Hero-Bereich: Intro und Leitfragen. Arbeiten: Showreel und Podcast. Über mich: Über mich, Lebenslauf und Off the record. Kontakt: Kontakt und Fußzeile.',
                    'Schalte den **Schieberegler** eines Abschnitts aus, damit er auf der Seite verschwindet. Sein Menüpunkt verschwindet automatisch mit. Die Inhalte bleiben gespeichert.',
                    'Darunter änderst du die Texte: **Abschnittsname** (in der „REC“-Zeile), **Überschrift** in zwei Teilen, **Zeile rechts** und kleinere Beschriftungen wie „Anhören bei“.',
                    '**Veröffentlichen**.',
                ],
                'tips' => ['Der Startbereich ist immer sichtbar. Die Fußzeile mit Impressum und Datenschutz bleibt auch bei ausgeschaltetem Kontaktbereich bestehen.', 'Das **Featured** hängt nicht am Schieberegler „Showreel“, sondern am Stern bei den Referenzen.'],
                'open' => ['Abschnittstexte (Arbeiten) öffnen', 'p=group&g=texts_arbeiten'],
            ],
            [
                'id' => 'menue', 'title' => 'Das Menü der Webseite', 'lead' => 'Die Menüpunkte oben (Desktop) und im Handy-Menü.',
                'steps' => [
                    'Öffne **Seite & Design → Menü der Webseite**.',
                    'Jeder Menüpunkt hat eine **Beschriftung** und ein Ziel („Springt zu“: Arbeiten, Podcast, Lebenslauf, Über mich, Off the record oder Kontakt).',
                    'Mit dem Haken **Auch in der Kopfzeile am Desktop zeigen** erscheint er auch oben am großen Bildschirm, sonst nur im Handy-Menü.',
                    'Die Reihenfolge änderst du per Ziehen.',
                ],
                'tips' => ['Zeigt ein Menüpunkt auf einen ausgeschalteten Abschnitt, wird er automatisch ausgeblendet.'],
                'open' => ['Menü öffnen', 'p=list&c=nav'],
            ],
            [
                'id' => 'farben', 'title' => 'Farben und Kopfzeile', 'lead' => 'Die Akzentfarbe der Seite und der Text links oben.',
                'steps' => [
                    'Öffne **Seite & Design → Farben & Kopfzeile**.',
                    'Wähle die **Akzentfarbe** (Knöpfe, Zahlen) und das **Rec-Rot** (blinkender Punkt).',
                    'Ändere den **Text links oben** und den **Titel im Handy-Menü**.',
                    '**Veröffentlichen**.',
                ],
                'warn' => ['Wähle eine Akzentfarbe, die auf dem hellen Hintergrund gut lesbar bleibt (dunkel genug).'],
                'open' => ['Farben öffnen', 'p=group&g=site'],
            ],
        ],
    ],
];
