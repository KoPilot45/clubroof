<?php
declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $c = cfg('db');
    $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];
    try {
        if (($c['driver'] ?? 'sqlite') === 'mysql') {
            $pdo = new PDO('mysql:host=' . $c['host'] . ';dbname=' . $c['name'] . ';charset=utf8mb4', $c['user'], $c['pass'], $opts);
        } else {
            $dir = AR_ROOT . '/data';
            if (!is_dir($dir)) {
                @mkdir($dir, 0750, true);
            }
            $pdo = new PDO('sqlite:' . $dir . '/' . basename((string)$c['file']), null, null, $opts);
            $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
        }
    } catch (Throwable $e) {
        error_log('DB: ' . $e->getMessage());
        fatal('Die Datenbank ist nicht erreichbar. Bitte Systemcheck im Admin bzw. config.php prüfen.');
    }
    db_migrate($pdo);
    require_once __DIR__ . '/migrations.php';
    run_migrations($pdo);
    return $pdo;
}

function db_is_mysql(): bool
{
    return (cfg('db.driver') === 'mysql');
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function db_migrate(PDO $pdo): void
{
    try {
        $pdo->query('SELECT 1 FROM ar_users LIMIT 1');
        return;
    } catch (Throwable $e) {
        // Tabellen fehlen -> anlegen
    }
    $my = db_is_mysql();
    $id = $my ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $txt = $my ? 'MEDIUMTEXT' : 'TEXT';
    $tail = $my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
    $tables = [
        "CREATE TABLE IF NOT EXISTS ar_items (id $id, coll VARCHAR(40) NOT NULL, data $txt NOT NULL, sort INT NOT NULL DEFAULT 0, deleted_at INT NULL, created_at INT NOT NULL, updated_at INT NOT NULL, updated_by VARCHAR(190) NULL)$tail",
        "CREATE INDEX ar_items_coll ON ar_items (coll, deleted_at, sort)",
        "CREATE TABLE IF NOT EXISTS ar_settings (grp VARCHAR(40) NOT NULL PRIMARY KEY, data $txt NOT NULL, updated_at INT NOT NULL, updated_by VARCHAR(190) NULL)$tail",
        "CREATE TABLE IF NOT EXISTS ar_users (id $id, email VARCHAR(190) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL DEFAULT '', role VARCHAR(20) NOT NULL DEFAULT 'editor', created_at INT NOT NULL, last_login INT NULL)$tail",
        "CREATE TABLE IF NOT EXISTS ar_login_codes (id $id, email VARCHAR(190) NOT NULL, code_hash VARCHAR(64) NOT NULL, expires INT NOT NULL, attempts INT NOT NULL DEFAULT 0, used INT NOT NULL DEFAULT 0, created_at INT NOT NULL)$tail",
        "CREATE TABLE IF NOT EXISTS ar_sessions (token_hash VARCHAR(64) NOT NULL PRIMARY KEY, user_id INT NOT NULL, csrf VARCHAR(64) NOT NULL, created_at INT NOT NULL, last_seen INT NOT NULL, ua_hash VARCHAR(64) NOT NULL)$tail",
        "CREATE TABLE IF NOT EXISTS ar_audit (id $id, ts INT NOT NULL, who VARCHAR(190) NOT NULL, action VARCHAR(60) NOT NULL, detail VARCHAR(500) NOT NULL DEFAULT '')$tail",
        "CREATE TABLE IF NOT EXISTS ar_throttle (id $id, bucket VARCHAR(80) NOT NULL, ts INT NOT NULL)$tail",
        "CREATE INDEX ar_throttle_b ON ar_throttle (bucket, ts)",
    ];
    foreach ($tables as $sql) {
        $pdo->exec($sql);
    }
    $pdo->prepare('INSERT INTO ar_users (email, name, role, created_at) VALUES (?,?,?,?)')
        ->execute([strtolower((string)cfg('owner_email')), (string)cfg('owner_name', ''), 'owner', time()]);
    require_once __DIR__ . '/seed.php';
    seed_defaults($pdo);
}

function audit(string $who, string $action, string $detail = ''): void
{
    q('INSERT INTO ar_audit (ts, who, action, detail) VALUES (?,?,?,?)', [time(), $who, $action, mb_substr($detail, 0, 500)]);
}

function throttle_count(string $bucket, int $window): int
{
    return (int)q('SELECT COUNT(*) FROM ar_throttle WHERE bucket = ? AND ts > ?', [$bucket, time() - $window])->fetchColumn();
}

function throttle_hit(string $bucket): void
{
    q('INSERT INTO ar_throttle (bucket, ts) VALUES (?,?)', [$bucket, time()]);
    if (random_int(1, 40) === 1) {
        q('DELETE FROM ar_throttle WHERE ts < ?', [time() - 86400]);
        q('DELETE FROM ar_login_codes WHERE expires < ?', [time() - 86400]);
        q('DELETE FROM ar_sessions WHERE last_seen < ?', [time() - 86400 * 3]);
    }
}
