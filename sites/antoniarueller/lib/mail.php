<?php
declare(strict_types=1);

/** Letzter Fehlergrund beim Mailversand (leer = kein Fehler). */
function mail_last_error(?string $set = null): string
{
    static $e = '';
    if ($set !== null) {
        $e = mb_substr(trim(preg_replace('~\s+~', ' ', $set)), 0, 160);
    }
    return $e;
}

/** Ergebnis des letzten Versands für die Übersicht merken (nur bei echtem Versand). */
function mail_record_status(bool $ok): void
{
    try {
        save_setting('_mail', ['ok' => $ok, 'at' => time(), 'err' => mail_last_error()], 'system');
    } catch (Throwable $e) {
        error_log('mail status: ' . $e->getMessage());
    }
}

function mail_clean(string $s): string
{
    return trim(str_replace(["\r", "\n", "\0"], ' ', $s));
}

/** Verschickt eine Text-Mail. Rückgabe true bei Erfolg. */
function send_mail(string $to, string $subject, string $body, array $attachments = []): bool
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
        $att = $attachments ? 'Anhang: ' . implode(', ', array_column($attachments, 'name')) . "\n" : '';
        return file_put_contents($dir . '/mail.log', "--- " . date('c') . " an $to\nBetreff: $subject\n$att$body\n\n", FILE_APPEND | LOCK_EX) !== false;
    }

    $headers = [
        'From: ' . mb_encode_mimeheader($fromName, 'UTF-8') . " <$from>",
        'MIME-Version: 1.0',
        'X-Auto-Response-Suppress: All',
    ];
    $encSubject = mb_encode_mimeheader($subject, 'UTF-8');
    $text = chunk_split(base64_encode(str_replace("\n", "\r\n", str_replace("\r\n", "\n", $body))));
    if ($attachments) {
        $bd = 'ar_' . bin2hex(random_bytes(8));
        $headers[] = 'Content-Type: multipart/mixed; boundary="' . $bd . '"';
        $encBody = "--$bd\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . $text;
        foreach ($attachments as $a) {
            $nm = preg_replace('~[^A-Za-z0-9._-]~', '_', (string)$a['name']);
            $encBody .= "--$bd\r\nContent-Type: " . preg_replace('~[^a-z0-9/+.-]~i', '', (string)$a['type']) . "; name=\"$nm\"\r\nContent-Disposition: attachment; filename=\"$nm\"\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode((string)$a['data']));
        }
        $encBody .= "--$bd--\r\n";
    } else {
        $headers[] = 'Content-Type: text/plain; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: base64';
        $encBody = $text;
    }

    mail_last_error('');
    if ($driver === 'smtp') {
        $ok = smtp_send((array)cfg('mail.smtp'), $from, $to, $encSubject, $headers, $encBody, $fromName);
    } else {
        $ok = @mail($to, $encSubject, $encBody, implode("\r\n", $headers), '-f' . $from);
        if (!$ok) {
            mail_last_error('PHP mail() hat den Versand abgelehnt');
        }
    }
    mail_record_status($ok);
    return $ok;
}

function smtp_send(array $c, string $from, string $to, string $subject, array $headers, string $body, string $fromName): bool
{
    $host = (string)($c['host'] ?? '');
    $port = (int)($c['port'] ?? 587);
    $secure = (string)($c['secure'] ?? 'tls');
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . "$host:$port", $en, $es, 12, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        mail_last_error("Verbindung zu $host:$port nicht möglich ($es)");
        error_log('SMTP: ' . mail_last_error());
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
    $fail = function (string $step, string $reply) use ($fp): bool {
        mail_last_error($step . ': ' . ($reply !== '' ? $reply : 'keine Antwort'));
        error_log('SMTP: ' . mail_last_error());
        @fwrite($fp, "QUIT\r\n");
        fclose($fp);
        return false;
    };
    $expect = function (string $cmd, string $prefix, string $step) use ($fp, $read, $fail): ?bool {
        if ($cmd !== '') {
            fwrite($fp, $cmd . "\r\n");
        }
        $r = $read();
        return str_starts_with($r, $prefix) ? null : $fail($step, $r);
    };
    $greet = $read();
    if (!str_starts_with($greet, '220')) {
        return $fail('Begrüßung', $greet);
    }
    $ehlo = 'EHLO ' . (preg_replace('~[^a-z0-9.-]~i', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost');
    if (($x = $expect($ehlo, '250', 'EHLO')) !== null) {
        return $x;
    }
    if ($secure === 'tls') {
        if (($x = $expect('STARTTLS', '220', 'STARTTLS')) !== null) {
            return $x;
        }
        if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            return $fail('TLS-Verschlüsselung', 'Zertifikat oder Verbindung abgelehnt');
        }
        if (($x = $expect($ehlo, '250', 'EHLO nach STARTTLS')) !== null) {
            return $x;
        }
    }
    if (!empty($c['user'])) {
        foreach ([['AUTH LOGIN', '334'], [base64_encode((string)$c['user']), '334'], [base64_encode((string)$c['pass']), '235']] as $i => [$cmd, $pfx]) {
            if (($x = $expect($cmd, $pfx, 'Anmeldung am Mailserver (SMTP-Zugang prüfen)')) !== null) {
                return $x;
            }
        }
    }
    foreach ([["MAIL FROM:<$from>", '250', 'Absender'], ["RCPT TO:<$to>", '25', 'Empfänger'], ['DATA', '354', 'DATA']] as [$cmd, $pfx, $step]) {
        if (($x = $expect($cmd, $pfx, $step)) !== null) {
            return $x;
        }
    }
    $msg = implode("\r\n", array_merge($headers, ["To: <$to>", "Subject: $subject", 'Date: ' . date('r'), 'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . (parse_url((string)cfg('site_url'), PHP_URL_HOST) ?: 'localhost') . '>'])) . "\r\n\r\n" . $body;
    $msg = preg_replace('~^\.~m', '..', $msg);
    stream_set_timeout($fp, (int)($c['data_timeout'] ?? 40)); // manche Server prüfen die Mail vor der Bestätigung (Spamfilter)
    fwrite($fp, $msg . "\r\n.\r\n");
    $final = $read();
    $meta = stream_get_meta_data($fp);
    if (str_starts_with($final, '250')) {
        @fwrite($fp, "QUIT\r\n");
        fclose($fp);
        return true;
    }
    if ($final === '' && !empty($meta['timed_out'])) {
        // Mail wurde übergeben, aber der Server hat die Annahme nicht rechtzeitig bestätigt: nicht als Fehler werten.
        mail_last_error('Annahme vom Mailserver nicht bestätigt (Zeitüberschreitung) – Mail wurde übergeben');
        error_log('SMTP: ' . mail_last_error());
        fclose($fp);
        return true;
    }
    return $fail('Übergabe der Nachricht', $final);
}
