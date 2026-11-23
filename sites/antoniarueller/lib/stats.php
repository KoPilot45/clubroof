<?php
declare(strict_types=1);

/**
 * Reichweitenmessung ohne Cookies und ohne Speicherung personenbezogener Daten.
 *
 * Gespeichert wird nur Anonymes: Datum + Stunde, Seite, Gerätegruppe, Browser-/Systemfamilie, verweisende Domain,
 * das Merkmal „erster Aufruf dieses Geräts in dieser Stunde“ (= Besuch).
 * Für die Besuchserkennung liegt bis zum Ende der Stunde ein nicht umkehrbarer Kurzwert (mit zufälligem Schlüssel) in
 * data/stats/seen-JJJJMMTTHH.tmp; danach wird er samt Schlüssel gelöscht. Die IP-Adresse wird nie gespeichert.
 *
 * Dateien in data/stats/:  JJJJ-MM.log (Aufrufe) · bots-….dat (bekannte Crawler) · events-….dat (Klicks/Abschnitte als Summen)
 *                          404-….dat (nicht vorhandene Adressen) · archive.json (Tageswerte älter als 90 Tage) · disabled (Schalter)
 */
const STATS_RAW_DAYS = 90;

function stats_dir(): string
{
    return AR_ROOT . '/data/stats';
}

function stats_enabled(): bool
{
    return !is_file(stats_dir() . '/disabled');
}

function stats_ensure_dir(): bool
{
    $d = stats_dir();
    return is_dir($d) || @mkdir($d, 0750, true);
}

/** Alte Kurzwert-Dateien (vergangene Stunden) löschen. */
function stats_cleanup(): void
{
    $keep = 'seen-' . date('YmdH') . '.tmp';
    foreach (glob(stats_dir() . '/seen-*.tmp') ?: [] as $f) {
        if (basename($f) !== $keep) {
            @unlink($f);
        }
    }
}

/** true, wenn dieses Gerät in der laufenden Stunde (für diesen Zusatz) noch nicht gezählt wurde. */
function stats_is_new_visit(string $extra = ''): bool
{
    $dir = stats_dir();
    stats_cleanup();
    $fp = @fopen($dir . '/seen-' . date('YmdH') . '.tmp', 'c+');
    if (!$fp) {
        return true;
    }
    flock($fp, LOCK_EX);
    $salt = trim((string)fgets($fp));
    if ($salt === '') {
        $salt = bin2hex(random_bytes(16));
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $salt . "\n");
    }
    $h = substr(hash('sha256', $salt . '|' . client_ip() . '|' . (string)($_SERVER['HTTP_USER_AGENT'] ?? '') . '|' . $extra), 0, 16);
    $new = true;
    while (($line = fgets($fp)) !== false) {
        if (trim($line) === $h) {
            $new = false;
            break;
        }
    }
    if ($new) {
        fseek($fp, 0, SEEK_END);
        fwrite($fp, $h . "\n");
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    return $new;
}

// ---------- Erkennung ----------

/** @return array{0:string,1:string,2:string} Gerätegruppe (m/t/d), Browser, System */
function ua_family(string $ua): array
{
    $dev = 'd';
    if (preg_match('~iPad|Tablet|PlayBook|Silk~i', $ua) || (str_contains($ua, 'Android') && !str_contains($ua, 'Mobile'))) {
        $dev = 't';
    } elseif (preg_match('~Mobile|iPhone|iPod|Android~i', $ua)) {
        $dev = 'm';
    }
    $br = 'other';
    foreach (['Edg' => 'edge', 'OPR/' => 'opera', 'Opera' => 'opera', 'SamsungBrowser' => 'samsung', 'Firefox' => 'firefox', 'FxiOS' => 'firefox', 'CriOS' => 'chrome', 'Chrome' => 'chrome', 'Safari' => 'safari'] as $k => $n) {
        if (str_contains($ua, $k)) {
            $br = $n;
            break;
        }
    }
    $os = 'other';
    foreach (['iPhone' => 'ios', 'iPad' => 'ios', 'iPod' => 'ios', 'Android' => 'android', 'Windows' => 'windows', 'CrOS' => 'chromeos', 'Mac OS X' => 'macos', 'Macintosh' => 'macos', 'Linux' => 'linux'] as $k => $n) {
        if (str_contains($ua, $k)) {
            $os = $n;
            break;
        }
    }
    return [$dev, $br, $os];
}

