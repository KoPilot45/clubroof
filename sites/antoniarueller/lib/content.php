<?php
declare(strict_types=1);

// ---------- Sprache, Vorschau ----------

function current_lang(): string
{
    return defined('AR_LANG') ? (string)AR_LANG : 'de';
}

/** Vorschau: Entwürfe statt veröffentlichter Fassung zeigen (nur für Angemeldete). */
function preview_mode(?bool $set = null): bool
{
    static $p = false;
    if ($set !== null) {
        $p = $set;
        items_rows(true);
        settings_rows(true);
    }
    return $p;
}

/** Felder, die nie übersetzt werden (Namen, Kürzel, technische Werte). */
const NO_TRANSLATE = ['first', 'last', 'tag_name', 'code', 'tc', 'email', 'outlet', 'show', 'number', 'org', 'name', 'country', 'google_verify', 'bing_verify', 'works_for', 'header_label', 'date_label', 'outlets', 'copyright', 'robots_extra', 'llms_summary', 'llms_extra', 'same_as', 'alumni', 'other_label'];

function field_translatable(array $f): bool
{
    if (!in_array($f['type'], ['text', 'textarea', 'markup'], true)) {
        return false;
    }
    if (isset($f['tr'])) {
        return (bool)$f['tr'];
    }
    return !in_array($f['key'], NO_TRANSLATE, true);
}

function apply_lang(array $vals, array $fields): array
{
    if (current_lang() === 'de') {
        return $vals;
    }
    foreach ($fields as $f) {
        if ($f['type'] !== 'section' && field_translatable($f)) {
            $en = $vals[$f['key'] . '_en'] ?? '';
            if (is_string($en) && trim($en) !== '') {
                $vals[$f['key']] = $en;
            }
        }
    }
    return $vals;
}

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

function json_arr(?string $s): ?array
{
    if ($s === null || $s === '') {
        return null;
    }
    $d = json_decode($s, true);
    return is_array($d) ? $d : null;
}

function row_to_item(array $r, array $fields, bool $admin = false): array
{
    $data = json_arr((string)$r['data']) ?? [];
    $draft = json_arr($r['draft'] ?? null);
    $eff = $admin ? ($draft ?? $data) : ((preview_mode() && $draft !== null) ? $draft : $data);
    $vals = array_merge(field_defaults($fields), $eff);
    if (!$admin) {
        $vals = apply_lang($vals, $fields);
    }
    return array_merge($vals, [
        '_id' => (int)$r['id'], '_sort' => (int)$r['sort'], '_deleted' => $r['deleted_at'] !== null ? (int)$r['deleted_at'] : null,
        '_updated' => (int)$r['updated_at'], '_updated_by' => (string)($r['updated_by'] ?? ''),
        '_live' => (int)($r['live'] ?? 1), '_draft' => $draft !== null,
    ]);
}

/** Liste einer Sammlung. $admin = auch unveröffentlichte Einträge, Entwurfsstand. */
function items(string $coll, bool $trash = false, bool $admin = false): array
{
    $def = schema()['collections'][$coll] ?? null;
    if (!$def) {
        return [];
    }
    if ($trash) {
        $rows = q('SELECT * FROM ar_items WHERE coll = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC', [$coll])->fetchAll();
        $admin = true;
    } elseif ($admin) {
        $rows = q('SELECT * FROM ar_items WHERE coll = ? AND deleted_at IS NULL ORDER BY sort ASC, id ASC', [$coll])->fetchAll();
    } else {
        $rows = items_rows()[$coll] ?? [];
    }
    return array_map(fn($r) => row_to_item($r, $def['fields'], $admin), $rows);
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
        // Erst nach dem Laden zuweisen: Die erste Abfrage kann Migrationen auslösen, die selbst lesen.
        $sql = 'SELECT * FROM ar_items WHERE deleted_at IS NULL' . (preview_mode() ? '' : ' AND live = 1') . ' ORDER BY sort ASC, id ASC';
        $loaded = [];
        foreach (q($sql)->fetchAll() as $r) {
            $loaded[$r['coll']][] = $r;
        }
        $all = $loaded;
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
        $loaded = [];
        foreach (q('SELECT grp, data, draft FROM ar_settings')->fetchAll() as $r) {
            $loaded[$r['grp']] = ['data' => $r['data'], 'draft' => $r['draft']];
        }
        $all = $loaded;
    }
    return $all;
}

