<?php
declare(strict_types=1);

// Hilfen für die öffentliche Seite

/** *kursiv*, **GROSS**, ==Akzent== → HTML (alles andere wird maskiert). */
function mk(string $s): string
{
    $s = e($s);
    $s = preg_replace('~==(.+?)==~u', '<span class="mk-a">$1</span>', $s);
    $s = preg_replace('~\*\*(.+?)\*\*~u', '<span class="mk-c">$1</span>', $s);
    $s = preg_replace('~\*(.+?)\*~u', '<span class="mk-i">$1</span>', $s);
    return $s;
}

function icon(string $kind, int $size = 20): string
{
    $paths = [
        'video' => '<rect x="3" y="6" width="13" height="12" rx="2"></rect><path d="M16 10l5-3v10l-5-3z"></path>',
        'text' => '<path d="M4 6h16M4 11h16M4 16h10"></path>',
        'radio' => '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path>',
        'podcast' => '<path d="M4 15v-3a8 8 0 0 1 16 0v3"></path><rect x="3" y="14" width="4" height="6" rx="1"></rect><rect x="17" y="14" width="4" height="6" rx="1"></rect>',
        'social' => '<path d="M4 5h16v11H9l-5 4z"></path>',
    ];
    $p = $paths[$kind] ?? $paths['text'];
    return '<svg aria-hidden="true" width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' . $p . '</svg>';
}

function rec_dot(int $px = 10): string
{
    return '<span class="ar-rec" style="width:' . $px . 'px;height:' . $px . 'px"></span>';
}

function sec_head(string $no, string $label, string $right, string $mb = '40px'): string
{
    return '<div class="sec-head" style="margin-bottom:' . $mb . '"><span class="sec-l">' . rec_dot() . '<span class="rec-t">REC</span><span>' . e($no) . ' — ' . e($label) . '</span></span>'
        . ($right !== '' ? '<span class="muted">' . e($right) . '</span>' : '') . '</div>';
}

function fmt_month(string $date): string
{
    return preg_match('~^(\d{4})-(\d{2})~', $date, $m) ? $m[2] . '/' . $m[1] : '';
}

function clip_date_label(array $c): string
{
    if (trim($c['date_label']) !== '') {
        return $c['date_label'];
    }
    if ($c['date'] === '') {
        return '';
    }
    if ($c['tl_end'] !== '' && substr($c['tl_end'], 0, 4) !== substr($c['date'], 0, 4)) {
        return substr($c['date'], 0, 4) . '–' . substr($c['tl_end'], 0, 4);
    }
    return fmt_month($c['date']);
}

function auto_tc(int $i): string
{
    $sec = ($i + 1) * 33 - 21;
    return sprintf('00:%02d:%02d:%02d', intdiv($sec, 60), $sec % 60, ($i * 7) % 25);
}

/**
 * Zeitleiste berechnen: Spalten (Quartale), Spuren mit Balken, Position des Abspielkopfs je Clip.
 * @param array $clips veröffentlichte Referenzen in Listenreihenfolge
 */
function build_timeline(array $clips, array $tracks, array $tl): array
{
    $t0 = strtotime($tl['start'] ?: '2024-01-01');
    $t1 = strtotime($tl['end'] ?: '2026-12-31');
    if ($t1 <= $t0) {
        $t1 = $t0 + 86400 * 365;
    }
    $span = $t1 - $t0;

    // Quartalsspalten
    $cols = [];
    $y = (int)date('Y', $t0);
    $qn = intdiv((int)date('n', $t0) - 1, 3);
    $guard = 0;
    while (strtotime(sprintf('%04d-%02d-01', $y, $qn * 3 + 1)) <= $t1 && $guard++ < 80) {
        $qs = strtotime(sprintf('%04d-%02d-01', $y, $qn * 3 + 1));
        $qe = strtotime(sprintf('%04d-%02d-01', $qn === 3 ? $y + 1 : $y, $qn === 3 ? 1 : $qn * 3 + 4));
        $cols[] = ['label' => $qn === 0 ? (string)$y : 'Q' . ($qn + 1), 'year' => $qn === 0, 'w' => (max($t0, min($t1, $qe)) - max($t0, min($t1, $qs))) / $span * 100];
        $qn++;
        if ($qn > 3) {
            $qn = 0;
            $y++;
        }
    }
    $minW = (float)($tl['min_w'] !== '' ? $tl['min_w'] : 2.8);
    $byTrack = [];
    $pos = [];
    foreach ($clips as $i => $c) {
        $p = null;
        $w = null;
        if ($c['tl_pos'] !== '') {
            $p = (float)$c['tl_pos'];
            $w = $c['tl_w'] !== '' ? (float)$c['tl_w'] : $minW;
        } elseif ($c['date'] !== '' && $c['tl_track'] !== '') {
            $s = strtotime($c['date']);
            $p = ($s - $t0) / $span * 100;
            $en = $c['tl_end'] !== '' ? strtotime($c['tl_end']) : $s;
            $w = max($minW, ($en - $s) / $span * 100);
            if ($c['tl_w'] !== '') {
                $w = (float)$c['tl_w'];
            }
        }
        if ($p === null || $c['tl_track'] === '') {
            continue;
        }
        $p = max(0, min(100 - 0.5, $p));
        $w = max(0.5, min(100 - $p, $w));
        $pos[$c['_id']] = $p;
        $byTrack[$c['tl_track']][] = ['id' => $c['_id'], 'left' => round($p, 2), 'w' => round($w, 2)];
    }
    return ['cols' => $cols, 'byTrack' => $byTrack, 'pos' => $pos, 'start' => $t0, 'end' => $t1];
}

/** Lebenslauf nach Beginn-Jahr gruppieren. */
function cv_groups(array $rows): array
{
    $g = [];
    foreach ($rows as $r) {
        $y = substr((string)$r['from'], 0, 4) ?: '—';
        $g[$y][] = $r;
    }
    krsort($g);
    return $g;
}

function cv_when(array $r): string
{
    if (trim($r['when_label']) !== '') {
        return $r['when_label'];
    }
    $a = fmt_month((string)$r['from']);
    $b = fmt_month((string)$r['to']);
    if ($r['ongoing']) {
        return 'seit ' . $a;
    }
    return $b !== '' ? $a . ' — ' . $b : $a;
}

function legal_html(string $text): string
{
    $out = '';
    foreach (preg_split('~\n\s*\n~', trim($text)) as $block) {
        $block = trim($block);
        if ($block === '') {
            continue;
        }
        if (str_starts_with($block, '## ')) {
            $out .= '<h2>' . e(trim(substr($block, 3))) . '</h2>';
        } else {
            $out .= '<p>' . nl2br(e($block)) . '</p>';
        }
    }
    return $out;
}

/** Schwärzungs-Zufallshöhen der Podcast-Wellenform (stabil pro Folge). */
function wave_bars(int $seed): array
{
    mt_srand($seed * 7919 + 13);
    $bars = [];
    for ($i = 0; $i < 48; $i++) {
        $bars[] = mt_rand(30, 92);
    }
    mt_srand();
    return $bars;
}