/** Bekannte Crawler: [Familie, Kategorie (search|ai|social|other)] oder null. */
function stats_bot(string $ua): ?array
{
    static $map = [
        'googlebot' => ['google', 'search'], 'google-inspectiontool' => ['google', 'search'], 'googleother' => ['google', 'search'], 'storebot-google' => ['google', 'search'],
        'bingbot' => ['bing', 'search'], 'bingpreview' => ['bing', 'search'], 'msnbot' => ['bing', 'search'], 'duckduckbot' => ['duckduckgo', 'search'],
        'applebot' => ['apple', 'search'], 'yandex' => ['yandex', 'search'], 'baiduspider' => ['baidu', 'search'], 'ecosiabot' => ['ecosia', 'search'], 'qwantify' => ['qwant', 'search'],
        'gptbot' => ['openai', 'ai'], 'chatgpt-user' => ['openai', 'ai'], 'oai-searchbot' => ['openai', 'ai'], 'claudebot' => ['anthropic', 'ai'], 'claude-web' => ['anthropic', 'ai'],
        'perplexitybot' => ['perplexity', 'ai'], 'ccbot' => ['commoncrawl', 'ai'], 'bytespider' => ['bytedance', 'ai'], 'meta-externalagent' => ['meta-ai', 'ai'], 'amazonbot' => ['amazon', 'ai'],
        'facebookexternalhit' => ['facebook', 'social'], 'facebot' => ['facebook', 'social'], 'linkedinbot' => ['linkedin', 'social'], 'twitterbot' => ['twitter', 'social'],
        'slackbot' => ['slack', 'social'], 'discordbot' => ['discord', 'social'], 'telegrambot' => ['telegram', 'social'], 'whatsapp' => ['whatsapp', 'social'],
        'semrushbot' => ['semrush', 'other'], 'ahrefsbot' => ['ahrefs', 'other'], 'mj12bot' => ['majestic', 'other'], 'petalbot' => ['petal', 'other'],
    ];
    $l = strtolower($ua);
    foreach ($map as $needle => $v) {
        if (str_contains($l, $needle)) {
            return $v;
        }
    }
    return null;
}

function stats_is_other_bot(string $ua): bool
{
    return (bool)preg_match('~bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless|lighthouse|uptime|check|fetch|scan~i', $ua);
}

function stats_ref_domain(string $referer): string
{
    if ($referer === '') {
        return '';
    }
    $h = preg_replace('~^www\.~', '', strtolower((string)parse_url($referer, PHP_URL_HOST)));
    $own = preg_replace('~^www\.~', '', strtolower(explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0]));
    return ($h !== '' && $h !== $own) ? substr(preg_replace('~[^a-z0-9.-]~', '', $h), 0, 60) : '';
}

/** Kategorie einer verweisenden Domain. */
function stats_ref_category(string $d): string
{
    $groups = [
        'search' => ['google.', 'bing.', 'duckduckgo.', 'ecosia.', 'qwant.', 'yahoo.', 'startpage.', 'brave.', 'search.', 'yandex.', 'baidu.', 'perplexity.'],
        'social' => ['linkedin.', 'lnkd.in', 'instagram.', 'facebook.', 'fb.', 't.co', 'twitter.', 'x.com', 'bsky.', 'mastodon', 'threads.', 'youtube.', 'youtu.be', 'tiktok.', 'xing.', 'reddit.', 'whatsapp.', 'telegram.', 'pinterest.'],
        'media' => ['butenunbinnen.', 'radiobremen.', 'ard.', 'ardaudiothek.', 'tagesschau.', 'wdr.', 'zdf.', 'funk.net', 'srf.ch', 'spiegel.', 'welt.de', 'goodnews-magazin.', 'y-kollektiv.', 'deutschlandfunk.', 'dw.com', 'taz.de', 'zeit.de', 'sueddeutsche.', 'faz.net'],
    ];
    foreach ($groups as $cat => $needles) {
        foreach ($needles as $n) {
            if (str_contains($d, $n)) {
                return $cat;
            }
        }
    }
    return 'other';
}

function stats_append(string $name, string $line): void
{
    if (stats_ensure_dir()) {
        @file_put_contents(stats_dir() . '/' . $name, $line . "\n", FILE_APPEND | LOCK_EX);
    }
}

// ---------- Erfassen ----------

