<?php
declare(strict_types=1);

/**
 * Farbpaletten: eine Auswahl fertiger Paletten oder eigene Farben. Aus fünf Grundfarben (Hintergrund, Text, Akzent, dunkle Fläche, REC-Rot)
 * werden alle übrigen Farben der Seite berechnet (Linien, Karten, helle Töne auf dunklem Grund …); Lesbarkeit wird dabei gesichert.
 */

function palette_presets(): array
{
    // Schlüssel => [Name, Beschreibung, Grundfarben]
    return [
        'standard' => ['Petrol & Sand', 'Die jetzige Seite: ruhiges Petrol auf warmem Sand', ['paper' => '#F3ECDF', 'ink' => '#172526', 'accent' => '#0E5C62', 'teal' => '#0B3F44', 'rec' => '#C42F24']],
        'wald' => ['Waldgrün & Creme', 'Natürlich und ruhig', ['paper' => '#F4EFE2', 'ink' => '#1B2A1F', 'accent' => '#2F6B3F', 'teal' => '#1D4A2B', 'rec' => '#B8432B']],
        'bordeaux' => ['Bordeaux & Elfenbein', 'Klassisch, redaktionell', ['paper' => '#F6EFE6', 'ink' => '#2A1A1D', 'accent' => '#8A2538', 'teal' => '#551523', 'rec' => '#C42F24']],
        'marine' => ['Marine & Hellgrau', 'Kühl und sachlich', ['paper' => '#EEF0F2', 'ink' => '#16202B', 'accent' => '#1F4E79', 'teal' => '#13304D', 'rec' => '#D6402F']],
        'terrakotta' => ['Terrakotta & Sand', 'Warm und kräftig', ['paper' => '#F5EADB', 'ink' => '#2B1D16', 'accent' => '#A94A26', 'teal' => '#5E2A14', 'rec' => '#B82E22']],
        'graphit' => ['Graphit & Papier', 'Neutral, fast schwarz-weiß', ['paper' => '#F4F2EE', 'ink' => '#191B1C', 'accent' => '#2F3A3D', 'teal' => '#1C2325', 'rec' => '#C42F24']],
        'salbei' => ['Salbei & Leinen', 'Hell und natürlich, ruhiger als Waldgrün', ['paper' => '#F1F0E6', 'ink' => '#1F2A24', 'accent' => '#4A6B50', 'teal' => '#2B4536', 'rec' => '#B5432F']],
        'aubergine' => ['Aubergine & Flieder', 'Kulturell, kräftiger Akzent', ['paper' => '#F4EFF3', 'ink' => '#231A2A', 'accent' => '#5B3A7A', 'teal' => '#3A2354', 'rec' => '#C23A4B']],
        'senf' => ['Senf & Anthrazit', 'Warm und redaktionell', ['paper' => '#F6F0DC', 'ink' => '#20211F', 'accent' => '#7A5A00', 'teal' => '#2C2B25', 'rec' => '#C0392B']],
        'eisblau' => ['Eisblau & Nebel', 'Kühl und klar', ['paper' => '#EDF2F4', 'ink' => '#12232E', 'accent' => '#1B6A8A', 'teal' => '#0F3A4D', 'rec' => '#D2452F']],
        'kupfer' => ['Kupfer & Schiefer', 'Erdig, Kupferakzent auf Schiefer', ['paper' => '#F2EDE8', 'ink' => '#1E2326', 'accent' => '#A0552F', 'teal' => '#2B3A42', 'rec' => '#B8352A']],
        'zeitung' => ['Zeitung (Creme, Schwarz, Rot)', 'Wie eine Zeitungsseite', ['paper' => '#F2EFE8', 'ink' => '#141414', 'accent' => '#B3261E', 'teal' => '#222222', 'rec' => '#B3261E']],
        'altrosa' => ['Altrosa & Kohle', 'Weich, mit Kohle als Gegengewicht', ['paper' => '#F7EEEC', 'ink' => '#2A2224', 'accent' => '#9B4A5A', 'teal' => '#472A31', 'rec' => '#C23A2E']],
        'oliv' => ['Oliv & Haferbrei', 'Gedämpft und erdig', ['paper' => '#F3EEE0', 'ink' => '#26261C', 'accent' => '#6B6A1F', 'teal' => '#3B3B1A', 'rec' => '#B8432B']],
    ];
}

