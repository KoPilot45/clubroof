<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/stats.php';

const STAT_LABELS = [
    'br' => ['chrome' => 'Chrome', 'safari' => 'Safari', 'firefox' => 'Firefox', 'edge' => 'Edge', 'opera' => 'Opera', 'samsung' => 'Samsung Internet', 'other' => 'Andere'],
    'os' => ['windows' => 'Windows', 'macos' => 'macOS', 'ios' => 'iOS', 'android' => 'Android', 'linux' => 'Linux', 'chromeos' => 'ChromeOS', 'other' => 'Andere'],
    'bot' => ['google' => 'Google', 'bing' => 'Bing', 'duckduckgo' => 'DuckDuckGo', 'apple' => 'Apple', 'yandex' => 'Yandex', 'baidu' => 'Baidu', 'ecosia' => 'Ecosia', 'qwant' => 'Qwant',
        'openai' => 'OpenAI', 'anthropic' => 'Anthropic (Claude)', 'perplexity' => 'Perplexity', 'commoncrawl' => 'Common Crawl', 'bytedance' => 'ByteDance', 'meta-ai' => 'Meta (KI)', 'amazon' => 'Amazon',
        'facebook' => 'Facebook', 'linkedin' => 'LinkedIn', 'twitter' => 'X / Twitter', 'slack' => 'Slack', 'discord' => 'Discord', 'telegram' => 'Telegram', 'whatsapp' => 'WhatsApp',
        'semrush' => 'Semrush', 'ahrefs' => 'Ahrefs', 'majestic' => 'Majestic', 'petal' => 'Petal'],
    'section' => ['arbeiten' => 'Arbeiten / Showreel', 'podcast' => 'Podcast', 'ueber' => 'Über mich', 'lebenslauf' => 'Stationen & Lebenslauf', 'offtherecord' => 'Off the record', 'kontakt' => 'Kontakt'],
    'mail' => ['kopfzeile' => 'Kopfzeile', 'kontakt' => 'Kontaktbereich', 'menue' => 'Handy-Menü'],
    'cat' => ['search' => 'Suchmaschinen', 'social' => 'Soziale Netzwerke', 'media' => 'Redaktionen & Sender', 'other' => 'Sonstige', 'direct' => 'Direkt / unbekannt'],
    'botcat' => ['search' => 'Suchmaschinen', 'ai' => 'KI-Dienste', 'social' => 'Soziale Netzwerke / Vorschau', 'other' => 'Sonstige'],
    'page' => ['home' => 'Startseite', 'home-en' => 'Startseite (Englisch)', 'impressum' => 'Impressum', 'datenschutz' => 'Datenschutz', 'impressum-en' => 'Imprint', 'datenschutz-en' => 'Privacy'],
];

function wd_de(string $d): string
{
    return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][(int)date('N', strtotime($d)) - 1];
}

function stat_label(string $group, string $key): string
{
    return STAT_LABELS[$group][$key] ?? $key;
}

function stat_nice_max(int $m): int
{
    if ($m <= 5) {
        return 5;
    }
    $p = 10 ** (int)floor(log10($m));
    foreach ([1, 2, 5, 10] as $f) {
        if ($m <= $f * $p) {
            return $f * $p;
        }
    }
    return 10 * $p;
}

