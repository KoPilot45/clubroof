<?php
declare(strict_types=1);

const MEDIA_RE = '~^[a-z0-9_-]+\.(jpg|png|webp|pdf)$~';

/** Bilder in uploads/ (neueste zuerst). */
function media_list(): array
{
    $out = [];
    foreach (glob(upload_dir() . '/*') ?: [] as $f) {
        $n = basename($f);
        if (!preg_match('~^[a-z0-9_-]+\.(jpg|png|webp)$~', $n)) {
            continue;
        }
        $i = @getimagesize($f);
        $out[] = ['name' => $n, 'url' => upload_url($n), 'size' => (int)filesize($f), 'w' => (int)($i[0] ?? 0), 'h' => (int)($i[1] ?? 0), 'time' => (int)filemtime($f)];
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
    foreach (q('SELECT coll, data, draft, deleted_at FROM ar_items')->fetchAll() as $r) {
        $def = $s['collections'][$r['coll']] ?? null;
        $found = [];
        collect_files(json_arr($r['data']) ?? [], $found);
        $d = json_arr($r['draft']);
        $dd = $d ?? json_arr($r['data']) ?? [];
        collect_files($d ?? [], $found);
        $title = $def ? trim((string)($dd[$def['title']] ?? '')) : '';
        foreach (array_keys($found) as $f) {
            $use[$f][] = ($def['singular'] ?? $r['coll']) . ($title !== '' ? ': ' . mb_strimwidth($title, 0, 40, '…') : '') . ($r['deleted_at'] !== null ? ' (Papierkorb)' : '');
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
            $use[$f][] = $s['groups'][$r['grp']]['label'];
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
            store_image($one);
            $ok++;
        } catch (RuntimeException $e) {
            $errors[] = $files['name'][$i] . ': ' . $e->getMessage();
        }
    }
    return [$ok, $errors];
}
