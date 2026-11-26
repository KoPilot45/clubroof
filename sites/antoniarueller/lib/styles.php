<?php
declare(strict_types=1);

/**
 * Stile: je Bereich der Seite eine Auswahl an Gestaltungsvarianten. „aktuell“ ist immer das bisherige Design und der Standard.
 * Jeder Stil hat eine Vorlage (templates/sections/stile/<bereich>-<stil>.php) und, wenn nötig, eine Stylesheet-Datei
 * (assets/stile/<bereich>-<stil>.css), die nur geladen wird, wenn der Stil gewählt ist.
 */

/** Bereich => [Name, [Stilschlüssel => Name]]. */
/** Reihenfolge wie auf der Seite: Zeile, Hero, Leitfragen, Übersicht, Beiträge, Podcast, Über mich, Lebenslauf, Off the record, Kontakt. */
function style_sort(array $a): array
{
    $o = array_flip(['head', 'hero', 'questions', 'featured', 'editor', 'list', 'podcast', 'about', 'cv', 'off', 'contact']);
    uksort($a, fn($x, $y) => ($o[$x] ?? 99) <=> ($o[$y] ?? 99));
    return $a;
}

function style_registry(): array
{
    return style_sort([
        'head' => ['Abschnittszeile (REC-Zeile)', [
            'aktuell' => 'REC-Zeile (aktuell)',
            'kapitel' => 'Kapitelzähler („01 / 04“ mit Fortschritt)',
            'haarlinie' => 'Haarlinie (nur Nummer, Titel und eine feine Linie)',
        ]],
        'hero' => ['Startbereich (Hero)', [
            'aktuell' => 'Foto im Kreis (aktuell)',
            'bogen' => 'Bogen (Foto im hohen Bogen, Name links und rechts)',
            'sucher' => 'Sucher mit Bauchbinde (Kamerabild)',
        ]],
        'questions' => ['Leitfragen („Was mich antreibt“)', [
            'aktuell' => 'Große Fragen (aktuell)',
            'karten' => 'Zwei Karten (dunkle Flächen)',
            'fragezeichen' => 'Fragezeichen (großes Zeichen links)',
        ]],
        'off' => ['Off the record', [
            'aktuell' => 'Schwarze Balken über den Antworten (aktuell)',
            'fragebogen' => 'Fragebogen (zwei Spalten, Antworten offen)',
            'lexikon' => 'Lexikon (Nummer und Frage links, Antwort rechts)',
        ]],
        'contact' => ['Kontakt', [
            'aktuell' => 'Große Überschrift mit Knöpfen (aktuell)',
            'schriftzug' => 'Schriftzug (riesige Überschrift, E-Mail als breite Zeile)',
            'abspann' => 'Abspann (dunkle Fläche, zentriert)',
        ]],
        'about' => ['Über mich', [
            'aktuell' => 'Foto links, Text rechts (aktuell)',
            'geteilt' => 'Geteilt, dunkel (Foto links, dunkle Fläche rechts)',
            'feature' => 'Feature-Seite (große Aussage, Textspalten, Foto rechts)',
        ]],
        'cv' => ['Lebenslauf (Stationen)', [
            'aktuell' => 'Roter Faden (aktuell)',
            'tabelle' => 'Tabelle nach Jahren',
            'kacheln' => 'Stations-Kacheln',
        ]],
        'list' => ['Beitragsliste („Alle Beiträge“)', [
            'aktuell' => 'Pinnwand mit Zeitungsausschnitten (aktuell)',
            'magazin' => 'Magazin-Cover (hochformatige Kacheln mit Bild)',
            'zeilen' => 'Liste mit Vorschaubild (Zeilen)',
        ]],
        'featured' => ['Hervorgehobener Beitrag (Featured)', [
            'aktuell' => 'Dunkle Fläche mit großer Schlagzeile (aktuell)',
            'plakat' => 'Plakat (Sandfläche, Foto mit Pin)',
            'schlicht' => 'Schlicht (eine Zeile mit kleinem Bild)',
        ]],
        'editor' => ['Übersicht über den Beiträgen', [
            'aktuell' => 'Schnittplatz (aktuell)',
            'sendeplan' => 'Sendeplan (Spuren und Zeiträume als Tabelle)',
            'zeitstrahl' => 'Zeitstrahl (Beiträge entlang einer Linie)',
        ]],
        'podcast' => ['Podcast', [
            'aktuell' => 'Karten mit Tonspur (aktuell)',
            'verzeichnis' => 'Folgenverzeichnis (schlichte Liste)',
            'welle' => 'Großes Wellenband',
        ]],
    ]);
}

