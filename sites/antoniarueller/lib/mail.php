<?php
declare(strict_types=1);

function mail_clean(string $s): string
{
    return trim(str_replace(["\r", "\n", "\0"], ' ', $s));
}

/** Verschickt eine Text-Mail. Rückgabe true bei Erfolg. */
function send_mail(string $to, string $subject, string $body): bool
{
    $to = mail_clean($to);
    $subject = mail_clean($subject);
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $driver = (string)cfg('mail.driver', 'mail');
    $from = mail_clean((string)cfg('mail.from', 'noreply@localhost'));
    $fromName = mail_clean((string)cfg('mail.from_name', 'Admin'));

    if ($driver === 'log') {
        $dir = AR_ROOT . '/data';
        @mkdir($dir, 0750, true);
        return file_put_contents($dir . '/mail.log', "--- " . date('c') . " an $to\nBetreff: $subject\n$body\n\n", FILE_APPEND | LOCK_EX) !== false;
    }

    $headers = [
        'From: ' . mb_encode_mimeheader($fromName, 'UTF-8') . " <$from>",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        'X-Auto-Response-Suppress: All',
    ];
    $encSubject = mb_encode_mimeheader($subject, 'UTF-8');
    $encBody = chunk_split(base64_encode(str_replace("\n", "\r\n", str_replace("\r\n", "\n", $body))));

    if ($driver === 'smtp') {
        return smtp_send((array)cfg('mail.smtp'), $from, $to, $encSubject, $headers, $encBody, $fromName);
    }
    return @mail($to, $encSubject, $encBody, implode("\r\n", $headers), '-f' . $from);
}

function smtp_send(array $c, string $from, string $to, string $subject, array $headers, string $body, string $fromName): bool
{
    $host = (string)($c['host'] ?? '');
    $port = (int)($c['port'] ?? 587);
    $secure = (string)($c['secure'] ?? 'tls');
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . "$host:$port", $en, $es, 12, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        error_log("SMTP connect failed: $es");
        return false;
    }
    stream_set_timeout($fp, 12);
    $read = function () use ($fp): string {
        $out = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $out;
    };
    $cmd = function (string $c, string $expect) use ($fp, $read): bool {
        fwrite($fp, $c . "\r\n");
        $r = $read();
        return str_starts_with($r, $expect);
    };
    $ok = str_starts_with($read(), '220');
    $ehlo = 'EHLO ' . (preg_replace('~[^a-z0-9.-]~i', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost');
    $ok = $ok && $cmd($ehlo, '250');
    if ($ok && $secure === 'tls') {
        $ok = $cmd('STARTTLS', '220') && @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $ok = $ok && $cmd($ehlo, '250');
    }
    if ($ok && !empty($c['user'])) {
        $ok = $cmd('AUTH LOGIN', '334') && $cmd(base64_encode((string)$c['user']), '334') && $cmd(base64_encode((string)$c['pass']), '235');
    }
    $ok = $ok && $cmd("MAIL FROM:<$from>", '250') && $cmd("RCPT TO:<$to>", '25') && $cmd('DATA', '354');
    if ($ok) {
        $msg = implode("\r\n", array_merge($headers, ["To: <$to>", "Subject: $subject", 'Date: ' . date('r'), 'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . (parse_url((string)cfg('site_url'), PHP_URL_HOST) ?: 'localhost') . '>'])) . "\r\n\r\n" . $body;
        $msg = preg_replace('~^\.~m', '..', $msg);
        $ok = $cmd($msg . "\r\n.", '250');
    }
    @fwrite($fp, "QUIT\r\n");
    fclose($fp);
    if (!$ok) {
        error_log('SMTP: Versand fehlgeschlagen');
    }
    return $ok;
}
