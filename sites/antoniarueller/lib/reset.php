<?php
declare(strict_types=1);

// Sperre nach Fehlversuchen und „Passwort vergessen“

function lock_max(): int
{
    return max(3, (int)cfg('login_max_fails', 5));
}

function lock_window(): int
{
    return 60 * max(1, (int)cfg('login_lock_minutes', 15));
}

function lock_bucket(string $email): string
{
    return 'lock:' . hmac(strtolower(trim($email)));
}

/** Sekunden, die das Konto (bzw. die eingegebene Adresse) noch gesperrt ist; 0 = nicht gesperrt. Gilt für jede Adresse gleich. */
function login_lock_remaining(string $email): int
{
    $rows = q('SELECT ts FROM ar_throttle WHERE bucket = ? AND ts > ? ORDER BY ts ASC', [lock_bucket($email), time() - lock_window()])->fetchAll(PDO::FETCH_COLUMN);
    $n = count($rows);
    if ($n < lock_max()) {
        return 0;
    }
    return max(0, (int)$rows[$n - lock_max()] + lock_window() - time());
}

/** Fehlversuch zählen; beim Erreichen der Grenze wird die betroffene Person per Mail informiert. */
function login_fail(string $email): void
{
    $email = strtolower(trim($email));
    throttle_hit(lock_bucket($email));
    $n = (int)q('SELECT COUNT(*) FROM ar_throttle WHERE bucket = ? AND ts > ?', [lock_bucket($email), time() - lock_window()])->fetchColumn();
    if ($n === lock_max()) {
        audit($email, 'login_locked');
        $u = find_user($email);
        if ($u) {
            send_mail($email, 'Anmeldung vorübergehend gesperrt',
                "Für dein Konto in der Verwaltung von antoniarueller.de gab es mehrere fehlgeschlagene Anmeldeversuche.\n" .
                'Aus Sicherheitsgründen ist die Anmeldung für ' . (int)(lock_window() / 60) . " Minuten gesperrt.\n" .
                "Warst du das nicht, ändere bitte dein Passwort (falls eingerichtet) und melde dich beim Inhaber.\n");
        }
    }
}

function login_unlock(string $email): void
{
    q('DELETE FROM ar_throttle WHERE bucket = ?', [lock_bucket($email)]);
}

function lock_message(int $seconds): string
{
    $min = max(1, (int)ceil($seconds / 60));
    return 'Zu viele Fehlversuche. Die Anmeldung ist vorübergehend gesperrt – bitte in ca. ' . $min . ' ' . ($min === 1 ? 'Minute' : 'Minuten') . ' erneut versuchen.';
}

// ---------- Passwort vergessen ----------

function reset_link(string $email, string $token): string
{
    $base = rtrim((string)cfg('site_url'), '/');
    if ($base === '') {
        $base = (is_https() ? 'https' : 'http') . '://' . preg_replace('~[^A-Za-z0-9.:-]~', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost')) . AR_BASE;
    }
    return $base . '/admin/?p=reset&e=' . rawurlencode($email) . '&t=' . $token;
}

function owner_emails(): array
{
    return array_column(q("SELECT email FROM ar_users WHERE role = 'owner'")->fetchAll(), 'email');
}

/** Link zum Zurücksetzen per Mail. Nach außen immer dieselbe Antwort. */
function reset_request(string $email): void
{
    $email = strtolower(trim($email));
    $ipb = 'rstip:' . hmac(client_ip());
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || throttle_count($ipb, 3600) >= 6) {
        usleep(random_int(200000, 500000));
        return;
    }
    throttle_hit($ipb);
    $user = find_user($email);
    if (!$user) {
        usleep(random_int(300000, 700000));
        return;
    }
    $eb = 'rst:' . hmac($email);
    if (throttle_count($eb, 3600) >= 3) {
        return;
    }
    throttle_hit($eb);
    q('UPDATE ar_resets SET used = 1 WHERE email = ?', [$email]);
    $token = bin2hex(random_bytes(24));
    q('INSERT INTO ar_resets (email, token_hash, expires, created_at) VALUES (?,?,?,?)', [$email, hmac('reset|' . $token), time() + 1800, time()]);
    audit($email, 'password_reset_requested');
    send_mail($email, 'Passwort zurücksetzen',
        'Hallo' . ($user['name'] ? ' ' . $user['name'] : '') . ",\n\n" .
        "für dein Konto in der Verwaltung von antoniarueller.de wurde das Zurücksetzen des Passworts angefordert.\n\n" .
        "Neues Passwort festlegen (30 Minuten gültig, nur einmal nutzbar):\n" . reset_link($email, $token) . "\n\n" .
        "Danach meldest du dich wie gewohnt mit E-Mail-Code und neuem Passwort an.\n" .
        "Warst du das nicht, ignoriere diese Mail. Ohne den Link ändert sich nichts.\n");
}

/** Prüft Link-Daten; true, wenn Link gültig. */
function reset_valid(string $email, string $token): bool
{
    if (!preg_match('~^[a-f0-9]{48}$~', $token)) {
        return false;
    }
    $r = q('SELECT id FROM ar_resets WHERE email = ? AND token_hash = ? AND used = 0 AND expires > ?', [strtolower(trim($email)), hmac('reset|' . $token), time()])->fetch();
    return (bool)$r;
}

/** @return array{0: bool, 1: string} */
function reset_apply(string $email, string $token, string $pw, string $pw2): array
{
    $email = strtolower(trim($email));
    $fb = 'rstfail:' . hmac(client_ip());
    if (throttle_count($fb, 3600) >= 20) {
        return [false, 'Zu viele Versuche. Bitte später erneut versuchen.'];
    }
    if (!reset_valid($email, $token)) {
        throttle_hit($fb);
        return [false, 'Der Link ist ungültig oder abgelaufen. Bitte unter „Passwort vergessen?“ einen neuen anfordern.'];
    }
    if (mb_strlen($pw) < 12) {
        return [false, 'Das Passwort braucht mindestens 12 Zeichen.'];
    }
    if ($pw !== $pw2) {
        return [false, 'Die beiden Passwörter stimmen nicht überein.'];
    }
    $user = find_user($email);
    if (!$user) {
        return [false, 'Der Link ist ungültig oder abgelaufen.'];
    }
    q('UPDATE ar_users SET pw_hash = ? WHERE id = ?', [password_hash($pw, PASSWORD_DEFAULT), (int)$user['id']]);
    q('UPDATE ar_resets SET used = 1 WHERE email = ?', [$email]);
    q('DELETE FROM ar_sessions WHERE user_id = ?', [(int)$user['id']]);
    login_unlock($email);
    audit($email, 'password_reset');
    foreach (array_unique(array_merge([$email], owner_emails())) as $to) {
        send_mail((string)$to, 'Passwort in der Verwaltung zurückgesetzt',
            'Das Passwort für ' . $email . " in der Verwaltung von antoniarueller.de wurde soeben per E-Mail-Link zurückgesetzt (" . date('d.m.Y H:i') . " Uhr).\n" .
            "Alle bestehenden Anmeldungen dieses Kontos wurden beendet.\nWar das nicht geplant, bitte sofort den Inhaber informieren.\n");
    }
    return [true, 'Passwort gespeichert. Bitte melde dich jetzt mit E-Mail-Code und neuem Passwort an.'];
}
