<?php
declare(strict_types=1);

require_once __DIR__ . '/mail.php';

const AR_COOKIE = 'ar_admin';

function find_user(string $email): ?array
{
    $r = q('SELECT * FROM ar_users WHERE email = ?', [strtolower(trim($email))])->fetch();
    return $r ?: null;
}

/** Schritt 1: Code anfordern. Antwort nach außen immer gleich (verrät nicht, ob die Adresse existiert). */
function login_request(string $email): void
{
    $email = strtolower(trim($email));
    $ipb = 'ip:' . hmac(client_ip());
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || throttle_count($ipb, 3600) >= 12) {
        usleep(random_int(200000, 500000));
        return;
    }
    throttle_hit($ipb);
    $user = find_user($email);
    if (!$user) {
        usleep(random_int(300000, 700000));
        return;
    }
    $eb = 'mail:' . hmac($email);
    if (throttle_count($eb, 600) >= 3) {
        return;
    }
    throttle_hit($eb);
    $code = str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
    q('UPDATE ar_login_codes SET used = 1 WHERE email = ?', [$email]);
    q('INSERT INTO ar_login_codes (email, code_hash, expires, created_at) VALUES (?,?,?,?)', [$email, hmac($email . '|' . $code), time() + 60 * (int)cfg('code_valid_minutes', 10), time()]);
    $min = (int)cfg('code_valid_minutes', 10);
    $pretty = substr($code, 0, 4) . ' ' . substr($code, 4);
    $ok = send_mail($email, 'Dein Anmeldecode: ' . $pretty,
        "Hallo" . ($user['name'] ? ' ' . $user['name'] : '') . ",\n\n" .
        "dein Anmeldecode für die Verwaltung von antoniarueller.de lautet:\n\n    $pretty\n\n" .
        "Er ist $min Minuten gültig und kann nur einmal verwendet werden.\n" .
        "Wenn du dich nicht anmelden wolltest, ignoriere diese Mail – ohne den Code kann sich niemand anmelden.\n");
    if (!$ok) {
        audit($email, 'login_mail_failed');
    }
}

/** Schritt 2: Code prüfen, Sitzung anlegen. */
function login_verify(string $email, string $code): bool
{
    $email = strtolower(trim($email));
    $code = preg_replace('~\D~', '', $code);
    $fb = 'fail:' . hmac(client_ip());
    if (throttle_count($fb, 3600) >= 20) {
        return false;
    }
    $row = q('SELECT * FROM ar_login_codes WHERE email = ? AND used = 0 AND expires > ? ORDER BY id DESC LIMIT 1', [$email, time()])->fetch();
    $user = find_user($email);
    if (!$row || !$user || strlen($code) !== 8) {
        throttle_hit($fb);
        return false;
    }
    q('UPDATE ar_login_codes SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);
    if ((int)$row['attempts'] + 1 >= 5) {
        q('UPDATE ar_login_codes SET used = 1 WHERE id = ?', [$row['id']]);
    }
    if (!hash_equals((string)$row['code_hash'], hmac($email . '|' . $code))) {
        throttle_hit($fb);
        audit($email, 'login_failed');
        return false;
    }
    q('UPDATE ar_login_codes SET used = 1 WHERE id = ?', [$row['id']]);
    $token = bin2hex(random_bytes(32));
    q('INSERT INTO ar_sessions (token_hash, user_id, csrf, created_at, last_seen, ua_hash) VALUES (?,?,?,?,?,?)',
        [hmac($token), $user['id'], bin2hex(random_bytes(24)), time(), time(), hmac($_SERVER['HTTP_USER_AGENT'] ?? '')]);
    q('UPDATE ar_users SET last_login = ? WHERE id = ?', [time(), $user['id']]);
    set_session_cookie($token, 0);
    audit($email, 'login');
    send_mail($email, 'Neue Anmeldung bei der Verwaltung', "Es gab soeben eine Anmeldung bei der Verwaltung von antoniarueller.de (" . date('d.m.Y H:i') . " Uhr).\nWar das nicht du? Dann bitte sofort melden.\n");
    return true;
}

function set_session_cookie(string $token, int $expires): void
{
    setcookie(AR_COOKIE, $token, [
        'expires' => $expires, 'path' => AR_BASE . '/admin/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict',
    ]);
}

function current_user(): ?array
{
    static $u = false;
    if ($u !== false) {
        return $u;
    }
    $u = null;
    $token = $_COOKIE[AR_COOKIE] ?? '';
    if (!is_string($token) || !preg_match('~^[a-f0-9]{64}$~', $token)) {
        return null;
    }
    $s = q('SELECT s.*, u.email, u.name, u.role FROM ar_sessions s JOIN ar_users u ON u.id = s.user_id WHERE s.token_hash = ?', [hmac($token)])->fetch();
    if (!$s) {
        return null;
    }
    $idle = 60 * (int)cfg('session_idle_minutes', 60);
    $max = 3600 * (int)cfg('session_max_hours', 12);
    if (time() - (int)$s['last_seen'] > $idle || time() - (int)$s['created_at'] > $max || !hash_equals((string)$s['ua_hash'], hmac($_SERVER['HTTP_USER_AGENT'] ?? ''))) {
        q('DELETE FROM ar_sessions WHERE token_hash = ?', [hmac($token)]);
        return null;
    }
    if (time() - (int)$s['last_seen'] > 60) {
        q('UPDATE ar_sessions SET last_seen = ? WHERE token_hash = ?', [time(), hmac($token)]);
    }
    return $u = $s;
}

function logout(): void
{
    $token = $_COOKIE[AR_COOKIE] ?? '';
    if (is_string($token) && $token !== '') {
        q('DELETE FROM ar_sessions WHERE token_hash = ?', [hmac($token)]);
    }
    set_session_cookie('', time() - 3600);
}

/** Cross-Site-Schutz für alle POST-Anfragen. */
function check_origin(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        return;
    }
    $o = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($o !== '' && parse_url($o, PHP_URL_HOST) !== ($_SERVER['HTTP_HOST'] ?? '')) {
        // Host kann einen Port enthalten
        $h = explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0];
        if (parse_url($o, PHP_URL_HOST) !== $h) {
            fatal('Ungültige Herkunft der Anfrage.', 403);
        }
    }
}

function csrf_check(array $user): void
{
    if (!hash_equals((string)$user['csrf'], (string)($_POST['_csrf'] ?? ''))) {
        fatal('Sitzung abgelaufen oder ungültige Anfrage. Bitte Seite neu laden.', 403);
    }
}