function reset_content_cache(): void
{
    items_rows(true);
    settings_rows(true);
}

/** Einzelner Eintrag im Entwurfsstand (für den Admin), auch Papierkorb. */
function item(int $id): ?array
{
    $r = q('SELECT * FROM ar_items WHERE id = ?', [$id])->fetch();
    if (!$r) {
        return null;
    }
    $def = schema()['collections'][$r['coll']] ?? null;
    return $def ? ['coll' => $r['coll']] + row_to_item($r, $def['fields'], true) : null;
}

function setting(string $grp, bool $admin = false): array
{
    $def = schema()['groups'][$grp] ?? null;
    if (!$def) {
        return [];
    }
    $row = settings_rows()[$grp] ?? null;
    $data = json_arr($row['data'] ?? null) ?? [];
    $draft = json_arr($row['draft'] ?? null);
    $eff = $admin ? ($draft ?? $data) : ((preview_mode() && $draft !== null) ? $draft : $data);
    $vals = array_merge(field_defaults($def['fields']), $eff);
    return $admin ? $vals : apply_lang($vals, $def['fields']);
}

function setting_has_draft(string $grp): bool
{
    return (settings_rows()[$grp]['draft'] ?? null) !== null;
}

function setting_meta(string $grp): array
{
    $r = q('SELECT updated_at, updated_by FROM ar_settings WHERE grp = ?', [$grp])->fetch();
    return $r ? ['at' => (int)$r['updated_at'], 'by' => (string)($r['updated_by'] ?? '')] : ['at' => 0, 'by' => ''];
}

// ---------- Versionen ----------

function record_version(string $kind, string $ref, string $json, string $who): void
{
    q('INSERT INTO ar_versions (kind, ref, data, saved_by, saved_at) VALUES (?,?,?,?,?)', [$kind, $ref, $json, $who, time()]);
    $ids = q('SELECT id FROM ar_versions WHERE kind = ? AND ref = ? ORDER BY id DESC', [$kind, $ref])->fetchAll(PDO::FETCH_COLUMN);
    foreach (array_slice($ids, 25) as $old) {
        q('DELETE FROM ar_versions WHERE id = ?', [$old]);
    }
}

function versions(string $kind, string $ref): array
{
    return q('SELECT id, saved_by, saved_at, data FROM ar_versions WHERE kind = ? AND ref = ? ORDER BY id DESC LIMIT 25', [$kind, $ref])->fetchAll();
}

// ---------- Schreiben ----------

