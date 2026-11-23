<?php
// Konfiguration. Diese Datei wird beim ersten Aufruf automatisch als config.php kopiert,
// wobei __SECRET__ und __DBFILE__ durch Zufallswerte ersetzt werden.
// config.php NIE öffentlich weitergeben (enthält Geheimnisse).
return [
    // Erste Admin-Adresse (Postfach bewusst NICHT auf der eigenen Domain).
    // Weitere Zugänge (z. B. Antonia) werden später im Admin unter „Zugänge“ ergänzt.
    'owner_email' => 'lukaskoziorowski@yahoo.de',
    'owner_name'  => 'Lukas',

    // Weitere Zugänge, die beim ersten Aufruf automatisch angelegt werden (danach im Admin unter „Zugänge“ verwaltbar).
    // Beispiel: 'extra_users' => [['email' => 'name@example.com', 'name' => 'Name', 'role' => 'owner']],  // role optional: 'owner' = Inhaber
    'extra_users' => [],

    // Geheimnis für Hashes (Codes, Sitzungen). Wird automatisch erzeugt.
    'secret' => '__SECRET__',

    // Datenbank. 'sqlite' braucht keine Zugangsdaten (Datei in data/).
    // Falls SQLite beim Hoster fehlt: 'driver' => 'mysql' und Zugangsdaten aus dem Ionos-Kundencenter eintragen.
    'db' => [
        'driver' => 'sqlite',
        'file'   => '__DBFILE__',
        'host' => 'localhost', 'name' => '', 'user' => '', 'pass' => '',
    ],

    // Versand der Anmelde-Codes.
    //  'mail' = PHP mail() (funktioniert bei Ionos meist ohne Einrichtung)
    //  'smtp' = eigener SMTP-Zugang (zuverlässiger, siehe README)
    //  'log'  = nur Entwicklung: Code landet in data/mail.log statt im Postfach
    'mail' => [
        'driver' => 'mail',
        'from'   => 'noreply@antoniarueller.de',
        'from_name' => 'Antonia Rüller – Admin',
        'smtp' => ['host' => 'smtp.ionos.de', 'port' => 587, 'secure' => 'tls', 'user' => '', 'pass' => ''],
    ],

    // Öffentliche Adresse (für Mails/Metadaten). Leer = automatisch.
    'site_url' => 'https://antoniarueller.de',

    // Sicherheit
    'session_idle_minutes' => 60,   // Abmeldung nach Inaktivität
    'session_max_hours'    => 12,   // maximale Sitzungsdauer
    'code_valid_minutes'   => 10,
    'max_upload_mb'        => 8,

    // true = Systemcheck-Seite im Admin zeigt zusätzliche Details (nach Einrichtung auf false)
    'debug' => false,
];