/** Balkendiagramm als Inline-SVG: Besuche, gleitender Durchschnitt, Vorperiode, Veröffentlichungen. */
function stats_chart_svg(array $vis, array $prev, array $markers): string
{
    $dates = array_keys($vis);
    $vals = array_values($vis);
    $pv = array_values($prev);
    $weekly = count($vals) > 120;
    if ($weekly) {
        $nd = [];
        $nv = [];
        foreach ($dates as $i => $d) {
            $wk = date('Y-m-d', strtotime('monday this week', strtotime($d)));
            $nv[$wk] = ($nv[$wk] ?? 0) + $vals[$i];
        }
        $dates = array_keys($nv);
        $vals = array_values($nv);
        $pv = array_map('array_sum', array_chunk($pv, 7));
    }
    $n = max(1, count($vals));
    $W = 960;
    $H = 260;
    $ml = 46;
    $mr = 10;
    $mt = 16;
    $mb = 28;
    $pw = $W - $ml - $mr;
    $ph = $H - $mt - $mb;
    $max = stat_nice_max(max(1, max($vals ?: [0]), max($pv ?: [0])));
    $step = $pw / $n;
    $bw = max(1.5, $step * 0.78);
    $y = fn($v) => $mt + $ph - ($v / $max) * $ph;
    $x = fn($i) => $ml + $i * $step;
    $svg = '<svg class="chart" viewBox="0 0 ' . $W . ' ' . $H . '" role="img" aria-labelledby="chart-t chart-d"><title id="chart-t">Besuche pro ' . ($weekly ? 'Woche' : 'Tag') . '</title><desc id="chart-d">Balkendiagramm; höchster Wert ' . max($vals ?: [0]) . '. Die Werte stehen auch in der Tabelle darunter.</desc>';
    for ($g = 0; $g <= 4; $g++) {
        $gv = $max * $g / 4;
        $svg .= '<line x1="' . $ml . '" x2="' . ($W - $mr) . '" y1="' . round($y($gv), 1) . '" y2="' . round($y($gv), 1) . '" class="grid"/><text x="' . ($ml - 6) . '" y="' . round($y($gv) + 4, 1) . '" class="ax" text-anchor="end">' . (int)$gv . '</text>';
    }
    if (!$weekly) {
        foreach ($dates as $i => $d) {
            if ((int)date('N', strtotime($d)) >= 6) {
                $svg .= '<rect x="' . round($x($i), 1) . '" y="' . $mt . '" width="' . round($step, 1) . '" height="' . $ph . '" class="we"/>';
            }
        }
    }
    foreach ($vals as $i => $v) {
        $bh = ($v / $max) * $ph;
        $label = $weekly ? 'Woche ab ' . date('d.m.', strtotime($dates[$i])) : wd_de($dates[$i]) . ' ' . date('d.m.', strtotime($dates[$i]));
        $svg .= '<rect x="' . round($x($i) + ($step - $bw) / 2, 1) . '" y="' . round($mt + $ph - $bh, 1) . '" width="' . round($bw, 1) . '" height="' . round(max($bh, $v > 0 ? 1.5 : 0), 1) . '" class="bar"><title>' . e($label) . ': ' . $v . ' Besuche</title></rect>';
    }
    if ($pv && array_sum($pv) > 0) {
        $pts = [];
        foreach ($pv as $i => $v) {
            if ($i < $n) {
                $pts[] = round($x($i) + $step / 2, 1) . ',' . round($y($v), 1);
            }
        }
        $svg .= '<polyline points="' . implode(' ', $pts) . '" class="prev"><title>Vorperiode</title></polyline>';
    }
    if (!$weekly && $n > 6) {
        $pts = [];
        foreach ($vals as $i => $v) {
            $slice = array_slice($vals, max(0, $i - 6), min(7, $i + 1));
            $pts[] = round($x($i) + $step / 2, 1) . ',' . round($y(array_sum($slice) / count($slice)), 1);
        }
        $svg .= '<polyline points="' . implode(' ', $pts) . '" class="avg"><title>Gleitender 7-Tage-Durchschnitt</title></polyline>';
    }
    foreach ($markers as $m) {
        $idx = array_search($weekly ? date('Y-m-d', strtotime('monday this week', strtotime($m['date']))) : $m['date'], $dates, true);
        if ($idx !== false) {
            $svg .= '<g class="mk"><line x1="' . round($x($idx) + $step / 2, 1) . '" x2="' . round($x($idx) + $step / 2, 1) . '" y1="' . ($mt + 8) . '" y2="' . ($mt + $ph) . '"/><circle cx="' . round($x($idx) + $step / 2, 1) . '" cy="' . ($mt + 6) . '" r="5"><title>' . e($m['title']) . '</title></circle></g>';
        }
    }
    $ticks = array_unique(array_map(fn($k) => (int)round(($n - 1) * $k / 5), range(0, 5)));
    foreach ($ticks as $i) {
        $svg .= '<text x="' . round($x($i) + $step / 2, 1) . '" y="' . ($H - 8) . '" class="ax" text-anchor="middle">' . e(date('d.m.', strtotime($dates[$i] ?? 'now'))) . '</text>';
    }
    return $svg . '</svg>';
}