function enc(array $data): string
{
    return (string)json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** Speichert veröffentlicht ($publish) oder als Entwurf. */
function save_item(string $coll, ?int $id, array $data, string $who, bool $publish = true): int
{
    reset_content_cache();
    $now = time();
    $json = enc($data);
    if ($id) {
        if ($publish) {
            q('UPDATE ar_items SET data = ?, draft = NULL, live = 1, updated_at = ?, updated_by = ? WHERE id = ? AND coll = ?', [$json, $now, $who, $id, $coll]);
            record_version('item', (string)$id, $json, $who);
        } else {
            q('UPDATE ar_items SET draft = ?, updated_at = ?, updated_by = ? WHERE id = ? AND coll = ?', [$json, $now, $who, $id, $coll]);
        }
        return $id;
    }
    $max = (int)q('SELECT COALESCE(MAX(sort), 0) FROM ar_items WHERE coll = ?', [$coll])->fetchColumn();
    if ($publish) {
        q('INSERT INTO ar_items (coll, data, live, sort, created_at, updated_at, updated_by) VALUES (?,?,1,?,?,?,?)', [$coll, $json, $max + 1, $now, $now, $who]);
        $nid = (int)db()->lastInsertId();
        record_version('item', (string)$nid, $json, $who);
        return $nid;
    }
    q('INSERT INTO ar_items (coll, data, draft, live, sort, created_at, updated_at, updated_by) VALUES (?,?,?,0,?,?,?,?)', [$coll, '{}', $json, $max + 1, $now, $now, $who]);
    return (int)db()->lastInsertId();
}

function publish_item_draft(int $id, string $who): void
{
    reset_content_cache();
    $r = q('SELECT draft FROM ar_items WHERE id = ?', [$id])->fetch();
    if ($r && $r['draft'] !== null) {
        q('UPDATE ar_items SET data = draft, draft = NULL, live = 1, updated_at = ?, updated_by = ? WHERE id = ?', [time(), $who, $id]);
        record_version('item', (string)$id, (string)$r['draft'], $who);
    }
}

function discard_item_draft(int $id): void
{
    reset_content_cache();
    $r = q('SELECT live FROM ar_items WHERE id = ?', [$id])->fetch();
    if (!$r) {
        return;
    }
    if ((int)$r['live'] === 0) {
        q('DELETE FROM ar_items WHERE id = ?', [$id]);
        cleanup_uploads();
    } else {
        q('UPDATE ar_items SET draft = NULL WHERE id = ?', [$id]);
    }
}

function save_setting(string $grp, array $data, string $who, bool $publish = true): void
{
    reset_content_cache();
    $json = enc($data);
    $exists = q('SELECT 1 FROM ar_settings WHERE grp = ?', [$grp])->fetchColumn();
    if ($publish) {
        if ($exists) {
            q('UPDATE ar_settings SET data = ?, draft = NULL, updated_at = ?, updated_by = ? WHERE grp = ?', [$json, time(), $who, $grp]);
        } else {
            q('INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES (?,?,?,?)', [$grp, $json, time(), $who]);
        }
        if (!str_starts_with($grp, '_')) {
            record_version('group', $grp, $json, $who);
        }
        return;
    }
    if ($exists) {
        q('UPDATE ar_settings SET draft = ?, updated_at = ?, updated_by = ? WHERE grp = ?', [$json, time(), $who, $grp]);
    } else {
        q('INSERT INTO ar_settings (grp, data, draft, updated_at, updated_by) VALUES (?,?,?,?,?)', [$grp, '{}', $json, time(), $who]);
    }
}

function publish_setting_draft(string $grp, string $who): void
{
    reset_content_cache();
    $r = q('SELECT draft FROM ar_settings WHERE grp = ?', [$grp])->fetch();
    if ($r && $r['draft'] !== null) {
        q('UPDATE ar_settings SET data = draft, draft = NULL, updated_at = ?, updated_by = ? WHERE grp = ?', [time(), $who, $grp]);
        record_version('group', $grp, (string)$r['draft'], $who);
    }
}

function discard_setting_draft(string $grp): void
{
    reset_content_cache();
    q('UPDATE ar_settings SET draft = NULL WHERE grp = ?', [$grp]);
    cleanup_uploads();
}

/** Alle offenen Entwürfe: [['kind'=>'item'|'group', 'ref'=>…, 'label'=>…, 'who'=>…, 'at'=>…]] */
function open_drafts(): array
{
    $s = schema();
    $out = [];
    foreach (q('SELECT * FROM ar_items WHERE deleted_at IS NULL AND (draft IS NOT NULL OR live = 0) ORDER BY updated_at DESC')->fetchAll() as $r) {
        $def = $s['collections'][$r['coll']] ?? null;
        if (!$def) {
            continue;
        }
        $it = row_to_item($r, $def['fields'], true);
        $out[] = ['kind' => 'item', 'coll' => $r['coll'], 'ref' => (int)$r['id'], 'label' => $def['singular'] . ': ' . (trim((string)$it[$def['title']]) ?: '(ohne Titel)'), 'new' => (int)$r['live'] === 0, 'who' => (string)$r['updated_by'], 'at' => (int)$r['updated_at']];
    }
    foreach (q('SELECT grp, updated_at, updated_by FROM ar_settings WHERE draft IS NOT NULL')->fetchAll() as $r) {
        if (isset($s['groups'][$r['grp']])) {
            $out[] = ['kind' => 'group', 'ref' => $r['grp'], 'label' => $s['groups'][$r['grp']]['label'], 'new' => false, 'who' => (string)$r['updated_by'], 'at' => (int)$r['updated_at']];
        }
    }
    return $out;
}

function trash_item(int $id): void
{
    reset_content_cache();
    q('UPDATE ar_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL', [time(), $id]);
}

function restore_item(int $id): void
{
    reset_content_cache();
    $r = q('SELECT coll FROM ar_items WHERE id = ?', [$id])->fetch();
    if (!$r) {
        return;
    }
    $max = (int)q('SELECT COALESCE(MAX(sort), 0) FROM ar_items WHERE coll = ? AND deleted_at IS NULL', [$r['coll']])->fetchColumn();
    q('UPDATE ar_items SET deleted_at = NULL, sort = ? WHERE id = ?', [$max + 1, $id]);
}

function purge_item(int $id): void
{
    reset_content_cache();
    q('DELETE FROM ar_items WHERE id = ? AND deleted_at IS NOT NULL', [$id]);
    q("DELETE FROM ar_versions WHERE kind = 'item' AND ref = ?", [(string)$id]);
    cleanup_uploads();
}

function move_item(int $id, string $dir): void
{
    reset_content_cache();
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

/** Neue Reihenfolge per Drag-and-drop. */
function reorder_items(string $coll, array $ids): bool
{
    reset_content_cache();
    $cur = array_map('intval', array_column(q('SELECT id FROM ar_items WHERE coll = ? AND deleted_at IS NULL', [$coll])->fetchAll(), 'id'));
    $ids = array_values(array_unique(array_map('intval', $ids)));
    sort($cur);
    $chk = $ids;
    sort($chk);
    if ($cur !== $chk) {
        return false;
    }
    foreach ($ids as $n => $iid) {
        q('UPDATE ar_items SET sort = ? WHERE id = ? AND coll = ?', [$n + 1, $iid, $coll]);
    }
    return true;
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
        if ($t === 'image' && empty($files[$k]['name']) && !empty($post[$k . '_pick'])
            && preg_match('~^[a-z0-9_-]+\.(jpg|png|webp)$~', (string)$post[$k . '_pick']) && is_file(upload_dir() . '/' . $post[$k . '_pick'])) {
            $v = (string)$post[$k . '_pick'];
        }
        if (field_translatable($f) && !array_key_exists($k . '_en', $post)) {
            // Englische Texte werden in der Übersetzungstabelle bearbeitet: vorhandene Fassung beibehalten.
            $out[$k . '_en'] = (string)($old[$k . '_en'] ?? '');
        } elseif (field_translatable($f)) {
            $raw2 = $post[$k . '_en'] ?? '';
            $en = is_array($raw2) ? '' : preg_replace('~[\x00-\x08\x0B\x0C\x0E-\x1F]~', '', (string)$raw2);
            $en = $t === 'textarea' ? trim(str_replace("\r\n", "\n", $en)) : trim(preg_replace('~\s*[\r\n]+\s*~', ' ', $en));
            if (mb_strlen($en) > $max) {
                $errors[] = $f['label'] . ' (English): höchstens ' . $max . ' Zeichen.';
                $en = mb_substr($en, 0, $max);
            }
            $out[$k . '_en'] = $en;
        }
        if ($t === 'image') {
            $fo = (string)($post[$k . '_focus'] ?? '');
            $out[$k . '_focus'] = preg_match('~^\d{1,3}(\.\d)?,\d{1,3}(\.\d)?$~', $fo) ? $fo : '';
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

/** Fester Standard für hochgeladene Bilder: möglichst klein bei guter Optik (WebP, Qualität 72, längste Seite 1600 px). */
const IMG_QUALITY = 72;
const IMG_MAX_EDGE = 1600;

function image_settings(): array
{
    return ['webp' => true, 'quality' => IMG_QUALITY, 'max' => IMG_MAX_EDGE];
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
    $cfgImg = image_settings();
    $maxEdge = $cfgImg['max'];
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
    if ($cfgImg['webp'] && function_exists('imagewebp')) {
        $name .= '.webp';
        $ok = imagewebp($img, "$dir/$name", $cfgImg['quality']);
    } elseif ($hasAlpha) {
        $name .= '.png';
        $ok = imagepng($img, "$dir/$name", 6);
    } else {
        $name .= '.jpg';
        $ok = imagejpeg($img, "$dir/$name", $cfgImg['quality']);
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


/** Bereinigt eine englische Übersetzung wie die deutsche Eingabe (Feldtyp und Länge). */
function clean_translation(array $f, string $raw): string
{
    $en = preg_replace('~[\x00-\x08\x0B\x0C\x0E-\x1F]~', '', $raw);
    $en = $f['type'] === 'textarea' ? trim(str_replace("\r\n", "\n", $en)) : trim(preg_replace('~\s*[\r\n]+\s*~', ' ', $en));
    return mb_substr($en, 0, (int)($f['max'] ?? 500));
}

/**
 * Speichert englische Texte direkt (ohne andere Entwurfsänderungen zu veröffentlichen):
 * in den veröffentlichten Stand und, falls vorhanden, auch in den Entwurf.
 * $changes: ['c:12:title' => 'Text', 'g:hero:lead' => '…'] – gibt die Zahl gespeicherter Texte zurück.
 */
function save_translations(array $changes): int
{
    reset_content_cache();
    $s = schema();
    $by = [];
    $n = 0;
    foreach ($changes as $key => $val) {
        if (!is_string($key) || !is_string($val)) {
            continue;
        }
        $p = explode(':', $key, 3);
        if (count($p) !== 3) {
            continue;
        }
        [$kind, $ref, $fk] = $p;
        $fields = null;
        if ($kind === 'c') {
            $row = q('SELECT coll FROM ar_items WHERE id = ? AND deleted_at IS NULL', [(int)$ref])->fetch();
            $fields = $row ? ($s['collections'][$row['coll']]['fields'] ?? null) : null;
        } elseif ($kind === 'g') {
            $fields = $s['groups'][$ref]['fields'] ?? null;
        }
        foreach ($fields ?? [] as $f) {
            if ($f['type'] !== 'section' && $f['key'] === $fk && field_translatable($f)) {
                $by[$kind . ':' . $ref][$fk . '_en'] = clean_translation($f, $val);
                $n++;
            }
        }
    }
    foreach ($by as $ref => $vals) {
        [$kind, $id] = explode(':', $ref, 2);
        if ($kind === 'c') {
            $row = q('SELECT data, draft, live FROM ar_items WHERE id = ?', [(int)$id])->fetch();
            foreach (['data', 'draft'] as $col) {
                $arr = json_arr($row[$col] ?? null);
                if ($arr === null || ($col === 'data' && !(int)$row['live'])) {
                    continue;
                }
                q('UPDATE ar_items SET ' . $col . ' = ? WHERE id = ?', [enc(array_merge($arr, $vals)), (int)$id]);
            }
        } else {
            $row = q('SELECT data, draft FROM ar_settings WHERE grp = ?', [$id])->fetch();
            if (!$row) {
                q('INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES (?,?,?,?)', [$id, enc($vals), time(), 'übersetzung']);
                continue;
            }
            foreach (['data', 'draft'] as $col) {
                $arr = json_arr($row[$col] ?? null);
                if ($arr === null) {
                    continue;
                }
                q('UPDATE ar_settings SET ' . $col . ' = ? WHERE grp = ?', [enc(array_merge($arr, $vals)), $id]);
            }
        }
    }
    reset_content_cache();
    return $n;
}
