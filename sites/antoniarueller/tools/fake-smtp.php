<?php
// Einfacher Test-SMTP-Server: php tools/fake-smtp.php PORT MODUS   (MODUS: ok | rcpt550 | slow | silent | authfail)
[$self, $port, $mode] = $argv + [null, 2525, 'ok'];
$srv = stream_socket_server("tcp://127.0.0.1:$port", $en, $es);
while ($c = @stream_socket_accept($srv, -1)) {
    fwrite($c, "220 test ESMTP\r\n");
    $data = false;
    while (($line = fgets($c)) !== false) {
        $l = rtrim($line);
        if ($data) {
            if ($l === '.') {
                $data = false;
                if ($mode === 'silent') { sleep(5); break; }
                if ($mode === 'slow') { sleep(2); }
                fwrite($c, "250 2.0.0 Ok: queued\r\n");
            }
            continue;
        }
        $u = strtoupper($l);
        if (str_starts_with($u, 'EHLO')) fwrite($c, "250-test\r\n250 AUTH LOGIN\r\n");
        elseif (str_starts_with($u, 'AUTH LOGIN')) fwrite($c, "334 VXNlcm5hbWU6\r\n");
        elseif (str_starts_with($u, 'MAIL')) fwrite($c, "250 ok\r\n");
        elseif (str_starts_with($u, 'RCPT')) fwrite($c, $mode === 'rcpt550' ? "550 5.1.1 Empfaenger abgelehnt\r\n" : "250 ok\r\n");
        elseif ($u === 'DATA') { $data = true; fwrite($c, "354 go\r\n"); }
        elseif ($u === 'QUIT') { fwrite($c, "221 bye\r\n"); break; }
        else {
            // AUTH-Schritte (Benutzer, Passwort)
            static $step = 0;
            $step++;
            fwrite($c, $mode === 'authfail' && $step >= 2 ? "535 5.7.8 Authentifizierung fehlgeschlagen\r\n" : ($step % 2 ? "334 UGFzc3dvcmQ6\r\n" : "235 ok\r\n"));
        }
    }
    fclose($c);
}
