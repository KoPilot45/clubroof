<?php
declare(strict_types=1);

/** Zeitskala für Sendeplan und Zeitstrahl: Monate (bis 14 Monate Spanne), Quartale (bis 48 Monate) oder Jahre. */
function overview_scale(array $clips): array
{
    $ms = [];
    $undated = false;
    foreach ($clips as $c) {
        if (preg_match('~^(\d{4})-(\d{2})~', (string)$c['date'], $m)) {
            $ms[] = (int)$m[1] * 12 + (int)$m[2] - 1;
        } else {
            $undated = true;
        }
    }
    if (!$ms) {
        return ['unit' => 'y', 'keys' => [], 'labels' => [], 'undated' => $undated];
    }
    $min = min($ms);
    $max = max($ms);
    $span = $max - $min + 1;
    $unit = $span <= 14 ? 'm' : ($span <= 48 ? 'q' : 'y');
    $keys = [];
    $labels = [];
    if ($unit === 'm') {
        for ($i = $min; $i <= $max; $i++) {
            $k = sprintf('%04d-%02d', intdiv($i, 12), $i % 12 + 1);
            $keys[] = $k;
            $labels[$k] = sprintf('%02d/%d', $i % 12 + 1, intdiv($i, 12));
        }
    } elseif ($unit === 'q') {
        for ($i = intdiv($min, 3); $i <= intdiv($max, 3); $i++) {
            $k = sprintf('%04d-Q%d', intdiv($i, 4), $i % 4 + 1);
            $keys[] = $k;
            $labels[$k] = 'Q' . ($i % 4 + 1) . ' ' . intdiv($i, 4);
        }
    } else {
        for ($y = intdiv($min, 12); $y <= intdiv($max, 12); $y++) {
            $keys[] = (string)$y;
            $labels[(string)$y] = (string)$y;
        }
    }
    return ['unit' => $unit, 'keys' => $keys, 'labels' => $labels, 'undated' => $undated];
}

/** Schlüssel der Spalte, in die ein Datum gehört (leer = ohne Datum). */
function overview_key(array $scale, string $date): string
{
    if (!preg_match('~^(\d{4})-(\d{2})~', $date, $m)) {
        return '';
    }
    return match ($scale['unit']) {
        'm' => $m[1] . '-' . $m[2],
        'q' => $m[1] . '-Q' . (intdiv((int)$m[2] - 1, 3) + 1),
        default => $m[1],
    };
}

/** Beiträge nach Datum aufsteigend, ohne Datum am Ende (Reihenfolge der Liste bleibt sonst erhalten). */
function overview_sorted(array $clips): array
{
    $idx = array_keys($clips);
    usort($idx, function ($a, $b) use ($clips) {
        $da = (string)$clips[$a]['date'];
        $db = (string)$clips[$b]['date'];
        if (($da === '') !== ($db === '')) {
            return $da === '' ? 1 : -1;
        }
        return [$da, $a] <=> [$db, $b];
    });
    return array_map(fn($i) => $clips[$i], $idx);
}

/** Nummer des neuesten datierten Beitrags (für die Marke „NEU“), sonst leer. */
function overview_newest(array $clips): string
{
    $best = '';
    $id = '';
    foreach ($clips as $c) {
        if ((string)$c['date'] !== '' && (string)$c['date'] > $best) {
            $best = (string)$c['date'];
            $id = (string)$c['_id'];
        }
    }
    return $id;
}
