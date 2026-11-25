<?php
declare(strict_types=1);
defined('AR_ROOT') || exit;

// Hilfe: Kapitel 8–13 (Suche & Recht, Auswertung, System, Häufige Aufgaben, Probleme & Fragen, Glossar)
return [
    [
        'id' => 'recht', 'title' => 'Suche & Recht', 'icon' => 'search',
        'intro' => 'Google-Texte, Vorschau beim Teilen, Impressum, Datenschutz und der Livegang.',
        'articles' => [
            [
                'id' => 'seo', 'title' => 'SEO & Suche: so erscheint die Seite bei Google', 'shot' => 'seo', 'alt' => 'Formular „SEO & Suche“ mit Titel und Beschreibung',
                'lead' => 'Hier legst du fest, was Suchmaschinen und soziale Netzwerke von deiner Seite anzeigen.',
                'legend' => ['**noindex**: sperrt die Seite für Suchmaschinen (nur solange sie noch nicht fertig ist!)', '**Seitentitel**: ideal 40–60 Zeichen, Name und Beruf nach vorn', '**Beschreibung**: ideal 120–160 Zeichen, wer du bist und wofür'],
                'steps' => [
                    'Öffne **Suche & Recht → SEO & Suche**.',
                    'Schreibe **Titel** und **Beschreibung**. Der Zeichenzähler zeigt, ob sie in der idealen Länge liegen, die Google-Vorschau zeigt das Ergebnis.',
                    'Wähle das **Vorschaubild beim Teilen** (1200 × 630 Pixel). Leer = Foto aus dem Hero-Bereich.',
                    'Die Bereiche unter **erweitert** (Personendaten, robots.txt, llms.txt) brauchst du normalerweise nicht.',
                ],
                'warn' => ['Solange **noindex** an ist, kann Google die Seite nicht aufnehmen. Schalte es erst zum Livegang aus.'],
                'open' => ['SEO öffnen', 'p=group&g=seo'],
            ],
            [
                'id' => 'impressum', 'title' => 'Impressum und Datenschutz', 'shot' => 'recht', 'alt' => 'Editor für Impressum und Datenschutz mit Werkzeugleiste',
                'lead' => 'Beide Texte bearbeitest du in einem kleinen Texteditor, auf Deutsch und Englisch.',
                'legend' => ['Werkzeugleiste: Überschrift, Fett, Liste und **Link**', 'Der Text: Angaben in [eckigen Klammern] ersetzen'],
                'steps' => [
                    'Öffne **Suche & Recht → Impressum & Datenschutz**.',
                    'Ersetze alle Angaben in **[eckigen Klammern]** durch deine echten Daten oder lösche sie. Die Startklar-Liste warnt, solange noch Platzhalter da sind.',
                    'Mit der **Werkzeugleiste** formatierst du: Überschrift, **fett**, Liste und **Link** (auf eine Webseite, eine E-Mail-Adresse oder eine Seite dieser Website).',
                    'Die englische Fassung pflegst du in der **Übersetzungstabelle**.',
                    '**E-Mail-Adressen** schreibst du einfach normal in den Text (oder als Link mit „Link → E-Mail-Adresse“). Die Seite schützt sie automatisch: Im Quelltext steht keine lesbare Adresse, im Browser ist sie klickbar, ohne JavaScript steht sie als „name (at) domain.de“ da.',
                ],
                'warn' => ['Das Impressum ist gesetzlich vorgeschrieben. Prüfe die Angaben vor dem Livegang sorgfältig (bei Unsicherheit mit einer Fachperson).'],
                'open' => ['Texte öffnen', 'p=group&g=legal'],
            ],
            [
                'id' => 'livegang', 'title' => 'Checkliste für den Livegang', 'lead' => 'Die Übersicht führt dich mit der Liste „Startklar?“ durch alles Nötige.',
                'steps' => [
                    'Öffne die **Übersicht** und arbeite die **Startklar?**-Liste von oben ab. Pflichtpunkte: E-Mail-Adresse, Impressum, Datenschutz, Hero-Foto mit Alt-Text, mindestens drei Referenzen mit Link oder eigenen Bildern.',
                    'Ersetze in allen Texten die **Platzhalter** in [eckigen Klammern] (die Übersicht zeigt, wo noch welche stehen).',
                    'Prüfe die englische Fassung (mindestens 80 % übersetzt) und den **Systemcheck**.',
                    'Schalte zum Schluss unter **SEO & Suche** den Haken **noindex** aus.',
                    'Mache eine **Sicherung** (System → Sicherung → Jetzt sichern).',
                ],
                'open' => ['Zur Übersicht', ''],
            ],
        ],
    ],
    [
        'id' => 'auswertung', 'title' => 'Auswertung (Statistik)', 'icon' => 'chart',
        'intro' => 'Besuche, Herkunft und Klicks, ohne Cookies und ohne IP-Adressen zu speichern.',
        'articles' => [
            [
                'id' => 'statistik', 'title' => 'Die Statistik lesen', 'shot' => 'statistik', 'alt' => 'Statistikseite mit Besuchen im Verlauf',
                'lead' => 'Die Statistik zeigt anonym, wie die Seite genutzt wird.',
                'legend' => ['Kennzahlen: Besuche, Aufrufe, Durchschnitt pro Tag', '„Besuche im Verlauf“: Balken pro Tag', '**CSV herunterladen** (neben der Wahl des Zeitraums)'],
                'steps' => [
                    'Öffne **Auswertung → Statistik** und wähle den Zeitraum.',
                    '**Besuche im Verlauf** und **Wann kommen Besucher?** zeigen, wie viele und wann.',
                    '**Woher kommen Besucher?** zeigt Suchmaschinen, soziale Netzwerke, Redaktionen und direkte Aufrufe.',
                    '**Was wird angeklickt?** zählt Klicks auf Referenzen, Mail-Knopf, Podcast-Links und Download. **Wie weit wird gescrollt?** zeigt die erreichten Abschnitte.',
                    '**Crawler & Vorschau-Abrufe** und **Nicht gefundene Adressen (404)** helfen bei der Fehlersuche.',
                    'Unter **Einstellungen & Daten** gibt es den **CSV-Export**, einen Schalter zum Ausschalten der Statistik und „Alle Statistikdaten löschen“.',
                ],
            ],
            [
                'id' => 'zaehlung', 'title' => 'Was wird gezählt und was nicht?', 'lead' => 'Warum die Zahl manchmal höher ist, als du erwartest.',
                'steps' => [
                    'Ein **Gerät** wird höchstens **einmal pro Stunde** als Besuch gezählt. „Gerät“ heißt dabei: dieselbe Kombination aus IP-Adresse und Browser. Der dafür nötige Kurzwert wird nach der Stunde gelöscht, die IP-Adresse wird nie gespeichert.',
                    'Wechselt deine IP-Adresse (Mobilfunk, WLAN, VPN) oder nutzt du mehrere Browser, zählst du mehrfach.',
                    'Deine **eigenen Aufrufe der öffentlichen Seite** zählen mit, nur die Vorschau im Backend zählt nicht.',
                    'Bekannte Suchmaschinen- und KI-Bots werden getrennt unter „Crawler“ gezeigt. Automatische Zugriffe, die sich wie ein normaler Browser melden (z. B. Sicherheits-Scanner bei neuen Adressen), lassen sich nicht sicher erkennen und können mitzählen.',
                    'Das „noindex“ ändert daran nichts: Es bittet nur Suchmaschinen, die Seite nicht aufzunehmen.',
                    'Wer in seinem Browser „Do Not Track“ eingeschaltet hat, wird nicht gezählt.',
                ],
                'tips' => ['Beurteile Zahlen vor dem Livegang vorsichtig. Auffällig viele Besuche nachts oder aus „Direkt / unbekannt“ sprechen für automatische Zugriffe.'],
            ],
        ],
    ],
    [
        'id' => 'system', 'title' => 'System', 'icon' => 'gear',
        'intro' => 'Zugänge, Sicherung, Konto, Geräte, Protokoll und Systemcheck.',
        'articles' => [
            [
                'id' => 'zugaenge', 'title' => 'Zugänge: wer sich anmelden darf', 'shot' => 'zugaenge', 'alt' => 'Liste der Zugänge mit Rollen',
                'lead' => 'Nur die **Inhaberin** verwaltet Zugänge.',
                'legend' => ['Person mit Rolle (Inhaber oder Bearbeiter) und letzter Anmeldung', 'Passwort-Status; je nach Person auch **Passwort zurücksetzen**, **Sperre aufheben** und **Entfernen**', '**Zugang hinzufügen**'],
                'steps' => [
                    'Öffne **System → Zugänge**.',
                    'Trage unter **Zugang hinzufügen** die E-Mail-Adresse und den Namen ein. **Bearbeiter** dürfen alle Inhalte ändern, aber keine Zugänge verwalten.',
                    'Die Person meldet sich ab sofort mit einem Code an ihre Adresse an.',
                    'Hat eine Person ihr Passwort vergessen, entfernst du es mit **Passwort zurücksetzen**: Danach meldet sie sich nur mit dem Code an. Mit **Sperre aufheben** hebst du eine Sperre nach Fehlversuchen auf, mit **Entfernen** nimmst du den Zugang.',
                ],
                'warn' => ['Die E-Mail-Adresse darf nicht auf der Domain dieser Webseite liegen (Postfach und Webseite bleiben getrennt).'],
                'open' => ['Zugänge öffnen', 'p=users'],
            ],
            [
                'id' => 'sicherung', 'title' => 'Sicherung und Wiederherstellung', 'shot' => 'sicherung', 'alt' => 'Sicherungsseite mit gespeicherten Sicherungen',
                'lead' => 'Eine Sicherung enthält alle Inhalte und Einstellungen. Bilder und PDFs liegen in der Mediathek und gehören nicht dazu.',
                'legend' => ['**Jetzt sichern**', 'Gespeicherte Sicherungen: herunterladen, wiederherstellen, löschen', '**Aus Datei wiederherstellen**'],
                'steps' => [
                    'Öffne **System → Sicherung** und klicke **Jetzt sichern**. Die Sicherung wird auf dem Server gespeichert.',
                    'Mit **Aktuellen Stand herunterladen** lädst du die Daten als Datei auf deinen Rechner (empfohlen vor großen Änderungen).',
                    '**Wiederherstellen** ersetzt alle jetzigen Inhalte durch die gewählte Sicherung. Vorher wird der aktuelle Stand automatisch gesichert.',
                    'Eine heruntergeladene Datei spielst du unter **Aus Datei wiederherstellen** zurück.',
                ],
                'warn' => ['Beim Wiederherstellen gehen Änderungen seit der Sicherung verloren. Lade vorher den aktuellen Stand herunter.'],
                'open' => ['Sicherung öffnen', 'p=backup'],
            ],
            [
                'id' => 'konto', 'title' => 'Mein Konto: Name und Passwort', 'lead' => 'Dein Name erscheint im Protokoll und bei „zuletzt geändert von“.',
                'steps' => [
                    'Öffne **System → Mein Konto**.',
                    'Ändere deinen **Namen**.',
                    'Optional: Setze ein **zusätzliches Passwort**. Dann brauchst du bei der Anmeldung Code **und** Passwort. Du kannst es jederzeit wieder entfernen.',
                ],
                'open' => ['Mein Konto öffnen', 'p=account'],
            ],
            [
                'id' => 'geraete', 'title' => 'Geräte & Anmeldungen', 'lead' => 'Zeigt, wo du angemeldet bist.',
                'steps' => [
                    'Öffne **System → Geräte**. Jede Zeile ist ein Browser oder Gerät mit Zeitpunkt der Anmeldung.',
                    'Ein unbekanntes Gerät? Mit **Abmelden** beendest du dort die Sitzung. **Alle anderen Geräte abmelden** lässt nur dein aktuelles Gerät angemeldet.',
                ],
                'open' => ['Geräte öffnen', 'p=sessions'],
            ],
            [
                'id' => 'protokoll', 'title' => 'Protokoll', 'lead' => 'Wer hat wann was geändert? (nur Inhaberin)',
                'steps' => ['Öffne **System → Protokoll**. Dort stehen Anmeldungen, Veröffentlichungen, Löschungen und weitere Änderungen mit Zeitpunkt und Person.', 'Das Protokoll hilft nachzuvollziehen, wann etwas passiert ist.'],
                'open' => ['Protokoll öffnen', 'p=log'],
            ],
            [
                'id' => 'systemcheck', 'title' => 'Systemcheck', 'shot' => 'systemcheck', 'alt' => 'Systemcheck mit Prüfungen',
                'lead' => 'Eine technische Prüfung, ob die Installation in Ordnung ist (nur Inhaberin).',
                'legend' => ['Prüfpunkte mit Ergebnis („OK“ oder „Prüfen“)', 'Der Sicherheits-Selbsttest prüft im Browser, dass interne Dateien nicht abrufbar sind'],
                'steps' => [
                    'Öffne **System → Systemcheck**.',
                    'Grün heißt in Ordnung. Bei Rot oder Gelb steht eine kurze Erklärung. Ein roter Sicherheitstest bei internen Ordnern sollte sofort geklärt werden.',
                ],
                'open' => ['Systemcheck öffnen', 'p=check'],
            ],
        ],
    ],
    [
        'id' => 'aufgaben', 'title' => 'Häufige Aufgaben', 'icon' => 'plus',
        'intro' => 'Kurze Rezepte: „Ich möchte …“.',
        'articles' => [
            ['id' => 'a-referenz', 'title' => 'Ich möchte eine neue Referenz veröffentlichen', 'steps' => ['**Arbeiten → Referenzen → Referenz hinzufügen**.', 'Titel, Kategorie, Datum, Redaktion, Beschreibung und Link ausfüllen.', '**Als Entwurf speichern**, mit **Vorschau** prüfen, **Veröffentlichen**.']],
            ['id' => 'a-ausblenden', 'title' => 'Ich möchte etwas vorübergehend ausblenden', 'steps' => ['In der Liste den **Schieberegler** der Zeile ausschalten. Ganze Bereiche: der Schieberegler unter **Abschnittstexte** (erster Punkt unter Hero-Bereich, Arbeiten, Über mich und Kontakt).']],
            ['id' => 'a-featured', 'title' => 'Ich möchte eine andere Referenz hervorheben', 'steps' => ['In der Referenzen-Liste den **Stern** der neuen Referenz klicken. Der bisherige wird dabei automatisch aufgehoben.']],
            ['id' => 'a-foto', 'title' => 'Ich möchte das Foto tauschen', 'steps' => ['**Hero-Bereich → Startbild & Einleitung** (bzw. **Über mich → Text & Porträt**) öffnen.', 'Am Foto das **rote X** klicken oder direkt eine neue Datei wählen.', 'Alt-Text prüfen, **Veröffentlichen**.']],
            ['id' => 'a-text', 'title' => 'Ich möchte einen Text ändern und Englisch anpassen', 'steps' => ['Den Text im passenden Bereich ändern und **Veröffentlichen**.', 'Dann **Englisch → Übersetzungstabelle → Noch offen**: der geänderte Text steht dort wieder offen, die englische Fassung anpassen.']],
            ['id' => 'a-folge', 'title' => 'Ich möchte eine Podcast-Folge hinzufügen', 'steps' => ['**Podcast → Folgen → Folge hinzufügen**, Titel und Links eintragen, **Veröffentlichen**.']],
            ['id' => 'a-pdf', 'title' => 'Ich möchte einen Beitrag als PDF zeigen', 'steps' => ['In der Referenz unter **Link zum Beitrag** „Beitrag selbst hosten“ und dann „PDF“ wählen, die Datei hochladen, Linktext prüfen, **Veröffentlichen**.']],
            ['id' => 'a-datei', 'title' => 'Ich möchte eine Datei umbenennen oder austauschen', 'steps' => ['**Mediathek** öffnen, Namen in der Karte ändern und **Umbenennen** klicken, oder **Ersetzen** wählen. Verweise passen sich automatisch an.']],
            ['id' => 'a-person', 'title' => 'Ich möchte eine weitere Person zulassen', 'steps' => ['Als Inhaberin: **System → Zugänge → Zugang hinzufügen** (Rolle Bearbeiter).']],
            ['id' => 'a-sichern', 'title' => 'Ich möchte vor großen Änderungen sichern', 'steps' => ['**System → Sicherung → Jetzt sichern** und zusätzlich **Aktuellen Stand herunterladen**.']],
            ['id' => 'a-zurueck', 'title' => 'Ich möchte etwas rückgängig machen', 'steps' => ['Soeben entfernt: im Hinweis **Rückgängig** klicken.', 'Früher entfernt: **System → Papierkorb**.', 'Alten Text zurückholen: unten im Eintrag **Frühere Fassungen**.']],
        ],
    ],
    [
        'id' => 'probleme', 'title' => 'Probleme & Fragen', 'icon' => 'help',
        'intro' => 'Wenn etwas nicht wie erwartet funktioniert.',
        'articles' => [
            ['id' => 'p-code', 'title' => 'Der Anmeldecode kommt nicht', 'steps' => ['Spam-Ordner prüfen und etwas warten (bis zu einer Minute).', 'Stimmt die E-Mail-Adresse? Nur eingetragene Adressen erhalten einen Code (aus Sicherheitsgründen kommt bei anderen keine Fehlermeldung).', 'Nach mehreren Fehlversuchen kurz warten. Hast du ein Passwort gesetzt und vergessen: „Passwort vergessen?“.', 'Hilft nichts, wende dich an die Inhaberin.']],
            ['id' => 'p-sichtbar', 'title' => 'Meine Änderung erscheint nicht auf der Seite', 'steps' => ['Hast du **Veröffentlichen** geklickt? „Als Entwurf speichern“ zeigt nur dir etwas (Vorschau).', 'In der Liste steht „Entwurf mit Änderungen“? Dann öffne den Eintrag und veröffentliche.', 'Browser neu laden mit [[Strg]]+[[F5]].', 'Ist der Abschnitt unter **Abschnittstexte** (beim passenden Menüpunkt) eingeschaltet?']],
            ['id' => 'p-bild', 'title' => 'Ein Bild erscheint nicht oder ist falsch zugeschnitten', 'steps' => ['Wurde veröffentlicht? Neue Bilder erscheinen erst nach „Veröffentlichen“.', 'Zuschnitt falsch: **Fokuspunkt** im Bildfeld neu setzen.', 'Datei in der **Mediathek** vorhanden? Wurde sie umbenannt oder gelöscht, fehlt sie im Eintrag.', 'Sehr große Dateien über 8 MB werden abgelehnt: vorher verkleinern.']],
            ['id' => 'p-menue', 'title' => 'Ein Menüpunkt oder Abschnitt fehlt', 'steps' => ['Unter **Abschnittstexte** (beim passenden Menüpunkt) ist der Abschnitt wohl ausgeschaltet.', 'Abschnitte ohne Einträge (z. B. keine Podcast-Folge) werden nicht gezeigt.', 'Referenzen, Folgen oder Stationen sind eventuell ausgeblendet (Schieberegler in der Liste).']],
            ['id' => 'p-mail', 'title' => 'Der „Schreib mir“-Knopf fehlt oder öffnet nichts', 'steps' => ['Trage unter **Kontakt & Fußzeile** eine **E-Mail-Adresse** ein. Ohne sie gibt es den Knopf nicht.', 'Öffnet sich kein Mailprogramm, zeigt die Seite die Adresse mit einem Knopf zum Kopieren.']],
            ['id' => 'p-speichern', 'title' => '„Ungespeicherte Änderungen“ oder „Nicht gesichert“', 'steps' => ['Warte kurz: Die Verwaltung sichert nach wenigen Sekunden automatisch.', 'Steht „Nicht gesichert – keine Verbindung?“, prüfe dein Internet und klicke **Als Entwurf speichern**.', 'Bei einem Fehler im Formular zeigt ein roter Kasten, was geprüft werden muss (z. B. Pflichtfeld).']],
        ],
    ],
    [
        'id' => 'glossar', 'title' => 'Glossar', 'icon' => 'doc',
        'intro' => 'Fachwörter in einfachen Worten.',
        'articles' => [
            [
                'id' => 'begriffe', 'title' => 'Wichtige Begriffe', 'lead' => 'Von A bis Z.',
                'terms' => [
                    'Akzentfarbe' => 'Die Hauptfarbe der Seite (Knöpfe, Zahlen). Einstellbar unter „Farben & Kopfzeile“.',
                    'Alt-Text' => 'Kurze Beschreibung eines Bildes für Menschen mit Screenreader und für Suchmaschinen.',
                    'Entwurf' => 'Gespeicherte, noch nicht veröffentlichte Änderung. Nur du siehst sie (Vorschau).',
                    'Featured' => 'Die eine hervorgehobene Referenz ganz oben („Titelseite“). Gewählt mit dem Stern.',
                    'Fokuspunkt' => 'Die wichtige Stelle im Bild, die beim Zuschneiden sichtbar bleibt.',
                    'Hero' => 'Der große Auftakt der Seite mit Name, Einleitung und Foto.',
                    'Kategorie' => 'Art einer Referenz (z. B. Video, Online, Radio). Jede Kategorie ist eine Spur im Schnittplatz.',
                    'Lightbox' => 'Das Fenster, das Bilder eines Beitrags groß zeigt, mit Pfeilen zum Blättern.',
                    'Mediathek' => 'Sammlung aller hochgeladenen Bilder und PDFs.',
                    'noindex' => 'Bitte an Suchmaschinen, die Seite nicht aufzunehmen. Gilt solange die Seite nicht fertig ist.',
                    'Schnittplatz' => 'Die Zeitleiste über der Beitragsliste: Spuren mit Clips, die zu den Beiträgen springen.',
                    'Spur' => 'Eine Zeile im Schnittplatz, entspricht einer Kategorie.',
                    'Veröffentlichen' => 'Macht eine Änderung für alle Besucher sichtbar.',
                    'Vorschau' => 'Ansicht der Seite mit allen Entwürfen, nur für dich.',
                    'WebP' => 'Modernes, kleines Bildformat. Alle Bilder werden automatisch so gespeichert.',
                ],
            ],
        ],
    ],
];
