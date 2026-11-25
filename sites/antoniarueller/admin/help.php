<?php
declare(strict_types=1);

/**
 * Hilfe: ausführliche Anleitungen in Kapiteln (Akkordeon, immer nur ein Kapitel offen) mit Screenshots.
 * Inhalte: admin/hilfe/*.php · Bilder: admin/hilfe-bilder/*.webp (eigener Ordner, getrennt von der Mediathek;
 * erzeugt mit tools/hilfe-bilder.js aus Beispieldaten).
 *
 * Kapitel: ['id', 'title', 'icon', 'intro', 'articles' => [Artikel]]
 * Artikel: ['id', 'title', 'lead', 'steps' => [..], 'shot' => 'dateiname', 'alt', 'legend' => ['1 = …'], 'after', 'tips' => [..], 'warn' => [..], 'open' => ['Knopftext', 'p=list&c=clips']]
 * Formatierung in Texten: **fett**, [[Taste]]
 */

const HELP_IMG_DIR = __DIR__ . '/hilfe-bilder';

function help_chapters(): array
{
    static $c = null;
    if ($c === null) {
        $c = array_merge(
            require __DIR__ . '/hilfe/start.php',
            require __DIR__ . '/hilfe/inhalte.php',
            require __DIR__ . '/hilfe/system.php'
        );
    }
    return $c;
}

/** **fett** und [[Taste]] in Hilfetexten. */
function help_fmt(string $s): string
{
    $s = e($s);
    $s = preg_replace('~\*\*(.+?)\*\*~u', '<strong>$1</strong>', $s);
    return (string)preg_replace('~\[\[(.+?)\]\]~u', '<kbd>$1</kbd>', $s);
}

/** Welcher Hilfeartikel gehört zur aktuellen Seite der Verwaltung? [Kapitel, Artikel] */
function help_context(string $active): array
{
    static $map = [
        'c:clips' => ['arbeiten', 'referenz-anlegen'], 'c:tracks' => ['arbeiten', 'kategorien'], 'c:episodes' => ['mehr', 'podcast'],
        'c:cv' => ['mehr', 'lebenslauf'], 'c:before' => ['mehr', 'lebenslauf'],
        'c:crossmedia' => ['mehr', 'ueber-mich'], 'c:languages' => ['mehr', 'ueber-mich'], 'g:about' => ['mehr', 'ueber-mich'],
        'c:offrecord' => ['mehr', 'off-the-record'], 'g:contact' => ['mehr', 'kontakt'], 'c:social' => ['mehr', 'kontakt'],
        'g:hero' => ['hero', 'hero-bereich'], 'c:questions' => ['hero', 'leitfragen'], 'g:typo' => ['hero', 'schrift'], 'g:texts_start' => ['hero', 'abschnitte'], 'g:texts_arbeiten' => ['hero', 'abschnitte'], 'g:texts_ueber' => ['hero', 'abschnitte'], 'g:texts_kontakt' => ['hero', 'abschnitte'],
        'c:nav' => ['hero', 'menue'], 'g:site' => ['hero', 'farben'], 'translate' => ['englisch', 'uebersetzungstabelle'],
        'media' => ['mediathek', 'mediathek-ueberblick'], 'g:seo' => ['recht', 'seo'], 'g:legal' => ['recht', 'impressum'],
        'stats' => ['auswertung', 'statistik'], 'trash' => ['grundlagen', 'papierkorb'], 'users' => ['system', 'zugaenge'],
        'backup' => ['system', 'sicherung'], 'account' => ['system', 'konto'], 'sessions' => ['system', 'geraete'],
        'log' => ['system', 'protokoll'], 'check' => ['system', 'systemcheck'],
    ];
    return $map[$active] ?? [];
}

function help_url(array $ctx = []): string
{
    return a('p=help' . ($ctx ? '&k=' . rawurlencode($ctx[0]) . '&a=' . rawurlencode($ctx[1]) : ''));
}

/** Hilfeartikel für die Suche (Strg+K). */
function help_search_entries(): array
{
    $out = [];
    foreach (help_chapters() as $ch) {
        foreach ($ch['articles'] as $ar) {
            $out[] = ['t' => $ar['title'], 's' => 'Hilfe · ' . $ch['title'], 'u' => help_url([$ch['id'], $ar['id']]), 'k' => 'Hilfe'];
        }
    }
    return $out;
}

function help_plain(array $ar): string
{
    $parts = [$ar['title'], $ar['lead'] ?? '', implode(' ', $ar['steps'] ?? []), implode(' ', $ar['tips'] ?? []), implode(' ', $ar['warn'] ?? []), $ar['after'] ?? '', implode(' ', $ar['legend'] ?? [])];
    foreach ($ar['terms'] ?? [] as $t => $d) {
        $parts[] = $t . ' ' . $d;
    }
    return mb_strtolower((string)preg_replace('~(\*\*|\[\[|\]\])~', '', implode(' ', $parts)));
}

