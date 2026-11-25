<?php
declare(strict_types=1);

/**
 * Schriften der Seite: je Rolle (Überschrift in Großbuchstaben, Serifenschrift, Fließtext, Beschriftungen) die jetzige Schrift
 * plus drei Alternativen, alle selbst gehostet (SIL Open Font License). Auf der Seite werden nur die gewählten Schriften geladen:
 * Es steht nur deren @font-face im Quelltext, und nur die wichtigsten Dateien werden vorab geladen.
 *
 * Eintrag: Schlüssel => [Name, CSS-Familie, Ersatzschrift, Charakter, Schnitte [Dicke, Stil, Dateiname, (deklarierte Dicke)]]
 */
const FONT_LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const FONT_LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

function font_catalog(): array
{
    return [
        'display' => [
            'anton' => ['Anton', 'Anton', 'sans-serif', 'Kräftig, schmal, sehr präsent (jetzt)', [[400, 'normal', 'anton']]],
            'bebas-neue' => ['Bebas Neue', 'Bebas Neue', 'sans-serif', 'Schlank und klar, wie eine Schlagzeile', [[400, 'normal', 'bebas-neue']]],
            'league-gothic' => ['League Gothic', 'League Gothic', 'sans-serif', 'Sehr schmal, zeitungsartig', [[400, 'normal', 'league-gothic']]],
            'oswald' => ['Oswald', 'Oswald', 'sans-serif', 'Etwas breiter, gut lesbar', [[600, 'normal', 'oswald']]],
        ],
        'serif' => [
            'instrument-serif' => ['Instrument Serif', 'Instrument Serif', 'serif', 'Schmal, elegant, redaktionell (jetzt)', [[400, 'normal', 'instrument-serif'], [400, 'italic', 'instrument-serif']]],
            'playfair-display' => ['Playfair Display', 'Playfair Display', 'serif', 'Klassisch mit starkem Kontrast', [[400, 'normal', 'playfair-display'], [400, 'italic', 'playfair-display']]],
            'cormorant-garamond' => ['Cormorant Garamond', 'Cormorant Garamond', 'serif', 'Zart und literarisch', [[400, 'normal', 'cormorant-garamond-500'], [400, 'italic', 'cormorant-garamond-500']]],
            'dm-serif-display' => ['DM Serif Display', 'DM Serif Display', 'serif', 'Kräftig, modern-klassisch', [[400, 'normal', 'dm-serif-display'], [400, 'italic', 'dm-serif-display']]],
        ],
        'sans' => [
            'inter-tight' => ['Inter Tight', 'Inter Tight', 'system-ui, sans-serif', 'Eng und sachlich (jetzt)', [[400, 'normal', 'inter-tight'], [500, 'normal', 'inter-tight'], [600, 'normal', 'inter-tight']]],
            'inter' => ['Inter', 'Inter', 'system-ui, sans-serif', 'Etwas weiter, sehr gut lesbar', [[400, 'normal', 'inter'], [500, 'normal', 'inter'], [600, 'normal', 'inter']]],
            'dm-sans' => ['DM Sans', 'DM Sans', 'system-ui, sans-serif', 'Rund und freundlich', [[400, 'normal', 'dm-sans'], [500, 'normal', 'dm-sans'], [600, 'normal', 'dm-sans']]],
            'source-sans-3' => ['Source Sans 3', 'Source Sans 3', 'system-ui, sans-serif', 'Schmal, menschlich, ruhig', [[400, 'normal', 'source-sans-3'], [500, 'normal', 'source-sans-3'], [600, 'normal', 'source-sans-3']]],
        ],
        'mono' => [
            'jetbrains-mono' => ['JetBrains Mono', 'JetBrains Mono', 'monospace', 'Technisch, ruhig (jetzt)', [[400, 'normal', 'jetbrains-mono'], [600, 'normal', 'jetbrains-mono']]],
            'ibm-plex-mono' => ['IBM Plex Mono', 'IBM Plex Mono', 'monospace', 'Nüchtern wie ein Protokoll', [[400, 'normal', 'ibm-plex-mono'], [600, 'normal', 'ibm-plex-mono']]],
            'space-mono' => ['Space Mono', 'Space Mono', 'monospace', 'Eigenwillig, auffällig', [[400, 'normal', 'space-mono'], [600, 'normal', 'space-mono-700']]],
            'dm-mono' => ['DM Mono', 'DM Mono', 'monospace', 'Weich und leicht', [[400, 'normal', 'dm-mono'], [600, 'normal', 'dm-mono-500']]],
        ],
    ];
}

