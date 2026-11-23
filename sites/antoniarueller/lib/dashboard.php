<?php
declare(strict_types=1);

// Daten für die Übersicht im Admin

const ACTIVITY_LABELS = [
    'publish_item' => 'veröffentlicht', 'draft_item' => 'als Entwurf gespeichert', 'publish_group' => 'veröffentlicht', 'draft_group' => 'als Entwurf gespeichert',
    'trash' => 'in den Papierkorb gelegt', 'restore' => 'wiederhergestellt', 'purge' => 'endgültig gelöscht', 'discard_draft' => 'Entwurf verworfen',
    'restore_version' => 'frühere Fassung geladen', 'publish_all' => 'alle Entwürfe veröffentlicht', 'media_upload' => 'Bilder hochgeladen', 'media_delete' => 'Bild gelöscht',
    'import_backup' => 'Sicherung wiederhergestellt',
];

/** Letzte inhaltliche Änderungen aus dem Protokoll. @return list<array{who:string,at:int,text:string,link:string}> */
function dash_activity(int $limit = 8, ?string $onlyWho = null): array
{
    $acts = array_keys(ACTIVITY_LABELS);
    $in = implode(',', array_fill(0, count($acts), '?'));
    $params = $acts;
    $sql = "SELECT * FROM ar_audit WHERE action IN ($in)";
    if ($onlyWho !== null) {
        $sql .= ' AND who = ?';
        $params[] = $onlyWho;
    }
    $rows = q($sql . ' ORDER BY id DESC LIMIT ' . (int)$limit, $params)->fetchAll();
    $s = schema();
    $out = [];
    foreach ($rows as $r) {
        $label = ACTIVITY_LABELS[$r['action']] ?? $r['action'];
        $what = '';
        $link = '';
        if (preg_match('~^(\w+)#(\d+)\s*(.*)$~u', (string)$r['detail'], $m) && isset($s['collections'][$m[1]])) {
            $def = $s['collections'][$m[1]];
            $what = $def['singular'] . ($m[3] !== '' ? ' „' . mb_strimwidth($m[3], 0, 50, '…') . '“' : '');
            $link = a('p=edit&c=' . $m[1] . '&id=' . $m[2]);
        } elseif (isset($s['groups'][(string)$r['detail']])) {
            $what = $s['groups'][(string)$r['detail']]['label'];
            $link = a('p=group&g=' . $r['detail']);
        } elseif (preg_match('~^group:(\w+)$~', (string)$r['detail'], $m) && isset($s['groups'][$m[1]])) {
            $what = $s['groups'][$m[1]]['label'];
            $link = a('p=group&g=' . $m[1]);
        } elseif (preg_match('~^item#(\d+)$~', (string)$r['detail'], $m)) {
            $it = item((int)$m[1]);
            $what = $it ? $s['collections'][$it['coll']]['singular'] : 'Eintrag';
            $link = $it ? a('p=edit&c=' . $it['coll'] . '&id=' . $m[1]) : '';
        }
        $out[] = ['who' => (string)$r['who'], 'at' => (int)$r['ts'], 'text' => trim(($what !== '' ? $what . ' ' : '') . $label), 'link' => $link];
    }
    return $out;
}

/** Die Anmeldung VOR der aktuellen (mit Gerät). */
function dash_previous_login(string $email): ?array
{
    $rows = q("SELECT ts, detail FROM ar_audit WHERE who = ? AND action = 'login' ORDER BY id DESC LIMIT 2", [$email])->fetchAll();
    return isset($rows[1]) ? ['at' => (int)$rows[1]['ts'], 'device' => (string)$rows[1]['detail']] : null;
}

/** Letzte Anmeldung je Konto. */
function dash_logins(): array
{
    $out = [];
    foreach (q('SELECT id, email, name, role, pw_hash, last_login FROM ar_users ORDER BY id')->fetchAll() as $u) {
        $r = q("SELECT ts, detail FROM ar_audit WHERE who = ? AND action = 'login' ORDER BY id DESC LIMIT 1", [$u['email']])->fetch();
        $out[] = [
            'name' => $u['name'] ?: $u['email'], 'email' => $u['email'], 'role' => $u['role'], 'pw' => !empty($u['pw_hash']),
            'at' => $r ? (int)$r['ts'] : (int)($u['last_login'] ?? 0), 'device' => $r ? (string)$r['detail'] : '',
        ];
    }
    return $out;
}

function dash_count_audit(array $actions, int $days = 7): int
{
    $in = implode(',', array_fill(0, count($actions), '?'));
    return (int)q("SELECT COUNT(*) FROM ar_audit WHERE action IN ($in) AND ts > ?", array_merge($actions, [time() - $days * 86400]))->fetchColumn();
}

function dash_active_devices(): int
{
    return (int)q('SELECT COUNT(*) FROM ar_sessions WHERE last_seen > ?', [time() - 60 * (int)cfg('session_idle_minutes', 60)])->fetchColumn();
}

