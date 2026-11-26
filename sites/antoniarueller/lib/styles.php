<?php
declare(strict_types=1);

/**
 * Stile: je Bereich der Seite eine Auswahl an Gestaltungsvarianten. „aktuell“ ist immer das bisherige Design und der Standard.
 * Jeder Stil hat eine Vorlage (templates/sections/stile/<bereich>-<stil>.php) und, wenn nötig, eine Stylesheet-Datei
 * (assets/stile/<bereich>-<stil>.css), die nur geladen wird, wenn der Stil gewählt ist.
 */

/** Bereich => [Name, [Stilschlüssel => Name]]. */
function style_registry(): array
{
    return [
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
        'list' => ['Beitragsliste („Alle Beiträge“)', [
            'aktuell' => 'Pinnwand mit Zeitungsausschnitten (aktuell)',
            'magazin' => 'Magazin-Cover (hochformatige Kacheln mit Bild)',
            'zeilen' => 'Liste mit Vorschaubild (Zeilen)',
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
    ];
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

/** Zahl der Nummerngruppen der sichtbaren Abschnitte (für den Kapitelzähler „01 / 04“). */
function style_no_total(): int
{
    return max(1, (int)($GLOBALS['ar_no_total'] ?? 1));
}