/** Optionen für die Auswahl: Schlüssel => Name (plus „Eigene Farben“). */
function palette_options(): array
{
    $o = array_map(fn($p) => $p[0], palette_presets());
    $o['custom'] = 'Eigene Farben';
    return $o;
}

function color_hex(string $v, string $default): string
{
    return preg_match('~^#[0-9A-Fa-f]{6}$~', $v) ? strtoupper($v) : $default;
}

function color_rgb(string $hex): array
{
    $h = ltrim($hex, '#');
    return [hexdec(substr($h, 0, 2)), hexdec(substr($h, 2, 2)), hexdec(substr($h, 4, 2))];
}

function color_mix(string $a, string $b, float $t): string
{
    [$r1, $g1, $b1] = color_rgb($a);
    [$r2, $g2, $b2] = color_rgb($b);
    return sprintf('#%02X%02X%02X', (int)round($r1 + ($r2 - $r1) * $t), (int)round($g1 + ($g2 - $g1) * $t), (int)round($b1 + ($b2 - $b1) * $t));
}

function color_lum(string $hex): float
{
    $f = fn(int $c) => ($c / 255) <= 0.03928 ? ($c / 255) / 12.92 : pow((($c / 255) + 0.055) / 1.055, 2.4);
    [$r, $g, $b] = color_rgb($hex);
    return 0.2126 * $f($r) + 0.7152 * $f($g) + 0.0722 * $f($b);
}

/** Kontrastverhältnis nach WCAG (1 bis 21). */
function color_contrast(string $a, string $b): float
{
    $la = color_lum($a);
    $lb = color_lum($b);
    if ($la < $lb) {
        [$la, $lb] = [$lb, $la];
    }
    return ($la + 0.05) / ($lb + 0.05);
}

/** Farbe $fg schrittweise Richtung $toward verschieben, bis sie auf $bg mindestens das Kontrastverhältnis $min erreicht. */
function color_ensure(string $fg, string $bg, float $min, string $toward): string
{
    for ($i = 0; $i <= 20 && color_contrast($fg, $bg) < $min; $i++) {
        $fg = color_mix($fg, $toward, 0.1);
    }
    return $fg;
}

/** Grundfarben der gewählten Palette (voreingestellt oder eigene). */
function palette_base(array $colors): array
{
    $presets = palette_presets();
    $key = (string)($colors['palette'] ?? 'standard');
    if ($key !== 'custom' && isset($presets[$key])) {
        return $presets[$key][2];
    }
    $d = $presets['standard'][2];
    return [
        'paper' => color_hex((string)($colors['c_paper'] ?? ''), $d['paper']), 'ink' => color_hex((string)($colors['c_ink'] ?? ''), $d['ink']),
        'accent' => color_hex((string)($colors['c_accent'] ?? ''), $d['accent']), 'teal' => color_hex((string)($colors['c_teal'] ?? ''), $d['teal']),
        'rec' => color_hex((string)($colors['c_rec'] ?? ''), $d['rec']),
    ];
}

/** Alle Farbwerte der Seite (CSS-Variable ohne „--“ => Hex). */
function palette_tokens(array $base): array
{
    $P = $base['paper'];
    $I = $base['ink'];
    $A = $base['accent'];
    $T = $base['teal'];
    $w = '#FFFFFF';
    if ($base === palette_presets()['standard'][2]) {
        // die jetzige Seite: genau die bisherigen Werte
        return ['paper' => $P, 'ink' => $I, 'accent' => $A, 'teal' => $T, 'rec' => $base['rec'], 'mute' => '#52605E', 'line' => '#CDBBA3', 'mint' => '#C9DEDA',
            'sand' => '#E8DDCB', 'sand2' => '#EFE6D6', 'sand-d' => '#E3D6BF', 'body' => '#34403F', 'card' => '#FBF6EE', 'acc-lt' => '#8FCFCB', 'acc-mid' => '#6FB9B4',
            'tint1' => '#E4F0EE', 'tint2' => '#D5E7E4', 'tint3' => '#BFE0DB', 'teal-2' => '#1F5A60', 'ink-2' => '#4A5B5C'];
    }
    return [
        'paper' => $P, 'ink' => $I, 'accent' => $A, 'teal' => $T, 'rec' => $base['rec'],
        'mute' => color_ensure(color_mix($I, $P, 0.3), $P, 4.6, $I),
        'line' => color_mix($P, $I, 0.2), 'mint' => color_mix($A, $w, 0.78),
        'sand' => color_mix($P, $I, 0.05), 'sand2' => color_mix($P, $I, 0.03), 'sand-d' => color_mix($P, $I, 0.09),
        'body' => color_mix($I, $P, 0.12), 'card' => color_mix($P, $w, 0.65),
        'acc-lt' => color_ensure(color_mix($A, $w, 0.55), $T, 4.6, $w), 'acc-mid' => color_mix($A, $w, 0.45),
        'tint1' => color_mix($A, $w, 0.9), 'tint2' => color_mix($A, $w, 0.86), 'tint3' => color_mix($A, $w, 0.76),
        'teal-2' => color_mix($T, $w, 0.12), 'ink-2' => color_mix($I, $P, 0.3),
    ];
}

