<?php
declare(strict_types=1);

/** Übersetzungstabelle: alle übersetzbaren Texte, Deutsch links, Englisch rechts. */
function view_translate(array $user): void
{
    layout_start($user, 'Übersetzungstabelle', 'translate', true);
    $rows = translation_rows();
    $total = count($rows);
    $open = count(array_filter($rows, fn($r) => trim($r['en']) === ''));
    $stale = count(array_filter($rows, fn($r) => !empty($r['stale'])));
    $fSel = (string)($_GET['f'] ?? '');
    $pct = $total ? (int)round(($total - $open) / $total * 100) : 100;
    $areaSel = (string)($_GET['a'] ?? '');
    $startChip = $areaSel !== '' ? 'all' : ($fSel === 'stale' && $stale ? 'stale' : ($open ? 'open' : ($stale ? 'stale' : 'all')));

    $areas = [];
    foreach ($rows as $r) {
        $areas[$r['area_key']]['label'] = $r['area'];
        $areas[$r['area_key']]['rows'][] = $r;
    }
    if (!isset($areas[$areaSel])) {
        $areaSel = '';
    }

    echo '<p class="lead">Links der deutsche Text, rechts die englische Fassung. Änderungen werden beim Verlassen des Feldes gespeichert und sind sofort auf der <a href="' . AR_BASE . '/en/" target="_blank" rel="noopener">englischen Seite</a> sichtbar. Leere Felder zeigen dort den deutschen Text. Hervorhebungen (==, **, *) wie im Deutschen übernehmen.</p>';
    echo '<div class="card wide trprog"><strong>' . $pct . ' % übersetzt</strong> <span class="hint">' . ($total - $open) . ' von ' . $total . ' Texten' . ($stale ? ' · ' . $stale . ' veraltet' : '') . '</span><div class="meter"><span style="width:' . $pct . '%"></span></div></div>';

    $chip = fn(string $k, string $label, int $cnt) => '<button type="button" class="chip' . ($startChip === $k ? ' on' : '') . '" data-f="' . $k . '">' . $label . ' <span>' . $cnt . '</span></button>';
    echo '<div class="trbar" id="trbar"><div class="chips" role="group" aria-label="Anzeigen">' . $chip('open', 'Noch offen', $open) . $chip('stale', 'Veraltet', $stale) . $chip('all', 'Alle', $total) . '</div>';
    echo '<select id="trarea" aria-label="Bereich"><option value="">Alle Bereiche</option>';
    foreach ($areas as $k => $a) {
        echo '<option value="' . e($k) . '"' . ($k === $areaSel ? ' selected' : '') . '>' . e($a['label']) . '</option>';
    }
    echo '</select><input type="search" id="trq" placeholder="Suchen …" aria-label="Texte durchsuchen"><span class="trstate" id="trstate" role="status" aria-live="polite"></span></div>';

    if (!$rows) {
        echo '<p class="empty">Es gibt noch keine übersetzbaren Texte.</p>';
        layout_end();
        return;
    }

    echo '<form method="post" action="' . a() . '" id="trform" data-csrf="' . e($user['csrf']) . '" data-url="' . e(a()) . '">' . csrf_field($user) . '<input type="hidden" name="action" value="translate_save">';
    foreach ($areas as $k => $a) {
        $ao = count(array_filter($a['rows'], fn($r) => trim($r['en']) === ''));
        echo '<section class="trarea" data-area="' . e($k) . '"><h2 class="fs">' . e($a['label']) . ' <span class="cnt">' . ($ao ? $ao . ' offen' : 'vollständig') . '</span></h2>';
        foreach ($a['rows'] as $r) {
            $isOpen = trim($r['en']) === '';
            $nl = max(2, min(12, (int)ceil(mb_strlen($r['de']) / 55) + substr_count($r['de'], "\n")));
            $id = 'tr_' . substr(md5($r['key']), 0, 10);
            $isStale = !empty($r['stale']);
            echo '<div class="trrow' . ($isOpen ? ' open' : '') . ($isStale ? ' stale' : '') . '" data-open="' . ($isOpen ? '1' : '0') . '" data-stale="' . ($isStale ? '1' : '0') . '" data-area="' . e($k) . '">';
            echo '<div class="tr-de"><span class="tr-l">' . e($r['label']) . ($r['item'] !== '' ? ' · <a href="' . e($r['link']) . '">' . e($r['item']) . '</a>' : ' · <a href="' . e($r['link']) . '">öffnen</a>') . '</span><div class="tr-t" id="' . $id . '_de">' . e($r['de']) . '</div></div>';
            echo '<div class="tr-en">' . ($isStale ? '<p class="tr-stale">Der deutsche Text wurde seit der Übersetzung geändert. Bitte die englische Fassung prüfen und anpassen oder bestätigen. <button type="button" class="link tr-ok">Englisch ist aktuell</button></p>' : '') . '<label class="sr" for="' . $id . '">' . e($r['label']) . ' (English)</label><textarea id="' . $id . '" name="t[' . e($r['key']) . ']" rows="' . $nl . '" maxlength="' . (int)$r['max'] . '" data-orig="' . e($r['en']) . '" placeholder="Englische Übersetzung …"' . ($r['multi'] ? '' : ' data-single="1"') . (!empty($r['rich']) ? ' data-rich="1"' : '') . '>' . e($r['en']) . '</textarea>';
            echo '<div class="tr-f"><button type="button" class="link tr-copy" data-from="' . $id . '_de">Deutsch übernehmen</button><span class="tr-s" aria-live="polite"></span></div></div></div>';
        }
        echo '</section>';
    }
    echo '<div class="actions trsave"><button class="btn">' . aicon('check', 16) . ' Alle Änderungen speichern</button><a class="btn ghost" href="' . AR_BASE . '/admin/vorschau.php?lang=en" target="_blank" rel="noopener">Englische Vorschau ' . aicon('external', 14) . '</a></div></form>';
    layout_end();
}
