<?php
declare(strict_types=1);

// ---------- Lesen ----------

function field_defaults(array $fields): array
{
    $d = [];
    foreach ($fields as $f) {
        if ($f['type'] === 'section') {
            continue;
        }
        $d[$f['key']] = $f['default'] ?? ($f['type'] === 'bool' ? false : '');
    }
    return $d;
}

function row_to_item(array $r, array $fields): array
{
    $data = json_decode((string)$r['data'], true);
    $data = is_array($data) ? $data : [];
    return array_merge(field_defaults($fields), $data, [
        '_id' => (int)$r['id'], '_sort' => (int)$r['sort'], '_deleted' => $r['deleted_at'] !== null ? (int)$r['deleted_at'] : null,
        '_updated' => (int)$r['updated_at'],
    ]);
}

/** Liste einer Sammlung (ohne Papierkorb). */
function items(string $coll, bool $trash = false): array
{
    $def = schema()['collections'][$coll] ?? null;
    if (!$def) {
        return [];
    }
    if ($trash) {
        $rows = q('SELECT * FROM ar_items WHERE coll = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC', [$coll])->fetchAll();
    } else {
        $rows = items_rows()[$coll] ?? [];
    }
    return array_map(fn($r) => row_to_item($r, $def['fields']), $rows);
}

/** Alle sichtbaren Einträge in EINER Abfrage laden (statt einer pro Liste). */
function items_rows(bool $reset = false): array
{
    static $all = null;
    if ($reset) {
        $all = null;
        return [];
    }
    if ($all === null) {
        $all = [];
        foreach (q('SELECT * FROM ar_items WHERE deleted_at IS NULL ORDER BY sort ASC, id ASC')->fetchAll() as $r) {
            $all[$r['coll']][] = $r;
        }
    }
    return $all;
}

function settings_rows(bool $reset = false): array
{
    static $all = null;
    if ($reset) {
        $all = null;
        return [];
    }
    if ($all === null) {
        $all = [];
        foreach (q('SELECT grp, data FROM ar_settings')->fetchAll() as $r) {
            $all[$r['grp']] = $r['data'];
        }
    }
    return $all;
}

function item(int $id): ?array
{
    $r = q('SELECT * FROM ar_items WHERE id = ?', [$id])->fetch();
    if (!$r) {
        return null;
    }
    $def = schema()['collections'][$r['coll']] ?? null;
    return $def ? ['coll' => $r['coll']] + row_to_item($r, $def['fields']) : null;
}

function setting(string $grp): array
{
    $def = schema()['groups'][$grp] ?? null;
    if (!$def) {
        return [];
    }
    $r = settings_rows()[$grp] ?? null;
    $data = $r ? json_decode((string)$r, true) : [];
    return array_merge(field_defaults($def['fields']), is_array($data) ? $data : []);
}

// ---------- Schreiben ----------

function save_item(string $coll, ?int $id, array $data, string $who): int
{
    items_rows(true);
    settings_rows(true);
    $now = time();
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($id) {
        q('UPDATE ar_items SET data = ?, updated_at = ?, updated_by = ? WHERE id = ? AND coll = ?', [$json, $now, $who, $id, $coll]);
        return $id;
    }
    $max = (int)q('SELECT COALESCE(MAX(sort), 0) FROM ar_items WHERE coll = ?', [$coll])->fetchColumn();
    q('INSERT INTO ar_items (coll, data, sort, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)', [$coll, $json, $max + 1, $now, $now, $who]);
    return (int)db()->lastInsertId();
}

function save_setting(string $grp, array $data, string $who): void
{
    items_rows(true);
    settings_rows(true);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $exists = q('SELECT 1 FROM ar_settings WHERE grp = ?', [$grp])->fetchColumn();
    if ($exists) {
        q('UPDATE ar_settings SET data = ?, updated_at = ?, updated_by = ? WHERE grp = ?', [$json, time(), $who, $grp]);
    } else {
        q('INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES (?,?,?,?)', [$grp, $json, time(), $who]);
    }
}

function trash_item(int $id): void
{
    items_rows(true);
    settings_rows(true);
    q('UPDATE ar_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL', [time(), $id]);
}

function restore_item(int $id): void
{
    items_rows(true);
    settings_rows(true);
    $r = q('SELECT coll FROM ar_items WHERE id = ?', [$id])->fetch();
    if (!$r) {
        return;
    }
    $max = (int)q('SELECT COALESCE(MAX(sort), 0) FROM ar_items WHERE coll = ? AND deleted_at IS NULL', [$r['coll']])->fetchColumn();
    q('UPDATE ar_items SET deleted_at = NULL, sort = ? WHERE id = ?', [$max + 1, $id]);
}

function purge_item(int $id): void
{
    items_rows(true);
    settings_rows(true);
    q('DELETE FROM ar_items WHERE id = ? AND deleted_at IS NOT NULL', [$id]);
    cleanup_uploads();
}