/** Warnungen für die Warnleiste: [['level'=>'bad'|'warn','text'=>…,'link'=>…]] */
function dash_alerts(array $user): array
{
    $out = [];
    if (setting('seo', true)['noindex']) {
        $out[] = ['warn', 'Die Seite ist für Suchmaschinen gesperrt („noindex“). Für den Start ausschalten.', a('p=group&g=seo')];
    }
    if ($user['role'] === 'owner') {
        $last = backup_last();
        if ($last === 0) {
            $out[] = ['warn', 'Es gibt noch keine Sicherung.', a('p=backup')];
        } elseif ($last < time() - 14 * 86400) {
            $out[] = ['warn', 'Die letzte Sicherung ist ' . (int)floor((time() - $last) / 86400) . ' Tage alt.', a('p=backup')];
        }
        if (dash_count_audit(['login_locked']) > 0) {
            $out[] = ['warn', 'In den letzten 7 Tagen gab es Sperren nach Fehlversuchen bei der Anmeldung.', a('p=log')];
        }
        if (dash_count_audit(['login_mail_failed']) > 0) {
            $out[] = ['bad', 'Der Versand von Anmelde-Mails ist fehlgeschlagen. Mail-Einstellungen prüfen.', a('p=check')];
        }
    }
    if (is_file(AR_ROOT . '/diagnose.php') || is_dir(AR_ROOT . '/tools')) {
        $out[] = ['bad', 'Diagnose-Datei oder Ordner tools/ liegt noch auf dem Server und sollte gelöscht werden.', a('p=check')];
    }
    if (cfg('mail.driver') === 'log') {
        $out[] = ['warn', 'Mailversand steht auf „log“ (nur Entwicklung) – Anmelde-Mails kommen nicht an.', a('p=check')];
    }
    return $out;
}

function dir_size(string $dir): int
{
    $n = 0;
    foreach (glob($dir . '/*') ?: [] as $f) {
        if (is_file($f) && basename($f)[0] !== '.') {
            $n += (int)filesize($f);
        }
    }
    return $n;
}

/** Technik-Kennzahlen. */
function dash_tech(): array
{
    $bk = backup_list();
    return [
        'php' => PHP_VERSION, 'db' => cfg('db.driver') === 'mysql' ? 'MySQL/MariaDB' : 'SQLite',
        'uploads' => dir_size(upload_dir()), 'backups' => array_sum(array_column($bk, 'size')), 'backup_n' => count($bk),
        'items' => (int)q('SELECT COUNT(*) FROM ar_items WHERE deleted_at IS NULL')->fetchColumn(),
        'trash' => (int)q('SELECT COUNT(*) FROM ar_items WHERE deleted_at IS NOT NULL')->fetchColumn(),
    ];
}

/** Ablauf des SSL-Zertifikats der eigenen Domain (12 Stunden zwischengespeichert). */
function ssl_expiry(): array
{
    $cache = AR_ROOT . '/data/ssl-cache.json';
    if (is_file($cache) && filemtime($cache) > time() - 43200) {
        $d = json_decode((string)file_get_contents($cache), true);
        if (is_array($d)) {
            $d['days'] = isset($d['until']) ? (int)floor(($d['until'] - time()) / 86400) : null;
            return $d;
        }
    }
    $host = (string)(parse_url((string)cfg('site_url'), PHP_URL_HOST) ?: '');
    if ($host === '' || !function_exists('openssl_x509_parse')) {
        return ['error' => 'nicht abrufbar'];
    }
    $ctx = stream_context_create(['ssl' => ['capture_peer_cert' => true, 'verify_peer' => false, 'verify_peer_name' => false, 'SNI_enabled' => true, 'peer_name' => $host]]);
    $fp = @stream_socket_client('ssl://' . $host . ':443', $en, $es, 4, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        return ['error' => 'nicht abrufbar'];
    }
    $cert = stream_context_get_params($fp)['options']['ssl']['peer_certificate'] ?? null;
    fclose($fp);
    $info = $cert ? @openssl_x509_parse($cert) : null;
    $until = (int)($info['validTo_time_t'] ?? 0);
    if ($until <= 0) {
        return ['error' => 'nicht abrufbar'];
    }
    @file_put_contents($cache, json_encode(['host' => $host, 'until' => $until]), LOCK_EX);
    return ['host' => $host, 'until' => $until, 'days' => (int)floor(($until - time()) / 86400)];
}

function rel_time(int $t): string
{
    if ($t <= 0) {
        return 'nie';
    }
    $d = time() - $t;
    if ($d < 90) {
        return 'gerade eben';
    }
    if ($d < 3600) {
        return 'vor ' . (int)round($d / 60) . ' Min.';
    }
    if ($d < 86400) {
        return 'vor ' . (int)round($d / 3600) . ' Std.';
    }
    $days = (int)floor($d / 86400);
    return $days === 1 ? 'gestern' : 'vor ' . $days . ' Tagen';
}