function stats_heatmap_html(array $hm): string
{
    $max = 1;
    foreach ($hm as $row) {
        $max = max($max, max($row));
    }
    $wd = [1 => 'Mo', 2 => 'Di', 3 => 'Mi', 4 => 'Do', 5 => 'Fr', 6 => 'Sa', 7 => 'So'];
    $o = '<div class="hm-wrap"><table class="hm" aria-label="Besuche nach Wochentag und Uhrzeit"><thead><tr><th></th>';
    for ($h = 0; $h < 24; $h++) {
        $o .= '<th scope="col">' . ($h % 3 === 0 ? $h : '') . '</th>';
    }
    $o .= '</tr></thead><tbody>';
    foreach ($wd as $i => $label) {
        $o .= '<tr><th scope="row">' . $label . '</th>';
        for ($h = 0; $h < 24; $h++) {
            $n = $hm[$i][$h];
            $o .= '<td style="--a:' . ($n ? round(0.12 + 0.88 * $n / $max, 2) : 0) . '" title="' . $label . ' ' . $h . '–' . ($h + 1) . ' Uhr: ' . $n . ' Besuche"></td>';
        }
        $o .= '</tr>';
    }
    return $o . '</tbody></table></div>';
}

function stat_bar_list(array $rows, int $total, string $unit = ''): string
{
    if (!$rows) {
        return '<p class="hint">Noch keine Daten.</p>';
    }
    $o = '<ul class="barlist">';
    $max = max(1, max($rows));
    foreach ($rows as $label => $n) {
        $o .= '<li><span class="bl-l">' . e((string)$label) . '</span><span class="bl-b"><span style="width:' . max(2, (int)round($n / $max * 100)) . '%"></span></span><span class="bl-n">' . $n . ($total > 0 ? ' <small>' . (int)round($n / $total * 100) . ' %</small>' : '') . $unit . '</span></li>';
    }
    return $o . '</ul>';
}

