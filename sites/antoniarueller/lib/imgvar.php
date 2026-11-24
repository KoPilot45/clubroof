<?php
declare(strict_types=1);

/**
 * Automatische Bildgrößen für quadratische Ausschnitte (Kacheln im Showreel, Featured).
 *
 * Aus dem Original (höchstens 1600 px) entstehen beim ersten Aufruf quadratische WebP-Varianten in
 * uploads/v/, ausgeschnitten um den Fokuspunkt des Bildes (wie der CSS-Ausschnitt). Die Seite bietet sie als
 * srcset an; jedes Gerät lädt nur die passende Größe. Dateiname: <name>.<breite>.<fx>x<fy>.<änderungszeit>.webp
 * Fehlt GD/WebP oder schlägt die Umrechnung fehl, nutzt die Seite das Original.
 */
const IMGVAR_WIDTHS = [360, 540, 720, 1080];
const IMGVAR_QUALITY = 72;

function imgvar_dir(): string
{
    return AR_ROOT . '/uploads/v';
}

/** Fokuspunkt „x,y“ (Prozent) → ganze Prozentwerte, Standard Mitte. */
function imgvar_focus(string $focus): array
{
    if (preg_match('~^(\d{1,3}(?:\.\d)?),(\d{1,3}(?:\.\d)?)$~', $focus, $m)) {
        return [max(0, min(100, (int)round((float)$m[1]))), max(0, min(100, (int)round((float)$m[2])))];
    }
    return [50, 50];
}

/**
 * Quadratische Varianten eines Bildes (erzeugt fehlende).
 * @return array{src: string, srcset: string, size: int}|array{} leer = Original verwenden
 */
function img_square_set(string $name, string $focus = ''): array
{
    static $off = false;
    if ($off || !preg_match('~^([a-z0-9_-]+)\.(jpg|png|webp)$~', $name, $nm)) {
        return [];
    }
    $path = AR_ROOT . '/uploads/' . $name;
    $mt = @filemtime($path);
    $info = $mt ? @getimagesize($path) : false;
    if (!$info) {
        return [];
    }
    if (!function_exists('imagewebp') || !function_exists('imagecreatefromstring')) {
        $off = true;
        return [];
    }
    [$w, $h] = $info;
    $side = min($w, $h);
    $widths = array_values(array_filter(IMGVAR_WIDTHS, fn($x) => $x <= $side));
    if (!$widths) {
        return [];
    }
    // Liegt die kurze Bildseite deutlich über der größten Stufe (z. B. 1000 px), kommt sie als letzte Größe dazu
    if ($side <= 1080 && $side >= max($widths) * 1.12) {
        $widths[] = $side;
    }
    [$fx, $fy] = imgvar_focus($focus);
    $tag = base_convert((string)$mt, 10, 36);
    $dir = imgvar_dir();
    $files = [];
    $missing = [];
    foreach ($widths as $vw) {
        $f = $nm[1] . '.' . $vw . '.' . $fx . 'x' . $fy . '.' . $tag . '.webp';
        $files[$vw] = $f;
        if (!is_file($dir . '/' . $f)) {
            $missing[] = $vw;
        }
    }
    if ($missing) {
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            return [];
        }
        $src = @imagecreatefromstring((string)@file_get_contents($path));
        if (!$src) {
            return [];
        }
        $x0 = (int)round(($w - $side) * $fx / 100);
        $y0 = (int)round(($h - $side) * $fy / 100);
        foreach ($missing as $vw) {
            $dst = imagecreatetruecolor($vw, $vw);
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagecopyresampled($dst, $src, 0, 0, $x0, $y0, $vw, $vw, $side, $side);
            $tmp = $dir . '/.tmp' . bin2hex(random_bytes(4));
            if (@imagewebp($dst, $tmp, IMGVAR_QUALITY) && @rename($tmp, $dir . '/' . $files[$vw])) {
                @chmod($dir . '/' . $files[$vw], 0644);
            } else {
                @unlink($tmp);
                unset($files[$vw]);
            }
        }
        if (!$files) {
            return [];
        }
    }
    $set = [];
    foreach ($files as $vw => $f) {
        if (is_file($dir . '/' . $f)) {
            $set[$vw] = AR_BASE . '/uploads/v/' . $f . ' ' . $vw . 'w';
        }
    }
    if (!$set) {
        return [];
    }
    ksort($set);
    // Vorgabe-Bild für Browser ohne srcset: die Variante, die 720 px am nächsten liegt
    $pick = array_keys($set);
    $best = $pick[0];
    foreach ($pick as $vw) {
        if (abs($vw - 720) < abs($best - 720)) {
            $best = $vw;
        }
    }
    return ['src' => AR_BASE . '/uploads/v/' . $files[$best], 'srcset' => implode(', ', $set), 'size' => $best];
}

/** Alle Varianten eines Bildes löschen (beim Ersetzen, Umbenennen, Löschen). */
function purge_variants(string $name): int
{
    $n = 0;
    if (preg_match('~^([a-z0-9_-]+)\.(jpg|png|webp)$~', $name, $m)) {
        foreach (glob(imgvar_dir() . '/' . $m[1] . '.*.webp') ?: [] as $f) {
            if (@unlink($f)) {
                $n++;
            }
        }
    }
    return $n;
}

/** Alle erzeugten Varianten: [Anzahl, Bytes]. */
function variants_stats(): array
{
    $c = 0;
    $b = 0;
    foreach (glob(imgvar_dir() . '/*.webp') ?: [] as $f) {
        $c++;
        $b += (int)filesize($f);
    }
    return [$c, $b];
}

function purge_all_variants(): int
{
    $n = 0;
    foreach (glob(imgvar_dir() . '/*.webp') ?: [] as $f) {
        if (@unlink($f)) {
            $n++;
        }
    }
    return $n;
}
