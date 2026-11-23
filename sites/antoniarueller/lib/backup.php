<?php
declare(strict_types=1);

function backup_last(): int
{
    $r = settings_rows()['_backup']['data'] ?? null;
    $d = json_arr($r);
    $last = (int)($d['last'] ?? 0);
    foreach (backup_list() as $f) {
        if ($f['type'] !== 'vor-import') {
            return max($last, $f['time']);
        }
    }
    return $last;
}

function cron_key(): string
{
    return substr(hmac('cron-key'), 0, 24);
}

/** Alle Inhalte als Array (ohne Bilder, ohne Zugangsdaten, ohne Sitzungen). */
function export_data(): array
{
    $out = ['format' => 2, 'exportiert' => date('c'), 'einstellungen' => [], 'einstellungen_entwurf' => [], 'eintraege' => []];
    foreach (q("SELECT grp, data, draft FROM ar_settings WHERE grp NOT LIKE '!_%' ESCAPE '!' ORDER BY grp")->fetchAll() as $r) {
        $out['einstellungen'][$r['grp']] = json_arr($r['data']) ?? [];
        if ($r['draft'] !== null) {
            $out['einstellungen_entwurf'][$r['grp']] = json_arr($r['draft']);
        }
    }
    foreach (q('SELECT coll, data, draft, live, sort, deleted_at, updated_at FROM ar_items ORDER BY coll, sort, id')->fetchAll() as $r) {
        $out['eintraege'][] = ['bereich' => $r['coll'], 'daten' => json_arr($r['data']) ?? [], 'entwurf' => json_arr($r['draft']), 'live' => (int)$r['live'], 'reihenfolge' => (int)$r['sort'], 'im_papierkorb' => $r['deleted_at'] !== null, 'geaendert' => (int)$r['updated_at']];
    }
    return $out;
}

function export_json(): string
{
    return (string)json_encode(export_data(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

const BACKUP_TYPES = ['auto' => 'automatisch', 'manuell' => 'manuell', 'vor-import' => 'vor Wiederherstellung'];

function backup_dir(): string
{
    $d = AR_ROOT . '/data/backups';
    if (!is_dir($d)) {
        @mkdir($d, 0750, true);
    }
    return $d;
}

/** Legt eine Sicherung auf dem Server ab (data/backups/) und räumt alte auf. Rückgabe: Dateiname oder null. */
function backup_create(string $type): ?string
{
    if (!isset(BACKUP_TYPES[$type])) {
        return null;
    }
    $name = 'sicherung-' . date('Ymd-His') . '-' . $type . '-' . bin2hex(random_bytes(3)) . '.json';
    if (@file_put_contents(backup_dir() . '/' . $name, export_json(), LOCK_EX) === false) {
        return null;
    }
    @chmod(backup_dir() . '/' . $name, 0640);
    if ($type !== 'vor-import') {
        save_setting('_backup', ['last' => time()], 'system');
    }
    // Aufbewahrung: automatische und manuelle je die neuesten 15, vor-Wiederherstellung die neuesten 5
    foreach (['auto' => 15, 'manuell' => 15, 'vor-import' => 5] as $t => $keep) {
        $files = array_values(array_filter(backup_list(), fn($f) => $f['type'] === $t));
        foreach (array_slice($files, $keep) as $old) {
            @unlink(backup_dir() . '/' . $old['file']);
        }
    }
    return $name;
}

/** Gültiger Dateiname einer Sicherung? (verhindert Zugriffe auf andere Dateien) */
function backup_valid_name(string $name): bool
{
    return (bool)preg_match('~^sicherung-\d{8}-\d{6}-(auto|manuell|vor-import)-[a-f0-9]{6}\.json$~', $name);
}

/** @return list<array{file:string,type:string,label:string,time:int,size:int}> neueste zuerst */
function backup_list(): array
{
    $out = [];
    foreach (glob(backup_dir() . '/sicherung-*.json') ?: [] as $f) {
        $n = basename($f);
        if (!backup_valid_name($n)) {
            continue;
        }
        preg_match('~-(auto|manuell|vor-import)-~', $n, $m);
        $out[] = ['file' => $n, 'type' => $m[1], 'label' => BACKUP_TYPES[$m[1]], 'time' => (int)filemtime($f), 'size' => (int)filesize($f)];
    }
    usort($out, fn($x, $y) => $y['time'] <=> $x['time'] ?: strcmp($y['file'], $x['file']));
    return $out;
}

/** Wöchentliche Sicherung ohne Cronjob: wird bei Anmeldungen angestoßen. */
function maybe_backup(): void
{
    if (backup_last() < time() - 7 * 86400) {
        backup_create('auto');
    }
}

/**
 * Stellt Inhalte aus einer Sicherungsdatei wieder her. Vorher wird der aktuelle Stand in data/ gesichert.
 * @return array{0: bool, 1: string}
 */
function import_data(string $json, string $who): array
{
    $d = json_decode($json, true);
    if (!is_array($d) || !isset($d['einstellungen'], $d['eintraege']) || !is_array($d['eintraege'])) {
        return [false, 'Das ist keine gültige Sicherungsdatei.'];
    }
    $s = schema();
    backup_create('vor-import');
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->exec("DELETE FROM ar_items");
        $pdo->exec("DELETE FROM ar_versions");
        $pdo->exec("DELETE FROM ar_settings WHERE grp NOT LIKE '!_%' ESCAPE '!'");
        $now = time();
        $n = 0;
        foreach ($d['eintraege'] as $e) {
            if (!isset($s['collections'][$e['bereich'] ?? ''], $e['daten']) || !is_array($e['daten'])) {
                continue;
            }
            q('INSERT INTO ar_items (coll, data, draft, live, sort, deleted_at, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?,?,?,?)', [
                $e['bereich'], enc($e['daten']), isset($e['entwurf']) && is_array($e['entwurf']) ? enc($e['entwurf']) : null, (int)($e['live'] ?? 1) ? 1 : 0,
                (int)($e['reihenfolge'] ?? 0), !empty($e['im_papierkorb']) ? $now : null, $now, (int)($e['geaendert'] ?? $now), $who,
            ]);
            $n++;
        }
        foreach ($d['einstellungen'] as $grp => $vals) {
            if (!isset($s['groups'][$grp]) || !is_array($vals)) {
                continue;
            }
            $draft = $d['einstellungen_entwurf'][$grp] ?? null;
            q('INSERT INTO ar_settings (grp, data, draft, updated_at, updated_by) VALUES (?,?,?,?,?)', [$grp, enc($vals), is_array($draft) ? enc($draft) : null, $now, $who]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('Import: ' . $e->getMessage());
        return [false, 'Import fehlgeschlagen (nichts wurde verändert): ' . $e->getMessage()];
    }
    reset_content_cache();
    return [true, $n . ' Einträge und alle Einstellungen wiederhergestellt. Der vorherige Stand ist unter „Sicherung“ als „vor Wiederherstellung“ gespeichert.'];
}