/** Rollen: Schlüssel der Einstellung => [Rolle, Bezeichnung im Backend, CSS-Variable, Beispieltext] */
function font_roles(): array
{
    return [
        'font_display' => ['display', 'Große Überschriften (Großbuchstaben)', '--anton', 'ANTONIA RÜLLER'],
        'font_serif' => ['serif', 'Titel und Hervorhebungen (Serifenschrift)', '--serif', 'Journalistin aus Bremen'],
        'font_sans' => ['sans', 'Fließtext und Knöpfe', '--sans', 'Recherche und dokumentarisches Erzählen für Radio, Podcast und Bewegtbild.'],
        'font_mono' => ['mono', 'Beschriftungen (REC-Zeilen, Zeiträume)', '--mono', 'REC 03 — LEBENSLAUF · 2015 — HEUTE'],
    ];
}

/** Optionen einer Rolle für die Auswahl: Schlüssel => Name. */
function font_options(string $role): array
{
    return array_map(fn($f) => $f[0], font_catalog()[$role]);
}

function font_default(string $role): string
{
    return (string)array_key_first(font_catalog()[$role]);
}

/** Schriftgrößen: drei Voreinstellungen, je Faktor für Großschrift, Titel und Fließtext. Beschriftungen bleiben bei mindestens 12 px. */
function size_presets(): array
{
    return [
        'kompakt' => ['Kompakt', 'Etwas kleiner und dichter', ['d' => 0.86, 't' => 0.9, 'b' => 0.95]],
        'standard' => ['Standard', 'So, wie die Seite jetzt aussieht', ['d' => 1.0, 't' => 1.0, 'b' => 1.0]],
        'gross' => ['Groß', 'Größer und luftiger, gut lesbar', ['d' => 1.12, 't' => 1.1, 'b' => 1.08]],
    ];
}

/** @font-face-Regeln für die angegebenen Schriften (Rolle => Schlüssel); $base = Adresse des Ordners „fonts“. */
function font_faces_css(array $keys, string $base = 'fonts'): string
{
    $cat = font_catalog();
    $css = '';
    foreach ($keys as $role => $key) {
        $f = $cat[$role][$key] ?? null;
        if (!$f) {
            continue;
        }
        foreach ($f[4] as $face) {
            [$w, $st, $file] = $face;
            foreach (['latin' => FONT_LATIN, 'latin-ext' => FONT_LATIN_EXT] as $sub => $range) {
                // „cormorant-garamond-500“: der Dateiname trägt die tatsächliche Dicke, die Datei heißt …-latin-500-…
                $name = preg_match('~^(.+)-(\d{3})$~', $file, $m) ? $m[1] . '-' . $sub . '-' . $m[2] . '-' . $st : $file . '-' . $sub . '-' . $w . '-' . $st;
                $css .= "@font-face{font-family:'" . $f[1] . "';font-style:" . $st . ';font-weight:' . $w . ';font-display:swap;src:url(' . $base . '/' . $name . '.woff2) format(\'woff2\');unicode-range:' . $range . "}\n";
            }
        }
    }
    return $css;
}

/** Gewählte Schriften aus den Einstellungen (ungültige Werte fallen auf die Standardschrift zurück). */
function chosen_fonts(array $typo): array
{
    $out = [];
    foreach (font_roles() as $key => [$role]) {
        $v = (string)($typo[$key] ?? '');
        $out[$role] = isset(font_catalog()[$role][$v]) ? $v : font_default($role);
    }
    return $out;
}

/** Kopfzeilen-Teil für die Seite: Vorab-Laden der wichtigsten Dateien, @font-face nur der gewählten Schriften, Variablen für Schrift und Größe. */
function font_head(array $typo): string
{
    $ch = chosen_fonts($typo);
    $cat = font_catalog();
    $base = AR_BASE . '/assets/fonts';
    $out = '';
    // Vorab laden: Großschrift, Serif (kursiv, falls vorhanden) und Fließtext, jeweils der lateinische Schnitt
    foreach (['display' => 0, 'serif' => 1, 'sans' => 0] as $role => $idx) {
        $faces = $cat[$role][$ch[$role]][4];
        $face = $faces[min($idx, count($faces) - 1)];
        [$w, $st, $file] = $face;
        $name = preg_match('~^(.+)-(\d{3})$~', $file, $m) ? $m[1] . '-latin-' . $m[2] . '-' . $st : $file . '-latin-' . $w . '-' . $st;
        $out .= '<link rel="preload" href="' . $base . '/' . $name . '.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
    }
    $vars = '';
    foreach (font_roles() as [$role, , $var]) {
        $f = $cat[$role][$ch[$role]];
        $vars .= $var . ":'" . $f[1] . "'," . $f[2] . ';';
    }
    $sz = size_presets();
    $preset = (string)($typo['size_preset'] ?? 'standard');
    $k = ($sz[$preset] ?? $sz['standard'])[2];
    $vars .= '--fs-d:' . $k['d'] . ';--fs-t:' . $k['t'] . ';--fs-b:' . $k['b'] . ';';
    return $out . '<style>' . font_faces_css($ch, $base) . ':root{' . $vars . "}</style>\n";
}
