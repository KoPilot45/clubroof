<?php
declare(strict_types=1);

const MEDIA_RE = '~^[a-z0-9_-]+\.(jpg|png|webp|pdf)$~';

/** Bilder und PDFs in uploads/ (neueste zuerst). */
function media_list(): array
{
    $out = [];
    foreach (glob(upload_dir() . '/*') ?: [] as $f) {
        $n = basename($f);
        if (!preg_match(MEDIA_RE, $n)) {
            continue;
        }
        $pdf = str_ends_with($n, '.pdf');
        $i = $pdf ? false : @getimagesize($f);
        $out[] = ['name' => $n, 'url' => upload_url($n), 'kind' => $pdf ? 'pdf' : 'image', 'size' => (int)filesize($f), 'w' => (int)($i[0] ?? 0), 'h' => (int)($i[1] ?? 0), 'time' => (int)filemtime($f)];
    }
    usort($out, fn($a, $b) => $b['time'] <=> $a['time']);
    return $out;
}

function collect_files(mixed $v, array &$found): void
{
    if (is_array($v)) {
        foreach ($v as $x) {
            collect_files($x, $found);
        }
    } elseif (is_string($v) && preg_match(MEDIA_RE, $v)) {
        $found[$v] = true;
    }
}

/** Dateiname => Liste der Stellen, an denen die Datei verwendet wird. */
function media_usage(): array
{
    $s = schema();
    $use = [];
    foreach (q('SELECT id, coll, data, draft, deleted_at FROM ar_items')->fetchAll() as $r) {
        $def = $s['collections'][$r['coll']] ?? null;
        if (!$def) {
            continue; // alte, nicht mehr verwendete Listen (z. B. die frühere Liste „stations“) zählen nicht als Verwendung
        }
        $found = [];
        collect_files(json_arr($r['data']) ?? [], $found);
        $d = json_arr($r['draft']);
        $dd = $d ?? json_arr($r['data']) ?? [];
        collect_files($d ?? [], $found);
        $title = $def ? trim((string)($dd[$def['title']] ?? '')) : '';
        foreach (array_keys($found) as $f) {
            $use[$f][] = [
                'label' => ($def['singular'] ?? $r['coll']) . ($title !== '' ? ': ' . mb_strimwidth($title, 0, 40, '…') : '') . ($r['deleted_at'] !== null ? ' (Papierkorb)' : ''),
                'url' => $r['deleted_at'] === null ? a('p=edit&c=' . $r['coll'] . '&id=' . $r['id']) : a('p=trash'),
            ];
        }
    }
    foreach (q('SELECT grp, data, draft FROM ar_settings')->fetchAll() as $r) {
        if (!isset($s['groups'][$r['grp']])) {
            continue;
        }
        $found = [];
        collect_files(json_arr($r['data']) ?? [], $found);
        collect_files(json_arr($r['draft']) ?? [], $found);
        foreach (array_keys($found) as $f) {
            $use[$f][] = ['label' => $s['groups'][$r['grp']]['label'], 'url' => a('p=group&g=' . $r['grp'])];
        }
    }
    return $use;
}

/** Mehrfach-Upload (<input type="file" name="files[]" multiple>). */
function store_uploaded_images(array $files): array
{
    $ok = 0;
    $errors = [];
    $n = is_array($files['name'] ?? null) ? count($files['name']) : 0;
    for ($i = 0; $i < $n; $i++) {
        if (($files['error'][$i] ?? 4) === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        $one = ['name' => $files['name'][$i], 'type' => $files['type'][$i], 'tmp_name' => $files['tmp_name'][$i], 'error' => $files['error'][$i], 'size' => $files['size'][$i]];
        try {
            if ((string)@file_get_contents((string)$one['tmp_name'], false, null, 0, 5) === '%PDF-') {
                store_pdf($one);
            } else {
                store_image($one);
            }
            $ok++;
        } catch (RuntimeException $e) {
            $errors[] = $files['name'][$i] . ': ' . $e->getMessage();
        }
    }
    return [$ok, $errors];
}


/**
 * Vorhandene Bilder mit den aktuellen Einstellungen neu komprimieren (Dateiname und Format bleiben,
 * es wird nur ersetzt, wenn die Datei dadurch spürbar kleiner wird). Gibt [geprüft, ersetzt, gesparte Bytes] zurück.
 */
function optimize_media(): array
{
    if (!function_exists('imagecreatefromstring')) {
        return [0, 0, 0];
    }
    $cfg = image_settings();
    $checked = $replaced = $saved = 0;
    foreach (media_list() as $m) {
        if ($m['kind'] === 'pdf') {
            continue;
        }
        $path = upload_dir() . '/' . $m['name'];
        $ext = strtolower(pathinfo($m['name'], PATHINFO_EXTENSION));
        $img = @imagecreatefromstring((string)@file_get_contents($path));
        if (!$img) {
            continue;
        }
        $checked++;
        $w = imagesx($img);
        $h = imagesy($img);
        if (max($w, $h) > $cfg['max']) {
            $r = $cfg['max'] / max($w, $h);
            $n = imagescale($img, (int)round($w * $r), (int)round($h * $r));
            if ($n) {
                $img = $n;
            }
        }
        imagesavealpha($img, true);
        $tmp = $path . '.tmp';
        $ok = match ($ext) {
            'webp' => function_exists('imagewebp') && imagewebp($img, $tmp, $cfg['quality']),
            'png' => imagepng($img, $tmp, 7),
            default => imagejpeg($img, $tmp, $cfg['quality']),
        };
        $old = (int)filesize($path);
        $new = $ok ? (int)@filesize($tmp) : 0;
        if ($ok && $new > 0 && $new < $old * 0.95) {
            @rename($tmp, $path);
            @chmod($path, 0644);
            $replaced++;
            $saved += $old - $new;
        } else {
            @unlink($tmp);
        }
    }
    return [$checked, $replaced, $saved];
}