/** Texte für die Auswahlkarten im Backend: Bereich => [Name, Untertitel, [Stilschlüssel => [Name, Beschreibung]]]. */
function style_cards(): array
{
    return style_sort([
        'head' => ['Abschnittszeile', 'Die Zeile über jedem Abschnitt', [
            'aktuell' => ['REC-Zeile', 'Punkt, „REC“, Nummer, Name und Zeitcode. Das bisherige Design.'],
            'kapitel' => ['Kapitelzähler', '„01 / 04“ mit Fortschrittssegmenten.'],
            'haarlinie' => ['Haarlinie', 'Nur Nummer, Titel und eine feine Linie.'],
        ]],
        'hero' => ['Startbereich', 'Name, Foto und Einleitung', [
            'aktuell' => ['Foto im Kreis', 'Name groß links, Foto im Kreis. Das bisherige Design.'],
            'bogen' => ['Bogen', 'Foto im hohen Bogen, Vorname links, Nachname rechts.'],
            'sucher' => ['Sucher mit Bauchbinde', 'Kamerabild mit roter Namens-Bauchbinde.'],
        ]],
        'questions' => ['Leitfragen', '„Was mich antreibt“', [
            'aktuell' => ['Große Fragen', 'Zwei große Fragen mit Nummer. Das bisherige Design.'],
            'karten' => ['Zwei Karten', 'Dunkle Flächen mit großer Hintergrundzahl.'],
            'fragezeichen' => ['Fragezeichen', 'Großes Zeichen links, Fragen rechts.'],
        ]],
        'list' => ['Beitragsliste', '„Alle Beiträge“', [
            'aktuell' => ['Pinnwand', 'Zeitungsausschnitte mit roten Pins. Das bisherige Design.'],
            'magazin' => ['Magazin-Cover', 'Hochformatige Kacheln, bildfüllend.'],
            'zeilen' => ['Liste mit Vorschaubild', 'Schlichte Zeilen mit Bild links.'],
        ]],
        'featured' => ['Hervorgehobener Beitrag', 'Der Featured-Beitrag über dem Schnittplatz', [
            'aktuell' => ['Dunkle Fläche', 'Große Schlagzeile, Bild rechts. Das bisherige Design.'],
            'plakat' => ['Plakat', 'Sandfläche, Foto mit Pin an der Pinnwand.'],
            'schlicht' => ['Schlicht', 'Eine ruhige Zeile mit kleinem Bild und Textlink.'],
        ]],
        'editor' => ['Übersicht der Beiträge', 'Über der Beitragsliste', [
            'aktuell' => ['Schnittplatz', 'Spuren und Clips. Das bisherige Design.'],
            'sendeplan' => ['Sendeplan', 'Tabelle aus Spuren und Zeiträumen.'],
            'zeitstrahl' => ['Zeitstrahl', 'Beiträge entlang einer Linie.'],
        ]],
        'podcast' => ['Podcast', 'Folgen mit Links', [
            'aktuell' => ['Karten mit Tonspur', 'Dunkle Karten mit Wellenform. Das bisherige Design.'],
            'verzeichnis' => ['Folgenverzeichnis', 'Schlichte Liste mit Textlinks.'],
            'welle' => ['Großes Wellenband', 'Titel über einem breiten Wellenband.'],
        ]],
        'about' => ['Über mich', 'Foto, Aussage, Texte', [
            'aktuell' => ['Foto links, Text rechts', 'Das bisherige Design.'],
            'geteilt' => ['Geteilt, dunkel', 'Foto links, dunkle Fläche rechts.'],
            'feature' => ['Feature-Seite', 'Große Aussage, Textspalten, Foto rechts.'],
        ]],
        'cv' => ['Lebenslauf', 'Stationen', [
            'aktuell' => ['Roter Faden', 'Stationen entlang eines Fadens. Das bisherige Design.'],
            'tabelle' => ['Tabelle nach Jahren', 'Jahr links, Stationen als Zeilen.'],
            'kacheln' => ['Stations-Kacheln', 'Raster aus Karten mit Logo.'],
        ]],
        'off' => ['Off the record', 'Fragen und Antworten', [
            'aktuell' => ['Schwarze Balken', 'Antworten verdeckt, zum Aufdecken. Das bisherige Design.'],
            'fragebogen' => ['Fragebogen', 'Zwei Spalten, Antworten offen.'],
            'lexikon' => ['Lexikon', 'Nummer und Frage links, Antwort rechts.'],
        ]],
        'contact' => ['Kontakt', 'Überschrift, E-Mail, Profile', [
            'aktuell' => ['Große Überschrift', 'Zwei Zeilen, Knöpfe. Das bisherige Design.'],
            'schriftzug' => ['Schriftzug', 'Riesige Überschrift, E-Mail als breite Zeile.'],
            'abspann' => ['Abspann', 'Dunkle Fläche, zentriert.'],
        ]],
    ]);
}

