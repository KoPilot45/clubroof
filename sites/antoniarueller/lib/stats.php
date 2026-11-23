<?php
declare(strict_types=1);

/**
 * Reichweitenmessung ohne Cookies und ohne personenbezogene Daten:
 * pro Aufruf nur Datum + Stunde, Seite, Gerätetyp (Handy/Rechner) und die verweisende Domain.
 * Keine IP-Adresse, keine Wiedererkennung. Bots und „Do Not Track“ werden nicht gezählt.
 */
function stats_dir(): string
{
    return AR_ROOT . '/data/stats';
}

function stats_hit(string $page): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || ($_SERVER['HTTP_DNT'] ?? '') === '1') {
        return;
    }
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if ($ua === '' || preg_match('~bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python|headless|lighthouse|uptime|check|fetch|scan~i', $ua)) {
        return;
    }
    $dev = preg_match('~Mobile|Android|iPhone|iPad~i', $ua) ? 'm' : 'd';
    $ref = '';
    $r = (string)($_SERVER['HTTP_REFERER'] ?? '');
    if ($r !== '') {
        $h = strtolower((string)parse_url($r, PHP_URL_HOST));
        $h = preg_replace('~^www\.~', '', $h);
        $own = preg_replace('~^www\.~', '', strtolower(explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0]));
        if ($h !== '' && $h !== $own) {
            $ref = substr(preg_replace('~[^a-z0-9.-]~', '', $h), 0, 60);
        }
    }
    $dir = stats_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) {
        return;
    }
    @file_put_contents($dir . '/' . date('Y-m') . '.log', date('Y-m-d H') . "\t" . preg_replace('~[^a-z0-9-]~', '', $page) . "\t" . $dev . "\t" . $ref . "\n", FILE_APPEND | LOCK_EX);
    if (random_int(1, 300) === 1) {
        foreach (glob($dir . '/*.log') ?: [] as $f) {
            if (filemtime($f) < time() - 400 * 86400) {
                @unlink($f);
            }
        }
    }
}

/** Auswertung der letzten 30 Tage. */
function stats_summary(): array
{
    $days = [];
    for ($i = 29; $i >= 0; $i--) {
        $days[date('Y-m-d', strtotime("-$i days"))] = 0;
    }
    $pages = [];
    $dev = ['m' => 0, 'd' => 0];
    $refs = [];
    $first = array_key_first($days);
    foreach (array_unique([date('Y-m', strtotime('-30 days')), date('Y-m')]) as $month) {
        $f = stats_dir() . '/' . $month . '.log';
        if (!is_file($f)) {
            continue;
        }
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $p = explode("\t", $line);
            if (count($p) < 3) {
                continue;
            }
            $day = substr($p[0], 0, 10);
            if ($day < $first || !isset($days[$day])) {
                continue;
            }
            $days[$day]++;
            $pages[$p[1]] = ($pages[$p[1]] ?? 0) + 1;
            $dev[$p[2] === 'm' ? 'm' : 'd']++;
            if (($p[3] ?? '') !== '') {
                $refs[$p[3]] = ($refs[$p[3]] ?? 0) + 1;
            }
        }
    }
    arsort($pages);
    arsort($refs);
    $vals = array_values($days);
    return [
        'days' => $days, 'total' => array_sum($vals), 'today' => end($vals) ?: 0, 'week' => array_sum(array_slice($vals, -7)),
        'pages' => $pages, 'dev' => $dev, 'refs' => array_slice($refs, 0, 8, true),
    ];
}