function stats_hit(string $page): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || !stats_enabled()) {
        return;
    }
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if ($ua === '') {
        return;
    }
    $page = preg_replace('~[^a-z0-9-]~', '', $page);
    if ($bot = stats_bot($ua)) {
        stats_append('bots-' . date('Y-m') . '.dat', date('Y-m-d H') . "\t" . $bot[0] . "\t" . $bot[1] . "\t" . $page);
        if (random_int(1, 300) === 1) {
            stats_prune_old();
        }
        return;
    }
    if (($_SERVER['HTTP_DNT'] ?? '') === '1' || stats_is_other_bot($ua)) {
        return;
    }
    if (!stats_ensure_dir()) {
        return;
    }
    [$dev, $br, $os] = ua_family($ua);
    $visit = stats_is_new_visit() ? '1' : '0';
    stats_append(date('Y-m') . '.log', date('Y-m-d H') . "\t" . $page . "\t" . $dev . "\t" . stats_ref_domain((string)($_SERVER['HTTP_REFERER'] ?? '')) . "\t" . $visit . "\t" . $br . "\t" . $os . "\t");
    if (random_int(1, 300) === 1) {
        stats_prune_old();
    }
}

/** Kleine Ereigniszähler (Klicks, erreichte Abschnitte). Wird von stat.php aufgerufen; antwortet immer mit 204. */
function stats_event(): never
{
    header('Cache-Control: no-store');
    http_response_code(204);
    $ok = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && stats_enabled() && ($_SERVER['HTTP_DNT'] ?? '') !== '1';
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0]) {
        $ok = false;
    }
    if (!in_array((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? 'same-origin'), ['same-origin', 'none'], true)) {
        $ok = false;
    }
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if ($ua === '' || stats_bot($ua) || stats_is_other_bot($ua)) {
        $ok = false;
    }
    $type = (string)($_POST['e'] ?? '');
    $key = strtolower((string)($_POST['k'] ?? ''));
    $rules = [
        'clip' => '~^\d{1,9}$~', 'mail' => '~^(kopfzeile|kontakt|menue)$~', 'social' => '~^[a-z0-9-]{1,30}$~', 'cv' => '~^pdf$~',
        'podcast' => '~^[a-z0-9-]{1,30}$~', 'section' => '~^(arbeiten|podcast|ueber|lebenslauf|offtherecord|kontakt)$~', 'lang' => '~^(de|en)$~',
    ];
    if ($ok && isset($rules[$type]) && preg_match($rules[$type], $key) && stats_ensure_dir() && stats_is_new_visit('ev|' . $type . '|' . $key)) {
        stats_append('events-' . date('Y-m') . '.dat', date('Y-m-d H') . "\t" . $type . "\t" . $key);
    }
    exit;
}

/** Nicht vorhandene Adresse protokollieren (ohne IP). */
function stats_log_404(string $path, string $referer = ''): void
{
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if (!stats_enabled() || ($_SERVER['HTTP_DNT'] ?? '') === '1' || $ua === '' || stats_bot($ua) || stats_is_other_bot($ua)) {
        return;
    }
    $p = (string)parse_url($path, PHP_URL_PATH);
    $p = substr(preg_replace('~[^A-Za-z0-9/._-]~', '_', $p !== '' ? $p : '/'), 0, 100);
    if (preg_match('~wp-|\.env|phpmyadmin|xmlrpc|\.git|cgi-bin|\.sql|\.zip|\.bak|vendor/|shell|\.asp|\.jsp|eval|passwd|config\.|/admin/|setup|backup~i', $p)) {
        return; // Scanner und Angriffsversuche nicht mitzählen
    }
    if (stats_ensure_dir()) {
        stats_append('404-' . date('Y-m') . '.dat', date('Y-m-d H') . "\t" . $p . "\t" . stats_ref_domain($referer));
    }
}

/** Sehr alte Dateien entfernen (Sicherheitsnetz). */
function stats_prune_old(): void
{
    foreach (glob(stats_dir() . '/*') ?: [] as $f) {
        if (is_file($f) && preg_match('~/(\d{4}-\d{2}\.log|(bots|events|404)-\d{4}-\d{2}\.dat)$~', $f) && filemtime($f) < time() - 800 * 86400) {
            @unlink($f);
        }
    }
}

// ---------- Auswerten ----------

function stats_day_new(): array
{
    return ['v' => 0, 'h' => 0, 'm' => 0, 't' => 0, 'd' => 0, 'de' => 0, 'en' => 0, 'direct' => 0, 'hr' => array_fill(0, 24, 0),
        'pages' => [], 'refs' => [], 'br' => [], 'os' => [], 'camp' => [], 'ev' => [], 'bots' => [], 'e404' => []];
}

function stats_inc(array &$map, string $key, int $by = 1): void
{
    $map[$key] = ($map[$key] ?? 0) + $by;
}

