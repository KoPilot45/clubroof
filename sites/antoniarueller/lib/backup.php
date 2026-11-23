<?php
declare(strict_types=1);

function backup_last(): int
{
    $r = settings_rows()['_backup']['data'] ?? null;
    $d = json_arr($r);
    return (int)($d['last'] ?? 0);
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

/** Sicherung per Mail an den Inhaber. */
function backup_mail(): bool
{
    $json = export_json();
    $ok = send_mail((string)cfg('owner_email'), 'Sicherung antoniarueller.de ' . date('d.m.Y'),
        "Anbei die Sicherung aller Inhalte (JSON) vom " . date('d.m.Y H:i') . " Uhr.\nWiederherstellen: Verwaltung > Sicherung > Datei hochladen.\nBilder (Ordner uploads/) werden hierin nicht gesichert – bitte gelegentlich per FTP herunterladen.\n",
        [['name' => 'sicherung-' . date('Y-m-d') . '.json', 'type' => 'application/json', 'data' => $json]]);
    if ($ok) {
        save_setting('_backup', ['last' => time()], 'system');
    }
    return $ok;
}

/** Wöchentliche Sicherung ohne Cronjob: wird bei Anmeldungen angestoßen. */
function maybe_backup(): void
{
    if (backup_last() < time() - 7 * 86400) {
        backup_mail();
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
    @file_put_contents(AR_ROOT . '/data/vor-import-' . date('Ymd-His') . '.json', export_json(), LOCK_EX);
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
    return [true, $n . ' Einträge und alle Einstellungen wiederhergestellt. Der vorherige Stand liegt in data/vor-import-….json.'];
}
