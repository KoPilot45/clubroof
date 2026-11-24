<?php
declare(strict_types=1);
defined('AR_ROOT') || exit;

// Hilfe: Kapitel 4–7 (Arbeiten, Podcast/Lebenslauf/Über mich/Off the record/Kontakt, Englisch, Mediathek)
return [
    [
        'id' => 'arbeiten', 'title' => 'Arbeiten (Referenzen)', 'icon' => 'film',
        'intro' => 'Referenzen, Kategorien, Featured, Schnittplatz und eigene Beiträge mit Bildern oder PDF.',
        'articles' => [
            [
                'id' => 'referenz-anlegen', 'title' => 'Eine Referenz anlegen und bearbeiten', 'shot' => 'referenz-bearbeiten', 'alt' => 'Formular einer Referenz',
                'lead' => 'Eine Referenz ist eine Arbeitsprobe: ein Beitrag mit Titel, Redaktion, Kategorie und Link.',
                'legend' => ['**Titel** (Pflicht)', '**Kategorie** (Pflicht): bestimmt Spur, Farbe und Symbol im Schnittplatz', '**Datum**: ergibt die Anzeige „MM/JJJJ“ und das Jahres-Fähnchen im Schnittplatz', '**Beschreibung** (ein bis zwei Sätze, erscheint auf der Kachel)', '**Vorschaubild** (optional, wird quadratisch gezeigt)'],
                'steps' => [
                    'Öffne **Arbeiten → Referenzen** und klicke **Referenz hinzufügen**.',
                    'Trage **Titel**, **Kurzname** (kurz, für den Schnittplatz) und **Redaktion / Sender** ein und wähle die **Kategorie**.',
                    'Setze das **Datum**. Bei Zeiträumen („2024–2025“) hilft das Feld **Datumsanzeige überschreiben**.',
                    'Ergänze **Rolle** und **Beschreibung**. Ein **Vorschaubild** ist optional, ein **Bildnachweis** erscheint klein im Bild.',
                    'Lege unter **Link zum Beitrag** fest, wohin der Knopf führt (eigener Artikel in dieser Hilfe).',
                    '**Als Entwurf speichern** und prüfen, dann **Veröffentlichen**.',
                ],
                'tips' => ['Der Entwurf zeigt sich nur dir. Veröffentlichst du ihn nicht, bleibt er unsichtbar (die Liste markiert ihn als „Neu · nicht veröffentlicht“).'],
                'open' => ['Referenzen öffnen', 'p=list&c=clips'],
            ],
            [
                'id' => 'kategorien', 'title' => 'Kategorien und Schnittplatz', 'shot' => 'kategorien', 'alt' => 'Liste der Kategorien',
                'lead' => 'Jede Kategorie ist eine Spur im „Schnittplatz“, der Zeitleiste über der Beitragsliste.',
                'legend' => ['Kategorie mit Spurkürzel (V1, T1 …)', 'Per Ziehen die Reihenfolge der Spuren ändern'],
                'steps' => [
                    'Öffne **Arbeiten → Kategorien**. Hier legst du Spuren wie „Video / TV“, „Online“ oder „Radio“ an.',
                    'Jede Kategorie hat **Spurkürzel**, **Bezeichnung**, **Symbol** sowie **Balkenfarbe** und **Schriftfarbe**.',
                    'In der Referenz wählst du nur die Kategorie, die Spur ergibt sich daraus.',
                    'Im Schnittplatz hängen die Clips einer Spur in der Reihenfolge der Referenzen aneinander. Ihre Breite variiert automatisch, die längste Spur füllt mindestens 80 % der Breite.',
                    'Ein Klick auf einen Clip springt zur Kachel des Beitrags darunter.',
                ],
                'after' => 'Jahreszahlen erscheinen als kleines Fähnchen dort, wo ein neues Jahr beginnt.',
                'open' => ['Kategorien öffnen', 'p=list&c=tracks'],
            ],
            [
                'id' => 'featured', 'title' => 'Featured: eine Referenz hervorheben', 'shot' => 'featured', 'alt' => 'Stern neben dem Schieberegler in der Referenzliste',
                'lead' => 'Eine Referenz kann ganz oben als farbige „Titelseite“ erscheinen.',
                'legend' => ['Der **Stern**: einmal klicken = hervorgehoben, noch einmal = aufgehoben', 'Der Hinweis „Featured“ zeigt, welche Referenz gerade oben steht'],
                'steps' => [
                    'Klicke in der Referenzen-Liste auf den **Stern** der gewünschten Referenz. Es ist immer **nur eine** hervorgehoben: Ein Klick bei einer anderen nimmt den Stern der bisherigen weg.',
                    'Ein zweiter Klick auf den aktiven Stern hebt das Featured auf, dann entfällt der Bereich auf der Seite.',
                    'Das Featured zeigt Titel, Beschreibung, Rolle, Redaktion und das Vorschaubild. Mit Knopf zum Beitrag.',
                ],
                'tips' => ['Ist die hervorgehobene Referenz ausgeblendet, steht in der Liste „Featured – aktuell ausgeblendet“ und der Bereich fehlt auf der Seite.', 'Der Stern wirkt sofort, ohne Veröffentlichen.'],
            ],
            [
                'id' => 'beitrag-selbst', 'title' => 'Link zum Beitrag: extern oder selbst hosten', 'shot' => 'referenz-link', 'alt' => 'Abschnitt „Link zum Beitrag“ mit zwei Umschaltern',
                'lead' => 'Ein Beitrag kann auf eine andere Webseite verweisen oder direkt hier liegen (Bilder oder PDF).',
                'legend' => ['**Externer Link** oder **Beitrag selbst hosten**', '**Bilder** oder **PDF**', 'Linktext des Knopfes', 'Galerie: Bilder hochladen, sortieren, Bildunterschrift'],
                'steps' => [
                    'Wähle oben **Externer Link**, wenn der Beitrag woanders liegt. Trage den **Link** und den **Linktext** ein (z. B. „Zum Beitrag“). Der Haken öffnet ihn in einem neuen Tab.',
                    'Wähle **Beitrag selbst hosten**, wenn du Bilder oder ein PDF zeigen willst. Dann wählst du **Bilder** oder **PDF**.',
                    '**Bilder:** Mit **Bilder hinzufügen** (auch mehrere gleichzeitig) oder **Aus Mediathek wählen** füllst du die Galerie. Die Reihenfolge änderst du per Ziehen oder mit den Pfeilen, die **Bildunterschrift** ist optional.',
                    '**PDF:** Lade ein PDF hoch oder wähle es aus der Mediathek. Es öffnet sich beim Klick in einem neuen Tab.',
                    'Der **Linktext** gilt für beide Fälle, Standard ist „Beitrag ansehen“.',
                ],
                'after' => 'Der Knopf steht in der Kachel und im Featured. Bei Bildern öffnet er eine Galerie (Lightbox) mit Pfeilen, Wischen und Tastatur, bei einem PDF öffnet sich ein neuer Tab.',
                'tips' => ['Die Eingaben des jeweils anderen Modus bleiben gespeichert, du kannst jederzeit zurückwechseln.'],
            ],
            [
                'id' => 'vorschaubild', 'title' => 'Vorschaubild und Bildnachweis', 'lead' => 'Jede Referenz kann ein eigenes quadratisches Vorschaubild bekommen.',
                'steps' => [
                    'Lade im Feld **Vorschaubild** ein Bild hoch. Es wird als **quadratische Kachel** gezeigt.',
                    'Setze den **Fokuspunkt** durch einen Klick auf die wichtige Stelle, damit der Ausschnitt gut sitzt.',
                    'Trage bei Bedarf den **Bildnachweis** ein (z. B. „Bild: buten un binnen“). Er erscheint klein im Bild.',
                    'Ohne Vorschaubild zeigt die Kachel eine farbige Fläche mit der Nummer.',
                ],
            ],
        ],
    ],
    [
        'id' => 'mehr', 'title' => 'Podcast, Lebenslauf, Über mich & Kontakt', 'icon' => 'user',
        'intro' => 'Folgen, Stationen, Porträt, Off the record und die Kontaktangaben.',
        'articles' => [
            [
                'id' => 'podcast', 'title' => 'Podcast-Folgen', 'shot' => 'podcast-folge', 'alt' => 'Formular einer Podcast-Folge',
                'lead' => 'Folgen werden nicht abgespielt, sondern verlinken zu Spotify, Apple, ARD Audiothek und mehr.',
                'legend' => ['Podcast-Name (Pflicht) und Titel der Folge', 'Kurzbeschreibung (höchstens 200 Zeichen)', 'Links zu den Plattformen: leere Links werden nicht gezeigt'],
                'steps' => [
                    'Öffne **Podcast → Folgen** und klicke **Folge hinzufügen**.',
                    'Trage **Podcast-Name**, **Titel**, Nummer, **Dauer**, Sender und Datum ein.',
                    'Schreibe eine **Kurzbeschreibung** (ein bis zwei Sätze).',
                    'Füge die **Links** ein. Nur ausgefüllte Plattformen erscheinen als Knopf.',
                    'Wähle die **Wellenform** (oder „Automatisch“) und **Veröffentlichen**.',
                ],
                'open' => ['Folgen öffnen', 'p=list&c=episodes'],
            ],
            [
                'id' => 'lebenslauf', 'title' => 'Stationen und Lebenslauf', 'shot' => 'lebenslauf', 'alt' => 'Liste der Lebenslauf-Stationen',
                'lead' => 'Der Lebenslauf gruppiert sich automatisch nach Jahr (neueste zuerst).',
                'legend' => ['**Rolle**, z. B. „Reporterin“', '**Organisation** (erscheint kursiv)', '**Beginn** (und darunter **Ende**)', 'Der Haken **Läuft noch** färbt die Jahreszahl im Lebenslauf ein'],
                'steps' => [
                    '**Lebenslauf → Stationen:** pro Station **Rolle**, **Organisation**, **Von** und **Bis**. Läuft die Station noch, setze den Haken **Läuft noch** (die Jahreszahl wird dann farbig).',
                    '**Sender & Redaktionen:** die große Namensliste. Mit **Farbig hervorheben** markierst du die aktuelle Station.',
                    '**Davor:** frühere Erfahrungen und Ausbildung als kurze Zeilen mit Zusatz rechts.',
                    'Das **CV als PDF** (Download-Knopf) lädst du unter **Kontakt & Fußzeile** hoch.',
                ],
                'open' => ['Stationen öffnen', 'p=list&c=cv'],
            ],
            [
                'id' => 'ueber-mich', 'title' => 'Über mich: Text, Porträt, Medien, Sprachen', 'lead' => 'Foto und Text im Abschnitt „Über mich“.',
                'steps' => [
                    '**Text & Porträt:** Foto mit Alt-Text, optional der Stempel „On Air“, die **große Aussage** und der Text in zwei Spalten.',
                    '**Crossmedial:** Kacheln mit Medium (Symbol), Name und den Sendern, für die du arbeitest.',
                    '**Sprachen:** Sprache und Niveau, z. B. „Deutsch – Muttersprache“.',
                    'Die Überschriften „Crossmedial unterwegs“ und „Sprachen“ stehen im Formular **Text & Porträt**.',
                ],
                'open' => ['Über mich öffnen', 'p=group&g=about'],
            ],
            [
                'id' => 'off-the-record', 'title' => 'Off the record', 'lead' => 'Persönliche Fragen mit Antworten, die zunächst geschwärzt sind.',
                'steps' => [
                    'Öffne **Off the record → Fragen & Antworten** und lege Einträge mit **Frage** und **Antwort** an.',
                    'Auf der Seite sind die Antworten geschwärzt und erscheinen beim Darüberfahren (am Handy: Antippen).',
                    'Den Hinweis unter der Überschrift änderst du unter **Seite & Design → Abschnitte**.',
                ],
                'open' => ['Fragen öffnen', 'p=list&c=offrecord'],
            ],
            [
                'id' => 'kontakt', 'title' => 'Kontakt, Fußzeile und Social-Media', 'lead' => 'E-Mail-Knopf, Texte am Seitenende und Profile.',
                'steps' => [
                    '**Kontakt & Fußzeile:** E-Mail-Adresse, Überschrift, Einleitung, Beschriftung der Knöpfe, **Lebenslauf als PDF**, Copyright, **Fotonachweis** (optional mit Link) und Schlusszeile.',
                    'Die E-Mail-Adresse steht **nicht** im Quelltext der Seite: Sie wird erst beim Klick geladen (Schutz vor Spam).',
                    '**Social-Media-Profile:** pro Profil Name und Link. Sie erscheinen als Knöpfe unter „Schreib mir“, im Handy-Menü und als Profile für Suchmaschinen.',
                ],
                'tips' => ['Der Knopf „Schreib mir“ in der Kopfzeile verschwindet, solange keine E-Mail-Adresse eingetragen ist.'],
                'open' => ['Kontakt öffnen', 'p=group&g=contact'],
            ],
        ],
    ],
    [
        'id' => 'englisch', 'title' => 'Englisch', 'icon' => 'globe',
        'intro' => 'Die englische Fassung der Seite, alle Texte an einem Ort.',
        'articles' => [
            [
                'id' => 'uebersetzungstabelle', 'title' => 'Die Übersetzungstabelle', 'shot' => 'uebersetzung', 'alt' => 'Übersetzungstabelle mit deutschem und englischem Text nebeneinander',
                'lead' => 'Links der deutsche Text, rechts die englische Fassung. Es gibt keine getrennten Englisch-Felder mehr.',
                'legend' => ['Filter: nur **Noch offen** oder **Alle**', 'Bereich wählen und Suche', 'Das englische Feld: wird beim Verlassen automatisch gespeichert', '**Deutsch übernehmen** kopiert den deutschen Text'],
                'steps' => [
                    'Öffne **Englisch → Übersetzungstabelle**. Oben zeigt ein Balken, wie viel Prozent schon übersetzt sind.',
                    'Wähle den Filter **Noch offen**, dann siehst du nur, was noch fehlt, optional pro **Bereich**.',
                    'Schreibe die englische Fassung ins rechte Feld. Gespeichert wird automatisch, sobald du das Feld verlässt („✓ gespeichert“).',
                    'Hervorhebungen (**Sternchen** und Gleichheitszeichen) wie im Deutschen übernehmen.',
                    'Prüfe das Ergebnis mit **Englische Vorschau**.',
                ],
                'after' => 'Ist ein englisches Feld leer, zeigt die englische Seite dort den deutschen Text. Die Seite lässt sich über **EN** oben aufrufen.',
                'tips' => ['Texte, die schon im Wörterbuch stehen (z. B. „Anhören bei“), brauchst du nicht zu übersetzen. Sie erscheinen nur in der Tabelle, wenn du sie geändert hast.', 'Namen, Kürzel, Redaktionen und Links werden nie übersetzt.'],
                'open' => ['Tabelle öffnen', 'p=translate'],
            ],
        ],
    ],
    [
        'id' => 'mediathek', 'title' => 'Mediathek', 'icon' => 'image',
        'intro' => 'Alle Bilder und PDFs: hochladen, umbenennen, ersetzen, aufräumen.',
        'articles' => [
            [
                'id' => 'mediathek-ueberblick', 'title' => 'Die Mediathek im Überblick', 'shot' => 'mediathek', 'alt' => 'Mediathek mit Filter, Suche und Dateikarten',
                'lead' => 'Die Mediathek zeigt alles, was hochgeladen wurde, und wo es verwendet wird.',
                'legend' => ['Hochladen: Bilder und PDFs, auch mehrere', 'Filter **Alle / Bilder / PDFs / Ungenutzt**, Suche und Sortierung', 'Der **Dateiname** lässt sich in der Karte ändern', '**Ersetzen** tauscht die Datei unter demselben Namen aus', 'Kästchen für das **Mehrfach-Löschen**'],
                'steps' => [
                    'Öffne **Mediathek** (nach „Englisch“) und wähle unter **Dateien hochladen** eine oder mehrere Dateien. Der Dateiname bleibt erhalten (klein geschrieben, ohne Sonderzeichen).',
                    'Mit den Filtern siehst du nur Bilder, nur PDFs oder nur **Ungenutzte**. Die Suche findet Namen.',
                    'Jede Karte zeigt Größe und **„Verwendet in“** mit Link zum Eintrag.',
                ],
                'open' => ['Mediathek öffnen', 'p=media'],
            ],
            [
                'id' => 'umbenennen', 'title' => 'Umbenennen, ersetzen und löschen', 'lead' => 'Dateien lassen sich ändern, ohne dass auf der Seite etwas kaputtgeht.',
                'steps' => [
                    '**Umbenennen:** Namen in der Karte ändern und **Umbenennen** klicken. Alle Verweise (Einträge, Entwürfe, frühere Fassungen, Englisch) werden **automatisch** angepasst. Ist der Name vergeben, lehnt die Mediathek ihn ab.',
                    '**Ersetzen:** Neue Datei wählen. Sie übernimmt den Namen der alten (Bild nur durch Bild, PDF nur durch PDF).',
                    '**Löschen:** nur bei ungenutzten Dateien. Für mehrere Dateien Kästchen ankreuzen oder **Alle ungenutzten wählen**, dann **Ausgewählte löschen**.',
                    'Die Auswahl in Bild- und PDF-Feldern (**Aus Mediathek wählen**) zeigt nur das jeweils passende.',
                ],
                'warn' => ['Nach dem Umbenennen funktioniert die **alte Adresse** der Datei nicht mehr (z. B. in bereits geteilten Links).', 'Gelöschte Dateien sind endgültig weg.'],
            ],
        ],
    ],
];