/** Eine Zeile (nach Dateityp) in die Tagessumme einrechnen. */
function stats_apply_line(array &$day, string $type, array $p): void
{
    $hour = (int)substr($p[0], 11, 2);
    switch ($type) {
        case 'main':
            $day['h']++;
            if (($p[4] ?? '1') === '0') {
                return;
            }
            $day['v']++;
            $day['hr'][$hour]++;
            $dev = in_array($p[2] ?? 'd', ['m', 't', 'd'], true) ? $p[2] : 'd';
            $day[$dev]++;
            $page = (string)($p[1] ?? '');
            $day[str_ends_with($page, '-en') ? 'en' : 'de']++;
            stats_inc($day['pages'], $page);
            if (($p[3] ?? '') !== '') {
                stats_inc($day['refs'], $p[3]);
            } else {
                $day['direct']++;
            }
            if (($p[5] ?? '') !== '') {
                stats_inc($day['br'], $p[5]);
            }
            if (($p[6] ?? '') !== '') {
                stats_inc($day['os'], $p[6]);
            }
            if (($p[7] ?? '') !== '') {
                stats_inc($day['camp'], $p[7]);
            }
            break;
        case 'bots':
            stats_inc($day['bots'], ($p[1] ?? '?') . '|' . ($p[2] ?? 'other'));
            break;
        case 'events':
            stats_inc($day['ev'], ($p[1] ?? '') . '|' . ($p[2] ?? ''));
            break;
        case 'e404':
            stats_inc($day['e404'], (string)($p[1] ?? '/'));
            break;
    }
}

/** @return list<array{0:string,1:string}> Dateien mit Typ */
function stats_files(): array
{
    $out = [];
    foreach (glob(stats_dir() . '/20??-??.log') ?: [] as $f) {
        $out[] = [$f, 'main'];
    }
    foreach (['bots' => 'bots', 'events' => 'events', '404' => 'e404'] as $prefix => $type) {
        foreach (glob(stats_dir() . '/' . $prefix . '-20??-??.dat') ?: [] as $f) {
            $out[] = [$f, $type];
        }
    }
    return $out;
}

function stats_archive_load(): array
{
    $f = stats_dir() . '/archive.json';
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return is_array($d) ? $d + ['upto' => '', 'checked' => '', 'days' => []] : ['upto' => '', 'checked' => '', 'days' => []];
}

/** Rohdaten für einen Zeitraum in die vorbereiteten Tage einrechnen. */
function stats_read_raw(array &$days, string $from, string $to): void
{
    foreach (stats_files() as [$f, $type]) {
        if (!preg_match('~(\d{4}-\d{2})\.(log|dat)$~', $f, $m) || $m[1] . '-31' < $from || $m[1] . '-01' > $to) {
            continue;
        }
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $p = explode("\t", $line);
            $date = substr($p[0], 0, 10);
            if ($date >= $from && $date <= $to && isset($days[$date])) {
                stats_apply_line($days[$date], $type, $p);
            }
        }
    }
}

/** Tageswerte für [$from, $to] (Archiv + Rohdaten). @return array<string,array> */
function stats_collect(string $from, string $to): array
{
    $days = [];
    for ($d = new DateTimeImmutable($from); $d->format('Y-m-d') <= $to; $d = $d->modify('+1 day')) {
        $days[$d->format('Y-m-d')] = stats_day_new();
    }
    $arch = stats_archive_load();
    foreach ($arch['days'] as $date => $row) {
        if (isset($days[$date])) {
            $days[$date] = array_replace(stats_day_new(), $row);
        }
    }
    $rawFrom = $arch['upto'] !== '' ? max($from, date('Y-m-d', strtotime($arch['upto'] . ' +1 day'))) : $from;
    if ($rawFrom <= $to) {
        stats_read_raw($days, $rawFrom, $to);
    }
    return $days;
}

/** Summen und zusammengeführte Auswertungen über mehrere Tage. */
function stats_totals(array $days): array
{
    $t = stats_day_new();
    $t['bots_last'] = [];
    $t['e404_last'] = [];
    $hm = array_fill(1, 7, array_fill(0, 24, 0));
    foreach ($days as $date => $d) {
        foreach (['v', 'h', 'm', 't', 'd', 'de', 'en', 'direct'] as $k) {
            $t[$k] += (int)$d[$k];
        }
        $wd = (int)date('N', strtotime($date));
        foreach ($d['hr'] as $h => $n) {
            $t['hr'][$h] += $n;
            $hm[$wd][$h] += $n;
        }
        foreach (['pages', 'refs', 'br', 'os', 'camp', 'ev', 'bots', 'e404'] as $k) {
            foreach ($d[$k] as $key => $n) {
                stats_inc($t[$k], (string)$key, (int)$n);
                if ($k === 'bots') {
                    $t['bots_last'][$key] = $date;
                }
                if ($k === 'e404') {
                    $t['e404_last'][$key] = $date;
                }
            }
        }
    }
    $t['hm'] = $hm;
    foreach (['pages', 'refs', 'br', 'os', 'camp', 'e404'] as $k) {
        arsort($t[$k]);
    }
    return $t;
}

