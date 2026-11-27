<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/translate_io.php';

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

    echo '<p><a class="btn small ghost" href="' . a('p=translate_io') . '">' . aicon('globe', 16) . ' Export &amp; Import (KI-Übersetzung)</a></p>';
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

/** Export und Import der Übersetzungen: Tabelle für eine KI herunterladen, Antwort mit Vorschau wieder einlesen. */
function view_translate_io(array $user, ?string $raw = null, bool $overwrite = false): void
{
    layout_start($user, 'Übersetzungen exportieren und importieren', 'translate', true);
    $rows = translation_rows();
    $open = count(array_filter($rows, fn($r) => trim((string)$r['en']) === ''));
    $stale = count(array_filter($rows, fn($r) => !empty($r['stale'])));
    echo '<p class="lead">Texte als Tabelle herunterladen, von einer KI ins Englische übersetzen lassen und die Antwort hier wieder einlesen. Vor dem Speichern siehst du jede Änderung in einer Vorschau. <a href="' . e(a('p=translate')) . '">Zurück zur Übersetzungstabelle</a></p>';

    if ($raw !== null) {
        [$entries, $err] = tio_parse($raw);
        echo '<section class="card wide"><h2>Vorschau des Imports</h2>';
        if ($err !== '') {
            echo '<div class="flash warn" role="alert">' . e($err) . '</div></section>';
        } else {
            $plan = tio_plan($entries, $overwrite);
            $cnt = ['ok' => 0, 'warn' => 0, 'skip' => 0];
            foreach ($plan as $l) {
                $cnt[$l['status']]++;
            }
            $take = $cnt['ok'] + $cnt['warn'];
            echo '<p><strong>' . $take . ' von ' . count($plan) . ' Texten werden übernommen</strong>' . ($cnt['warn'] ? ' (' . $cnt['warn'] . ' mit Hinweis)' : '') . ($cnt['skip'] ? ', ' . $cnt['skip'] . ' nicht.' : '.') . '</p>';
            if ($take > 0) {
                echo '<form method="post" action="' . e(a()) . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="translate_import_apply"><input type="hidden" name="overwrite" value="' . ($overwrite ? '1' : '') . '"><textarea name="payload" hidden>' . e($raw) . '</textarea><button class="btn">' . aicon('check', 16) . ' ' . $take . ' Übersetzungen speichern</button></form> <a class="btn ghost" href="' . e(a('p=translate_io')) . '">Abbrechen</a>';
            } else {
                echo '<p class="hint">Es gibt nichts zu übernehmen. <a href="' . e(a('p=translate_io')) . '">Zurück</a></p>';
            }
            echo '<div class="tbl-scroll"><table class="mini tio"><thead><tr><th>Status</th><th>Text</th><th>Deutsch</th><th>Bisher (Englisch)</th><th>Neu (Englisch)</th></tr></thead><tbody>';
            usort($plan, fn($x, $y) => ['warn' => 0, 'skip' => 1, 'ok' => 2][$x['status']] <=> ['warn' => 0, 'skip' => 1, 'ok' => 2][$y['status']]);
            foreach ($plan as $l) {
                $badge = ['ok' => '<span class="badge ok">wird gespeichert</span>', 'warn' => '<span class="badge warn">prüfen</span>', 'skip' => '<span class="badge">nicht übernommen</span>'][$l['status']];
                echo '<tr><td>' . $badge . ($l['msg'] !== '' ? '<br><small>' . e($l['msg']) . '</small>' : '') . '</td><td><small>' . e($l['label']) . '</small></td><td>' . nl2br(e(mb_strimwidth($l['de'], 0, 300, '…'))) . '</td><td>' . nl2br(e(mb_strimwidth($l['old'], 0, 300, '…'))) . '</td><td>' . nl2br(e(mb_strimwidth($l['new'], 0, 300, '…'))) . '</td></tr>';
            }
            echo '</tbody></table></div></section>';
        }
    }

    $areas = [];
    foreach ($rows as $r) {
        $areas[$r['area_key']] = $r['area'];
    }
    echo '<section class="card wide"><h2>1 · Exportieren</h2><p class="hint">' . count($rows) . ' Texte insgesamt, davon ' . $open . ' ohne englische Fassung und ' . $stale . ' veraltet. JSON eignet sich am besten für eine KI, CSV zum Öffnen in Excel.</p>';
    echo '<form method="post" action="' . e(a()) . '" class="tio-form">' . csrf_field($user) . '<input type="hidden" name="action" value="translate_export">';
    echo '<label>Welche Texte? <select name="scope"><option value="open">Nur offene und veraltete (' . ($open + $stale > 0 ? $open + $stale : 0) . ')</option><option value="all">Alle Texte (' . count($rows) . ')</option></select></label> ';
    echo '<label>Bereich <select name="area"><option value="">Alle Bereiche</option>';
    foreach ($areas as $k => $l) {
        echo '<option value="' . e($k) . '">' . e($l) . '</option>';
    }
    echo '</select></label> <label>Format <select name="fmt"><option value="json">JSON (für die KI)</option><option value="csv">CSV (Excel)</option></select></label> <button class="btn">' . aicon('check', 16) . ' Herunterladen</button></form></section>';

    $prompt = tio_prompt();
    echo '<section class="card wide"><h2>2 · Prompt für die KI</h2><p class="hint">Diesen Text zusammen mit der heruntergeladenen JSON-Datei an eine KI geben (Datei anhängen oder den Inhalt einfügen). Die KI stellt bei Unsicherheit zuerst Rückfragen. Danach gibt sie die vollständige Liste als JSON zurück.</p>';
    echo '<textarea id="tioPrompt" class="tio-prompt" rows="16" readonly>' . e($prompt) . '</textarea><p><button type="button" class="btn small" data-copy="tioPrompt">Prompt kopieren</button> <span class="hint" id="tioCopied" role="status"></span></p></section>';

    echo '<section class="card wide"><h2>3 · Importieren</h2><p class="hint">Antwort der KI (JSON) einfügen oder die Datei wählen, auch eine bearbeitete CSV ist möglich. Es wird nichts gespeichert, bevor du die Vorschau bestätigst. Geprüft werden unter anderem Schlüssel, Länge, Markierungen, HTML sowie Zahlen und Links.</p>';
    echo '<form method="post" action="' . e(a()) . '" enctype="multipart/form-data">' . csrf_field($user) . '<input type="hidden" name="action" value="translate_import_preview">';
    echo '<label for="tioRaw">Antwort der KI einfügen</label><textarea id="tioRaw" name="payload" rows="8" placeholder="{ &quot;texts&quot;: [ … ] }"></textarea>';
    echo '<label for="tioFile">oder Datei wählen (.json, .csv)</label><input type="file" id="tioFile" name="file" accept=".json,.csv,.txt">';
    echo '<label class="check"><input type="checkbox" name="overwrite" value="1"> Auch bereits vorhandene, aktuelle englische Texte überschreiben</label>';
    echo '<p><button class="btn">Vorschau anzeigen</button></p></form></section>';
    layout_end();
}