/** Prüfungen für die Lesbarkeit: [Beschreibung, Verhältnis, Mindestwert]. */
function palette_checks(array $base): array
{
    $t = palette_tokens($base);
    return [
        ['Text auf Hintergrund', color_contrast($t['ink'], $t['paper']), 4.5],
        ['Akzentfarbe auf Hintergrund (Zahlen, kleine Beschriftungen)', color_contrast($t['accent'], $t['paper']), 4.5],
        ['Schrift auf Knöpfen (hell auf Akzentfarbe)', color_contrast($t['card'], $t['accent']), 4.5],
        ['Heller Text auf dunklen Flächen', color_contrast($t['paper'], $t['teal']), 4.5],
        ['REC-Rot auf Hintergrund', color_contrast($t['rec'], $t['paper']), 3.0],
    ];
}

/** Töne, die eine Spur aus der Palette wählen kann: Schlüssel => Name. */
function track_tones(): array
{
    return ['teal' => 'Dunkle Fläche (Palette)', 'accent' => 'Akzentfarbe (Palette)', 'ink' => 'Text-Ton (Palette)', 'mint' => 'Heller Ton (Palette)', 'sand' => 'Sand (Palette)', 'rec' => 'REC-Rot (Palette)', 'custom' => 'Eigene Farbe'];
}

/** Nächster Palettenton zu einer Hex-Farbe (nach der Standardpalette); „custom“, wenn keiner nah genug liegt. */
function track_tone_from_hex(string $hex): string
{
    $std = palette_tokens(palette_presets()['standard'][2]);
    $best = 'custom';
    $bd = 70.0;
    [$r, $g, $b] = color_rgb(color_hex($hex, '#0B3F44'));
    foreach (array_keys(track_tones()) as $k) {
        if ($k === 'custom' || !isset($std[$k])) {
            continue;
        }
        [$r2, $g2, $b2] = color_rgb($std[$k]);
        $d = sqrt(($r - $r2) ** 2 + ($g - $g2) ** 2 + ($b - $b2) ** 2);
        if ($d < $bd) {
            $bd = $d;
            $best = $k;
        }
    }
    return $best;
}

/** Balken- und Schriftfarbe einer Spur: Palettenton (Schrift automatisch hell oder dunkel) oder eigene Farben. */
function track_colors(array $t): array
{
    $tone = (string)($t['tone'] ?? '');
    $tok = palette_tokens(palette_base(setting('colors')));
    if ($tone !== '' && $tone !== 'custom' && isset($tok[$tone])) {
        $bg = $tok[$tone];
        $fg = color_contrast($tok['paper'], $bg) >= color_contrast($tok['ink'], $bg) ? $tok['paper'] : $tok['ink'];
        return [$bg, $fg];
    }
    return [css_color($t['bg'] ?? '', '#0B3F44'), css_color($t['fg'] ?? '', '#F3ECDF')];
}

/** Variablen der Palette als <style> für die Seite. */
function color_head(array $colors): string
{
    $css = '';
    foreach (palette_tokens(palette_base($colors)) as $k => $v) {
        $css .= '--' . $k . ':' . $v . ';';
    }
    return '<style>:root{' . $css . "}</style>\n";
}