function view_stats(array $user): void
{
    stats_cleanup();
    stats_archive_if_due();
    $range = (int)($_GET['r'] ?? 30);
    if (!in_array($range, [7, 30, 90, 365], true)) {
        $range = 30;
    }
    $isOwner = $user['role'] === 'owner';
    $to = date('Y-m-d');
    $from = date('Y-m-d', strtotime('-' . ($range - 1) . ' days'));
    $pfrom = date('Y-m-d', strtotime($from . ' -' . $range . ' days'));
    $all = stats_collect($pfrom, $to);
    $days = array_filter($all, fn($k) => $k >= $from, ARRAY_FILTER_USE_KEY);
    $pdays = array_filter($all, fn($k) => $k < $from, ARRAY_FILTER_USE_KEY);
    $t = stats_totals($days);
    $pt = stats_totals($pdays);
    $vis = array_map(fn($d) => $d['v'], $days);
    $delta = $pt['v'] > 0 ? (int)round(($t['v'] - $pt['v']) / $pt['v'] * 100) : null;
    $best = $vis ? array_keys($vis, max($vis))[0] : '';

    $markers = [];
    foreach (dash_activity(300) as $a) {
        $d = date('Y-m-d', $a['at']);
        if ($d >= $from && str_contains($a['text'], 'veröffentlicht') && count($markers) < 40) {
            $markers[] = ['date' => $d, 'title' => date('d.m.Y', $a['at']) . ': ' . who_name($a['who']) . ' – ' . $a['text']];
        }
    }

    layout_start($user, 'Statistik', 'stats', true);
    echo '<p class="lead">Anonyme Reichweite ohne Cookies und ohne Speicherung von IP-Adressen. Ein Gerät zählt höchstens einmal pro Stunde als Besuch.</p>';
    echo '<div class="rangebar" role="group" aria-label="Zeitraum">';
    foreach ([7 => '7 Tage', 30 => '30 Tage', 90 => '90 Tage', 365 => '12 Monate'] as $r => $l) {
        echo '<a class="btn small ' . ($r === $range ? '' : 'ghost') . '" href="' . a('p=stats&r=' . $r) . '"' . ($r === $range ? ' aria-current="true"' : '') . '>' . $l . '</a>';
    }
    echo '<form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="stats_csv"><input type="hidden" name="r" value="' . $range . '"><button class="btn small ghost">CSV herunterladen</button></form></div>';
    if (!stats_enabled()) {
        echo '<div class="flash warn" role="status">Die Statistik ist ausgeschaltet. Es werden keine neuen Daten erfasst.</div>';
    }

    // Kennzahlen
    $avg = round($t['v'] / $range, 1);
    echo '<div class="kpis" style="--n:5">';
    echo kpi('Besuche', (string)$t['v'], $delta === null ? 'Vorperiode: keine Daten' : ($delta >= 0 ? '↑ ' : '↓ ') . abs($delta) . ' % zur Vorperiode (' . $pt['v'] . ')', $delta === null ? '' : ($delta >= 0 ? 'ok' : 'warn'));
    echo kpi('Aufrufe', (string)$t['h'], 'alle Seitenaufrufe');
    echo kpi('Ø pro Tag', str_replace('.', ',', (string)$avg), 'Besuche');
    echo kpi('Bester Tag', $best !== '' && $vis[$best] > 0 ? (string)$vis[$best] : '–', $best !== '' && $vis[$best] > 0 ? date('d.m.Y', strtotime($best)) : '');
    echo kpi('Englisch', $t['v'] ? (int)round($t['en'] / $t['v'] * 100) . ' %' : '–', $t['en'] . ' von ' . $t['v'] . ' Besuchen');
    echo '</div>';

    // Diagramm
    echo '<section class="card wide"><h2>Besuche im Verlauf <span class="score">' . date('d.m.Y', strtotime($from)) . ' – ' . date('d.m.Y', strtotime($to)) . '</span></h2>';
    echo stats_chart_svg($vis, array_map(fn($d) => $d['v'], $pdays), $markers);
    echo '<p class="legend"><span class="lg lg-bar"></span>Besuche <span class="lg lg-avg"></span>Ø 7 Tage <span class="lg lg-prev"></span>Vorperiode <span class="lg lg-mk"></span>Veröffentlichung · <span class="lg lg-we"></span>Wochenende</p>';
    echo '<details class="fold"><summary>Werte als Tabelle</summary><div class="tbl-scroll"><table class="mini"><thead><tr><th>Datum</th><th>Besuche</th><th>Aufrufe</th><th>Handy</th><th>Tablet</th><th>Rechner</th></tr></thead><tbody>';
    foreach (array_reverse($days, true) as $d => $r) {
        echo '<tr><td>' . e(wd_de($d) . ' ' . date('d.m.Y', strtotime($d))) . '</td><td>' . $r['v'] . '</td><td>' . $r['h'] . '</td><td>' . $r['m'] . '</td><td>' . $r['t'] . '</td><td>' . $r['d'] . '</td></tr>';
    }
    echo '</tbody></table></div></details></section>';

    echo '<div class="dash-cols"><div class="dash-col">';

    // Heatmap
    echo '<section class="card"><h2>Wann kommen Besucher?</h2><p class="hint">Besuche nach Wochentag und Uhrzeit – je dunkler, desto mehr. Gut, um Posts und Veröffentlichungen zu planen.</p>' . stats_heatmap_html($t['hm']) . '</section>';

    // Verweise nach Kategorie
    $cats = ['direct' => $t['direct'], 'search' => 0, 'social' => 0, 'media' => 0, 'other' => 0];
    $domains = ['search' => [], 'social' => [], 'media' => [], 'other' => []];
    foreach ($t['refs'] as $dom => $n) {
        $c = stats_ref_category((string)$dom);
        $cats[$c] += $n;
        $domains[$c][$dom] = $n;
    }
    $catRows = [];
    foreach ($cats as $k => $n) {
        $catRows[stat_label('cat', $k)] = $n;
    }
    arsort($catRows);
    echo '<section class="card"><h2>Woher kommen Besucher?</h2>' . stat_bar_list($catRows, $t['v']);
    foreach (['search', 'social', 'media', 'other'] as $c) {
        if ($domains[$c]) {
            echo '<details class="fold"><summary>' . e(stat_label('cat', $c)) . ' <span class="cnt">' . array_sum($domains[$c]) . '</span></summary><ul class="plain">';
            foreach (array_slice($domains[$c], 0, 10, true) as $dom => $n) {
                echo '<li>' . e((string)$dom) . ': <strong>' . $n . '</strong></li>';
            }
            echo '</ul></details>';
        }
    }
    echo '<p class="hint">„Direkt / unbekannt“: Der Browser hat keine Herkunft übermittelt (direkter Aufruf, Mail- oder Messenger-Link, viele Apps).</p></section>';


    echo '</div><div class="dash-col">';

    // Ereignisse
    $ev = [];
    foreach ($t['ev'] as $k => $n) {
        [$ty, $key] = array_pad(explode('|', (string)$k, 2), 2, '');
        $ev[$ty][$key] = $n;
    }
    $titles = [];
    foreach (items('clips', false, true) as $c) {
        $titles[(string)$c['_id']] = trim((string)$c['title']) ?: ('Referenz #' . $c['_id']);
    }
    echo '<section class="card"><h2>Was wird angeklickt?</h2><p class="hint">Anonyme Summen, höchstens ein Klick je Gerät und Stunde.</p>';
    $clipRows = [];
    foreach ($ev['clip'] ?? [] as $id => $n) {
        $clipRows[mb_strimwidth($titles[(string)$id] ?? ('Referenz #' . $id . ' (gelöscht)'), 0, 60, '…')] = $n;
    }
    arsort($clipRows);
    echo '<h3>Referenzen</h3>' . stat_bar_list(array_slice($clipRows, 0, 10, true), 0);
    $contact = [];
    foreach ($ev['mail'] ?? [] as $k => $n) {
        $contact['E-Mail: ' . stat_label('mail', (string)$k)] = $n;
    }
    foreach ($ev['social'] ?? [] as $k => $n) {
        $contact['Profil: ' . $k] = $n;
    }
    foreach ($ev['cv'] ?? [] as $n) {
        $contact['Lebenslauf (PDF)'] = $n;
    }
    arsort($contact);
    echo '<h3>Kontakt &amp; Profile</h3>' . stat_bar_list($contact, 0);
    $pod = [];
    foreach ($ev['podcast'] ?? [] as $k => $n) {
        $pod[(string)$k] = $n;
    }
    arsort($pod);
    echo '<h3>Podcast-Plattformen</h3>' . stat_bar_list($pod, 0);
    $lang = [];
    foreach ($ev['lang'] ?? [] as $k => $n) {
        $lang['Wechsel zu ' . ($k === 'en' ? 'Englisch' : 'Deutsch')] = $n;
    }
    echo $lang ? '<h3>Sprache</h3>' . stat_bar_list($lang, 0) : '';
    echo '</section>';

    // Erreichte Abschnitte
    $sec = [];
    foreach (STAT_LABELS['section'] as $k => $l) {
        $sec[$l] = (int)($ev['section'][$k] ?? 0);
    }
    echo '<section class="card"><h2>Wie weit wird gescrollt?</h2><p class="hint">Anteil der Besuche, die den Abschnitt erreicht haben.</p>';
    echo $t['v'] ? stat_bar_list($sec, $t['v']) : '<p class="hint">Noch keine Daten.</p>';
    echo '</section>';

    // Geräte
    $dev = ['Handy' => $t['m'], 'Tablet' => $t['t'], 'Rechner' => $t['d']];
    $br = [];
    foreach ($t['br'] as $k => $n) {
        $br[stat_label('br', (string)$k)] = $n;
    }
    $os = [];
    foreach ($t['os'] as $k => $n) {
        $os[stat_label('os', (string)$k)] = $n;
    }
    $pg = [];
    foreach ($t['pages'] as $k => $n) {
        $pg[stat_label('page', (string)$k)] = $n;
    }
    echo '<section class="card"><h2>Geräte &amp; Seiten</h2><h3>Gerätegruppe</h3>' . stat_bar_list($dev, $t['v']) . '<h3>Browser</h3>' . stat_bar_list(array_slice($br, 0, 6, true), $t['v']) . '<h3>System</h3>' . stat_bar_list(array_slice($os, 0, 6, true), $t['v']) . '<h3>Seiten</h3>' . stat_bar_list($pg, $t['v']) . '</section>';
    echo '</div></div>';

    // Crawler
    $botCat = [];
    foreach ($t['bots'] as $k => $n) {
        [$fam, $cat] = array_pad(explode('|', (string)$k, 2), 2, 'other');
        $botCat[$cat][$fam] = ['n' => $n, 'last' => $t['bots_last'][$k] ?? ''];
    }
    echo '<section class="card wide"><h2>Crawler &amp; Vorschau-Abrufe <span class="score">nicht in den Besuchen enthalten</span></h2><p class="hint">Bekannte Suchmaschinen, KI-Dienste und Link-Vorschauen. Zeigt, ob die Seite gefunden und indexiert wird.</p>';
    if (!$botCat) {
        echo '<p class="hint">Im gewählten Zeitraum noch keine Abrufe bekannter Crawler.</p>';
    } else {
        echo '<table class="mini"><thead><tr><th>Art</th><th>Dienst</th><th>Abrufe</th><th>Zuletzt</th></tr></thead><tbody>';
        foreach (['search', 'ai', 'social', 'other'] as $c) {
            foreach ($botCat[$c] ?? [] as $fam => $r) {
                echo '<tr><td>' . e(stat_label('botcat', $c)) . '</td><td>' . e(stat_label('bot', $fam)) . '</td><td>' . $r['n'] . '</td><td>' . ($r['last'] ? e(date('d.m.Y', strtotime($r['last']))) : '') . '</td></tr>';
            }
        }
        echo '</tbody></table>';
    }
    echo '</section>';

    // 404
    echo '<section class="card wide"><h2>Nicht gefundene Adressen (404)</h2><p class="hint">Adressen, die aufgerufen wurden, aber nicht existieren – etwa falsche oder alte Links von außen. Angriffsversuche werden nicht gezählt.</p>';
    if (!$t['e404']) {
        echo '<p class="hint">Keine nicht gefundenen Adressen im gewählten Zeitraum.</p>';
    } else {
        echo '<table class="mini"><thead><tr><th>Adresse</th><th>Aufrufe</th><th>Zuletzt</th></tr></thead><tbody>';
        foreach (array_slice($t['e404'], 0, 20, true) as $path => $n) {
            echo '<tr><td><code>' . e((string)$path) . '</code></td><td>' . $n . '</td><td>' . e(date('d.m.Y', strtotime($t['e404_last'][$path] ?? 'now'))) . '</td></tr>';
        }
        echo '</tbody></table>';
    }
    echo '</section>';

    // Verwaltung
    echo '<section class="card wide"><h2>Einstellungen &amp; Daten</h2><p class="hint">Stundenwerte werden nach ' . STATS_RAW_DAYS . ' Tagen zu Tageswerten zusammengefasst; Tageswerte bleiben bis zu 2 Jahre erhalten.</p>';
    if ($isOwner) {
        echo '<div class="actions"><form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="stats_toggle"><button class="btn ghost">' . (stats_enabled() ? 'Statistik ausschalten' : 'Statistik einschalten') . '</button></form> <form method="post" action="' . a() . '" class="inline" data-confirm="Alle gespeicherten Statistikdaten endgültig löschen?">' . csrf_field($user) . '<input type="hidden" name="action" value="stats_delete"><button class="btn danger-o">Alle Statistikdaten löschen</button></form></div>';
    } else {
        echo '<p class="hint">Einschalten, Ausschalten und Löschen können nur Inhaber.</p>';
    }
    echo '</section>';
    layout_end();
}
