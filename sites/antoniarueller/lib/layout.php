<?php
declare(strict_types=1);

/**
 * Aufbau der Seite: Reihenfolge und Sichtbarkeit der Abschnitte und ihrer Unterabschnitte.
 * Der Startbereich (Hero) steht immer oben; „Kontakt & Fußzeile“ immer unten (die Fußzeile gehört zu ihm).
 */

/** Verschiebbare Abschnitte: Schlüssel => [Name, Gruppe der Nummerierung]. Gleiche Gruppe = gleiche Nummer in der REC-Zeile, wenn sie nebeneinander stehen. */
function layout_sections(): array
{
    return [
        'questions' => ['Leitfragen', 'start'],
        'arbeiten' => ['Showreel (Arbeiten)', 'arbeiten'],
        'about' => ['Über mich', 'ueber'],
        'cv' => ['Lebenslauf', 'cv'],
        'off' => ['Off the record', 'cv'],
    ];
}

/** Unterabschnitte: Abschnitt => [Schlüssel => Name]; die Reihenfolge ist die Standardreihenfolge. */
function layout_subs(): array
{
    return [
        'arbeiten' => ['featured' => 'Hervorgehobener Beitrag (Featured)', 'editor' => 'Schnittplatz', 'list' => 'Beitragsliste', 'podcast' => 'Podcast'],
        'about' => ['cross' => 'Crossmedial', 'lang' => 'Sprachen'],
        'cv' => ['logos' => 'Logoleiste', 'thread' => 'Zeitstrahl'],
    ];
}

/** Schalter „Abschnitt zeigen“: Abschnitt => Einstellung (die Schlüssel sind dieselben wie früher in den Abschnittstexten). */
function layout_toggles(): array
{
    return ['questions' => 'on_questions', 'arbeiten' => 'on_show', 'about' => 'on_about', 'cv' => 'on_cv', 'off' => 'on_off', 'contact' => 'on_contact'];
}

/** Einstellungen der Unterabschnitte: Schlüssel => Einstellung des Schalters. */
function layout_sub_toggles(): array
{
    return ['featured' => 's_featured', 'editor' => 's_editor', 'list' => 's_list', 'podcast' => 's_podcast', 'cross' => 's_cross', 'lang' => 's_lang', 'logos' => 's_logos', 'thread' => 's_thread'];
}

/** Einstellung für die Reihenfolge der Unterabschnitte eines Abschnitts. */
function layout_sub_key(string $parent): string
{
    return 'sub_' . $parent;
}

/** Gültige Reihenfolge aus einer Liste „a,b,c“: unbekannte und doppelte Einträge entfallen, fehlende folgen in Standardreihenfolge. */
function layout_normalize(string $csv, array $valid): array
{
    $out = [];
    foreach (explode(',', $csv) as $id) {
        $id = trim($id);
        if ($id !== '' && in_array($id, $valid, true) && !in_array($id, $out, true)) {
            $out[] = $id;
        }
    }
    foreach ($valid as $id) {
        if (!in_array($id, $out, true)) {
            $out[] = $id;
        }
    }
    return $out;
}

function layout_order(array $layout): array
{
    return layout_normalize((string)($layout['order'] ?? ''), array_keys(layout_sections()));
}

function layout_sub_order(array $layout, string $parent): array
{
    return layout_normalize((string)($layout[layout_sub_key($parent)] ?? ''), array_keys(layout_subs()[$parent]));
}

/** Schalter aus den Einstellungen (fehlend = an). */
function layout_flags(array $layout): array
{
    $out = [];
    foreach (layout_toggles() as $k) {
        $out[$k] = !array_key_exists($k, $layout) || !empty($layout[$k]);
    }
    return $out;
}

/** Nummern der REC-Zeilen: Der Startbereich ist 00; eine neue Nummer beginnt, wenn die Gruppe wechselt. */
function layout_numbers(array $visibleOrder): array
{
    $groups = layout_sections() + ['contact' => ['Kontakt', 'kontakt']];
    $n = 0;
    $prev = 'start';
    $out = [];
    foreach ($visibleOrder as $id) {
        $g = $groups[$id][1];
        if ($g !== $prev) {
            $n++;
            $prev = $g;
        }
        $out[$id] = sprintf('%02d', $n);
    }
    return $out;
}