function move_item(int $id, string $dir): void
{
    items_rows(true);
    settings_rows(true);
    $r = q('SELECT coll FROM ar_items WHERE id = ? AND deleted_at IS NULL', [$id])->fetch();
    if (!$r) {
        return;
    }
    $ids = array_map('intval', array_column(q('SELECT id FROM ar_items WHERE coll = ? AND deleted_at IS NULL ORDER BY sort ASC, id ASC', [$r['coll']])->fetchAll(), 'id'));
    $i = array_search($id, $ids, true);
    if ($i === false) {
        return;
    }
    $j = $dir === 'up' ? $i - 1 : $i + 1;
    if ($j < 0 || $j >= count($ids)) {
        return;
    }
    [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
    foreach ($ids as $n => $iid) {
        q('UPDATE ar_items SET sort = ? WHERE id = ?', [$n + 1, $iid]);
    }
}

// ---------- Eingaben prüfen ----------

/**
 * @return array{0: array, 1: string[]} bereinigte Daten, Fehlermeldungen
 */
function sanitize_fields(array $fields, array $post, array $files, array $old): array
{
    $out = [];
    $errors = [];
    foreach ($fields as $f) {
        $t = $f['type'];
        if ($t === 'section') {
            continue;
        }
        $k = $f['key'];
        $raw = $post[$k] ?? '';
        $max = $f['max'] ?? 500;
        $v = '';
        switch ($t) {
            case 'bool':
                $v = !empty($post[$k]);
                break;
            case 'text':
            case 'markup':
                $v = trim(preg_replace('~[\x00-\x08\x0B\x0C\x0E-\x1F]~', '', (string)(is_array($raw) ? '' : $raw)));
                $v = preg_replace('~\s*[\r\n]+\s*~', ' ', $v);
                break;
            case 'textarea':
                $v = trim(str_replace("\r\n", "\n", preg_replace('~[\x00-\x08\x0B\x0C\x0E-\x1F]~', '', (string)(is_array($raw) ? '' : $raw))));
                break;
            case 'url':
                $v = safe_url((string)(is_array($raw) ? '' : $raw));
                if (trim((string)$raw) !== '' && $v === '') {
                    $errors[] = $f['label'] . ': ungültiger Link.';
                }
                break;
            case 'date':
                $v = trim((string)$raw);
                if ($v !== '' && (!preg_match('~^\d{4}-\d{2}-\d{2}$~', $v) || !checkdate((int)substr($v, 5, 2), (int)substr($v, 8, 2), (int)substr($v, 0, 4)))) {
                    $errors[] = $f['label'] . ': ungültiges Datum.';
                    $v = '';
                }
                break;
            case 'month':
                $v = trim((string)$raw);
                if ($v !== '' && !preg_match('~^\d{4}-(0[1-9]|1[0-2])$~', $v)) {
                    $errors[] = $f['label'] . ': ungültiger Monat.';
                    $v = '';
                }
                break;
            case 'number':
            case 'range':
                $s = str_replace(',', '.', trim((string)$raw));
                if ($s === '') {
                    $v = '';
                } elseif (!is_numeric($s)) {
                    $errors[] = $f['label'] . ': keine Zahl.';
                } else {
                    $n = (float)$s;
                    $v = max($f['min'] ?? -1e9, min($f['max'] ?? 1e9, $n));
                }
                break;
            case 'color':
                $v = preg_match('~^#[0-9a-fA-F]{6}$~', (string)$raw) ? strtolower((string)$raw) : ($f['default'] ?? '#000000');
                break;
            case 'select':
                $opts = select_options($f);
                $v = (string)$raw;
                if ($v !== '' && !isset($opts[$v])) {
                    $v = $f['default'] ?? '';
                }
                if ($v === '' && isset($f['default']) && !isset($f['empty'])) {
                    $v = $f['default'];
                }
                break;
            case 'image':
            case 'pdf':
                $v = (string)($old[$k] ?? '');
                if (!empty($post['_remove_' . $k])) {
                    $v = '';
                }
                if (!empty($files[$k]['name']) && ($files[$k]['error'] ?? 4) !== UPLOAD_ERR_NO_FILE) {
                    try {
                        $v = $t === 'image' ? store_image($files[$k]) : store_pdf($files[$k]);
                    } catch (RuntimeException $ex) {
                        $errors[] = $f['label'] . ': ' . $ex->getMessage();
                    }
                }
                break;
        }
        if (is_string($v) && $t !== 'image' && $t !== 'pdf' && mb_strlen($v) > $max) {
            $errors[] = $f['label'] . ': höchstens ' . $max . ' Zeichen.';
            $v = mb_substr($v, 0, $max);
        }
        if (!empty($f['required']) && ($v === '' || $v === null) && $t !== 'bool') {
            $errors[] = $f['label'] . ' ist ein Pflichtfeld.';
        }
        $out[$k] = $v;
    }
    return [$out, $errors];
}

function select_options(array $f): array
{
    if (!empty($f['options'])) {
        return $f['options'];
    }
    if (($f['options_from'] ?? '') === 'tracks') {
        $o = [];
        foreach (items('tracks') as $t) {
            $o[$t['code']] = $t['code'] . ' · ' . $t['label'];
        }
        return $o;
    }
    return [];
}

// ---------- Uploads ----------

function upload_dir(): string
{
    $d = AR_ROOT . '/uploads';
    if (!is_dir($d)) {
        @mkdir($d, 0755, true);
    }
    return $d;
}

function check_upload(array $file): void
{
    $err = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
        throw new RuntimeException('Datei zu groß (Server-Limit ' . ini_get('upload_max_filesize') . ').');
    }
    if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        throw new RuntimeException('Upload fehlgeschlagen.');
    }
    if ($file['size'] > (int)cfg('max_upload_mb', 8) * 1048576) {
        throw new RuntimeException('Datei zu groß (max. ' . (int)cfg('max_upload_mb', 8) . ' MB).');
    }
}