function view_help(array $user): void
{
    layout_start($user, 'Hilfe', 'help', true);
    $chapters = help_chapters();
    $openId = (string)($_GET['k'] ?? '');
    $focus = (string)($_GET['a'] ?? '');
    if (!in_array($openId, array_column($chapters, 'id'), true)) {
        $openId = $chapters[0]['id'];
    }
    $total = array_sum(array_map(fn($c) => count($c['articles']), $chapters));
    echo '<p class="lead">Alles, was die Verwaltung kann – Schritt für Schritt und mit Bildern erklärt. Öffne ein Kapitel, um die Anleitungen zu lesen (es ist immer nur ein Kapitel offen). Mit der Suche findest du schnell die passende Stelle; <kbd>Strg</kbd> + <kbd>K</kbd> sucht auch hier.</p>';
    echo '<div class="hbar"><input type="search" id="hq" placeholder="In der Hilfe suchen …" aria-label="In der Hilfe suchen"><span class="hstate" id="hstate" role="status" aria-live="polite">' . count($chapters) . ' Kapitel · ' . $total . ' Anleitungen</span><button type="button" class="btn small ghost" id="hprint">' . aicon('doc', 15) . ' Alles drucken</button></div>';
    echo '<div class="hacc" id="hacc" data-focus="' . e($focus) . '">';
    foreach ($chapters as $n => $ch) {
        $isOpen = $ch['id'] === $openId;
        echo '<details class="hchap" id="k-' . e($ch['id']) . '" name="hilfe"' . ($isOpen ? ' open' : '') . '><summary><span class="hnum">' . sprintf('%02d', $n + 1) . '</span><span class="hic">' . aicon($ch['icon'], 20) . '</span><span class="htt"><strong>' . e($ch['title']) . '</strong><small>' . e($ch['intro']) . '</small></span><span class="hcnt">' . count($ch['articles']) . '</span></summary><div class="hbody">';
        if (count($ch['articles']) > 1) {
            echo '<nav class="hchips" aria-label="Anleitungen in diesem Kapitel">';
            foreach ($ch['articles'] as $ar) {
                echo '<a href="#a-' . e($ar['id']) . '" data-a="' . e($ar['id']) . '">' . e($ar['title']) . '</a>';
            }
            echo '</nav>';
        }
        foreach ($ch['articles'] as $ar) {
            help_article($ar);
        }
        echo '</div></details>';
    }
    echo '</div><p class="empty" id="hnone" hidden>Dazu habe ich nichts gefunden. Versuche ein anderes Wort, zum Beispiel „Bild“, „Entwurf“ oder „Englisch“.</p>';
    layout_end();
}

function help_article(array $ar): void
{
    echo '<article class="harticle" id="a-' . e($ar['id']) . '" data-t="' . e(help_plain($ar)) . '"><h3>' . e($ar['title']) . '</h3>';
    if (!empty($ar['lead'])) {
        echo '<p class="hlead">' . help_fmt($ar['lead']) . '</p>';
    }
    if (!empty($ar['shot']) && is_file(HELP_IMG_DIR . '/' . $ar['shot'] . '.webp')) {
        $sz = @getimagesize(HELP_IMG_DIR . '/' . $ar['shot'] . '.webp');
        echo '<figure class="hshot"><img src="' . e(AR_BASE . '/admin/hilfe-bilder/' . $ar['shot'] . '.webp') . '" alt="' . e($ar['alt'] ?? $ar['title']) . '" loading="lazy" decoding="async"' . ($sz ? ' width="' . $sz[0] . '" height="' . $sz[1] . '"' : '') . '>';
        if (!empty($ar['legend'])) {
            echo '<figcaption><ol class="hlegend">';
            foreach ($ar['legend'] as $i => $l) {
                echo '<li value="' . ($i + 1) . '"><span class="hbadge" aria-hidden="true">' . ($i + 1) . '</span>' . help_fmt($l) . '</li>';
            }
            echo '</ol></figcaption>';
        }
        echo '</figure>';
    } elseif (!empty($ar['legend'])) {
        echo '<ol class="hlegend plain">';
        foreach ($ar['legend'] as $i => $l) {
            echo '<li value="' . ($i + 1) . '"><span class="hbadge" aria-hidden="true">' . ($i + 1) . '</span>' . help_fmt($l) . '</li>';
        }
        echo '</ol>';
    }
    if (!empty($ar['steps'])) {
        echo '<ol class="hsteps">';
        foreach ($ar['steps'] as $s) {
            echo '<li>' . help_fmt($s) . '</li>';
        }
        echo '</ol>';
    }
    if (!empty($ar['terms'])) {
        echo '<dl class="hterms">';
        foreach ($ar['terms'] as $t => $d) {
            echo '<div><dt>' . e((string)$t) . '</dt><dd>' . help_fmt($d) . '</dd></div>';
        }
        echo '</dl>';
    }
    if (!empty($ar['after'])) {
        echo '<p class="hafter"><strong>Auf der Seite:</strong> ' . help_fmt($ar['after']) . '</p>';
    }
    foreach ($ar['tips'] ?? [] as $t) {
        echo '<p class="htip"><strong>Tipp</strong> ' . help_fmt($t) . '</p>';
    }
    foreach ($ar['warn'] ?? [] as $t) {
        echo '<p class="hwarn"><strong>Achtung</strong> ' . help_fmt($t) . '</p>';
    }
    if (!empty($ar['open'])) {
        echo '<p class="hopen"><a class="btn small ghost" href="' . e(a($ar['open'][1])) . '">' . e($ar['open'][0]) . ' ' . aicon('external', 13) . '</a></p>';
    }
    echo '</article>';
}