/** Gewählter Stilschlüssel eines Bereichs; unbekannte oder fehlende Werte ergeben „aktuell“. */
function style_of(string $area): string
{
    static $cache = [];
    $reg = style_registry();
    if (!isset($reg[$area])) {
        return 'aktuell';
    }
    $v = (string)(setting('stile')['st_' . $area] ?? 'aktuell');
    return isset($reg[$area][1][$v]) ? $v : 'aktuell';
}

/** Stylesheets der gewählten Stile (nur vorhandene Dateien). */
function style_links(): string
{
    $out = '';
    foreach (array_keys(style_registry()) as $area) {
        $st = style_of($area);
        if ($st === 'aktuell') {
            continue;
        }
        $file = AR_ROOT . '/assets/stile/' . $area . '-' . $st . '.css';
        if (is_file($file)) {
            $out .= '<link rel="stylesheet" href="' . AR_BASE . '/assets/stile/' . $area . '-' . $st . '.css?v=' . (int)@filemtime($file) . '">' . "\n";
        }
    }
    return $out;
}

/** Vorlage eines Stils einbinden; liefert false, wenn der Stil „aktuell“ ist oder die Vorlage fehlt. */
function style_template(string $area): ?string
{
    $st = style_of($area);
    if ($st === 'aktuell') {
        return null;
    }
    $file = AR_ROOT . '/templates/sections/stile/' . $area . '-' . $st . '.php';
    return is_file($file) ? $file : null;
}

/** Vorschaubild eines Stils (echter Ausschnitt der Seite in Standardfarben und Standardschrift), leer wenn nicht vorhanden. */
function style_preview_url(string $area, string $key): string
{
    $f = AR_ROOT . '/assets/stile/vorschau/' . $area . '-' . $key . '.jpg';
    return is_file($f) ? AR_BASE . '/assets/stile/vorschau/' . $area . '-' . $key . '.jpg?v=' . (int)@filemtime($f) : '';
}

/** Zahl der Nummerngruppen der sichtbaren Abschnitte (für den Kapitelzähler „01 / 04“). */
function style_no_total(): int
{
    return max(1, (int)($GLOBALS['ar_no_total'] ?? 1));
}