function store_image(array $file): string
{
    check_upload($file);
    $info = @getimagesize($file['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpeg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) {
        throw new RuntimeException('Bitte JPG, PNG oder WebP hochladen.');
    }
    if ($info[0] * $info[1] > 40000000) {
        throw new RuntimeException('Bild hat zu viele Pixel.');
    }
    if (!function_exists('imagecreatefromstring')) {
        throw new RuntimeException('Bildverarbeitung (GD) ist auf dem Server nicht verfügbar.');
    }
    $img = @imagecreatefromstring((string)file_get_contents($file['tmp_name']));
    if (!$img) {
        throw new RuntimeException('Bild konnte nicht gelesen werden.');
    }
    // Ausrichtung laut EXIF
    if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $ex = @exif_read_data($file['tmp_name']);
        $rot = [3 => 180, 6 => -90, 8 => 90][$ex['Orientation'] ?? 0] ?? 0;
        if ($rot) {
            $img = imagerotate($img, $rot, 0) ?: $img;
        }
    }
    $w = imagesx($img);
    $h = imagesy($img);
    $maxEdge = 2400;
    if (max($w, $h) > $maxEdge) {
        $r = $maxEdge / max($w, $h);
        $n = imagescale($img, (int)round($w * $r), (int)round($h * $r));
        if ($n) {
            $img = $n;
        }
    }
    $hasAlpha = $info[2] !== IMAGETYPE_JPEG;
    imagesavealpha($img, true);
    $name = bin2hex(random_bytes(10));
    $dir = upload_dir();
    // Metadaten (EXIF/GPS) werden durch das Neu-Kodieren entfernt.
    if (function_exists('imagewebp')) {
        $name .= '.webp';
        $ok = imagewebp($img, "$dir/$name", 86);
    } elseif ($hasAlpha) {
        $name .= '.png';
        $ok = imagepng($img, "$dir/$name", 6);
    } else {
        $name .= '.jpg';
        $ok = imagejpeg($img, "$dir/$name", 86);
    }
    if (!$ok) {
        throw new RuntimeException('Bild konnte nicht gespeichert werden.');
    }
    @chmod("$dir/$name", 0644);
    return $name;
}

function store_pdf(array $file): string
{
    check_upload($file);
    $head = (string)file_get_contents($file['tmp_name'], false, null, 0, 5);
    if ($head !== '%PDF-') {
        throw new RuntimeException('Bitte eine PDF-Datei hochladen.');
    }
    $name = bin2hex(random_bytes(10)) . '.pdf';
    if (!move_uploaded_file($file['tmp_name'], upload_dir() . '/' . $name)) {
        throw new RuntimeException('Datei konnte nicht gespeichert werden.');
    }
    @chmod(upload_dir() . '/' . $name, 0644);
    return $name;
}

/** Löscht Dateien in uploads/, die nirgends mehr verwendet werden (auch nicht im Papierkorb). */
function cleanup_uploads(): void
{
    $dir = upload_dir();
    $blob = '';
    foreach (q('SELECT data FROM ar_items')->fetchAll() as $r) {
        $blob .= $r['data'];
    }
    foreach (q('SELECT data FROM ar_settings')->fetchAll() as $r) {
        $blob .= $r['data'];
    }
    foreach (glob($dir . '/*') ?: [] as $f) {
        $n = basename($f);
        if ($n[0] === '.' || str_starts_with($n, 'seed-')) {
            continue;
        }
        if (!str_contains($blob, '"' . $n . '"') && filemtime($f) < time() - 600) {
            @unlink($f);
        }
    }
}