/** Rohdaten älter als 90 Tage zu Tageswerten verdichten und aus den Dateien entfernen. */
function stats_archive(): void
{
    if (!stats_ensure_dir()) {
        return;
    }
    $cutoff = date('Y-m-d', strtotime('-' . STATS_RAW_DAYS . ' days'));
    $arch = stats_archive_load();
    $old = [];
    foreach (stats_files() as [$f, $type]) {
        $fp = @fopen($f, 'c+');
        if (!$fp) {
            continue;
        }
        flock($fp, LOCK_EX);
        $keep = [];
        $moved = false;
        while (($line = fgets($fp)) !== false) {
            $line = rtrim($line, "\r\n");
            if ($line === '') {
                continue;
            }
            $p = explode("\t", $line);
            $date = substr($p[0], 0, 10);
            if ($date < $cutoff) {
                $old[$date] ??= stats_day_new();
                stats_apply_line($old[$date], $type, $p);
                $moved = true;
            } else {
                $keep[] = $line;
            }
        }
        if ($moved) {
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, $keep ? implode("\n", $keep) . "\n" : '');
        }
        flock($fp, LOCK_UN);
        fclose($fp);
        if ($moved && !$keep) {
            @unlink($f);
        }
    }
    foreach ($old as $date => $row) {
        if (isset($arch['days'][$date])) {
            // Tag war schon (teilweise) archiviert: addieren
            $cur = array_replace(stats_day_new(), $arch['days'][$date]);
            foreach (['v', 'h', 'm', 't', 'd', 'de', 'en', 'direct'] as $k) {
                $cur[$k] += $row[$k];
            }
            foreach ($row['hr'] as $h => $n) {
                $cur['hr'][$h] += $n;
            }
            foreach (['pages', 'refs', 'br', 'os', 'camp', 'ev', 'bots', 'e404'] as $k) {
                foreach ($row[$k] as $key => $n) {
                    stats_inc($cur[$k], (string)$key, (int)$n);
                }
            }
            $row = $cur;
        }
        $arch['days'][$date] = $row;
    }
    $arch['upto'] = max((string)$arch['upto'], date('Y-m-d', strtotime($cutoff . ' -1 day')));
    $limit = date('Y-m-d', strtotime('-800 days'));
    foreach (array_keys($arch['days']) as $d) {
        if ($d < $limit) {
            unset($arch['days'][$d]);
        }
    }
    ksort($arch['days']);
    $arch['checked'] = date('Y-m-d');
    @file_put_contents(stats_dir() . '/archive.json', json_encode($arch, JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function stats_archive_if_due(): void
{
    if (stats_archive_load()['checked'] !== date('Y-m-d')) {
        stats_archive();
    }
}

/** Auswertung der letzten 30 Tage (Übersicht). */
function stats_summary(): array
{
    stats_cleanup();
    stats_archive_if_due();
    $to = date('Y-m-d');
    $days = stats_collect(date('Y-m-d', strtotime('-29 days')), $to);
    $t = stats_totals($days);
    $vis = array_map(fn($d) => $d['v'], $days);
    $vals = array_values($vis);
    $pages = $t['pages'];
    arsort($pages);
    return [
        'days' => $vis, 'total' => $t['v'], 'today' => end($vals) ?: 0, 'week' => array_sum(array_slice($vals, -7)), 'hits' => $t['h'],
        'pages' => $pages, 'dev' => ['m' => $t['m'], 't' => $t['t'], 'd' => $t['d']], 'refs' => array_slice($t['refs'], 0, 8, true),
    ];
}

/** CSV mit Tageswerten (Semikolon, UTF-8 mit BOM für Excel). */
function stats_csv(array $days): string
{
    $o = "\xEF\xBB\xBF" . "Datum;Besuche;Aufrufe;Handy;Tablet;Rechner;Deutsch;Englisch\n";
    foreach ($days as $date => $d) {
        $o .= implode(';', [$date, $d['v'], $d['h'], $d['m'], $d['t'], $d['d'], $d['de'], $d['en']]) . "\n";
    }
    return $o;
}

function stats_delete_all(): int
{
    $n = 0;
    foreach (glob(stats_dir() . '/*') ?: [] as $f) {
        if (is_file($f) && basename($f) !== 'disabled') {
            @unlink($f);
            $n++;
        }
    }
    return $n;
}
