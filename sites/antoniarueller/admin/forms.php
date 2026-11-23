<?php
declare(strict_types=1);

// Formulare, Listen und Bearbeitung (Entwürfe, Englisch, Versionen)

function who_name(string $email): string
{
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (q('SELECT email, name FROM ar_users')->fetchAll() as $u) {
            $map[$u['email']] = $u['name'] ?: $u['email'];
        }
    }
    if ($email === '') {
        return '';
    }
    return $map[$email] ?? (in_array($email, ['seed', 'migration', 'system'], true) ? 'System' : $email);
}

function when_fmt(int $t): string
{
    return date('d.m.Y H:i', $t) . ' Uhr';
}

function preview_url(string $anchor = ''): string
{
    return AR_BASE . '/admin/vorschau.php' . ($anchor !== '' ? '#' . $anchor : '');
}

function preview_anchor(string $key): string
{
    return [
        'clips' => 'arbeiten', 'tracks' => 'arbeiten', 'timeline' => 'arbeiten', 'episodes' => 'podcast', 'stations' => 'lebenslauf', 'cv' => 'lebenslauf', 'before' => 'lebenslauf',
        'about' => 'ueber', 'crossmedia' => 'ueber', 'languages' => 'ueber', 'offrecord' => 'offtherecord', 'contact' => 'kontakt', 'social' => 'kontakt', 'hero' => 'inhalt',
        'questions' => 'inhalt', 'marquee' => 'inhalt',
    ][$key] ?? '';
}

function render_text_control(array $f, string $name, string $id, mixed $val, string $desc = '', bool $required = false): void
{
    $t = $f['type'];
    $max = !empty($f['max']) ? (int)$f['max'] : 0;
    if ($t === 'markup') {
        echo '<div class="mktool" data-for="' . e($id) . '" role="group" aria-label="Hervorheben"><button type="button" data-mk="*"><i>Kursiv</i></button><button type="button" data-mk="**"><b>GROSS</b></button><button type="button" data-mk="==">Akzent</button></div>';
    }
    if ($t === 'textarea') {
        echo '<textarea id="' . e($id) . '" name="' . e($name) . '" rows="' . (int)($f['rows'] ?? 4) . '"' . ($max ? ' maxlength="' . $max . '"' : '') . $desc . '>' . e($val) . '</textarea>';
    } else {
        echo '<input type="text" id="' . e($id) . '" name="' . e($name) . '" value="' . e($val) . '"' . ($max ? ' maxlength="' . $max . '"' : '') . ($required ? ' required' : '') . $desc . '>';
    }
    if ($t === 'markup') {
        echo '<div class="mkprev" data-for="' . e($id) . '" aria-hidden="true"></div>';
    }
    if ($max) {
        echo '<span class="counter" data-for="' . e($id) . '" data-max="' . $max . '"' . (isset($f['ideal']) ? ' data-ideal="' . (int)$f['ideal'][0] . '-' . (int)$f['ideal'][1] . '"' : '') . '></span>';
    }
}

function render_field(array $f, mixed $val, array $vals = []): void
{
    $t = $f['type'];
    $k = $f['key'];
    $id = 'f_' . $k;
    if ($t === 'section') {
        echo '<h2 class="fs">' . e($f['label']) . '</h2>';
        return;
    }
    $req = !empty($f['required']);
    $hint = !empty($f['hint']) ? '<small class="hint" id="h_' . e($k) . '">' . e($f['hint']) . '</small>' : '';
    $desc = $hint ? ' aria-describedby="h_' . e($k) . '"' : '';
    if ($t === 'bool') {
        echo '<div class="field check"><label><input type="checkbox" name="' . e($k) . '" value="1"' . ($val ? ' checked' : '') . $desc . '> ' . e($f['label']) . '</label>' . $hint . '</div>';
        return;
    }
    $tr = field_translatable($f);
    echo '<div class="field' . ($tr ? ' tr-de' : '') . '"><label for="' . $id . '">' . e($f['label']) . ($req ? ' <span class="req">*</span>' : '') . '</label>';
    switch ($t) {
        case 'text':
        case 'markup':
        case 'textarea':
            render_text_control($f, $k, $id, $val, $desc, $req);
            break;
        case 'url':
            echo '<input type="text" inputmode="url" id="' . $id . '" name="' . e($k) . '" value="' . e($val) . '" placeholder="https://…"' . $desc . '>';
            break;
        case 'date':
            echo '<input type="date" id="' . $id . '" name="' . e($k) . '" value="' . e($val) . '"' . ($req ? ' required' : '') . $desc . '>';
            break;
        case 'month':
            echo '<input type="month" id="' . $id . '" name="' . e($k) . '" value="' . e($val) . '"' . ($req ? ' required' : '') . $desc . '>';
            break;
        case 'number':
            echo '<input type="number" id="' . $id . '" name="' . e($k) . '" value="' . e($val) . '" min="' . e($f['min'] ?? '') . '" max="' . e($f['max'] ?? '') . '" step="' . e($f['step'] ?? 'any') . '"' . $desc . '>';
            break;
        case 'color':
            echo '<input type="color" id="' . $id . '" name="' . e($k) . '" value="' . e($val ?: ($f['default'] ?? '#000000')) . '"' . $desc . '>';
            break;
        case 'select':
            $opts = select_options($f);
            echo '<select id="' . $id . '" name="' . e($k) . '"' . $desc . '>';
            if (isset($f['empty'])) {
                echo '<option value="">' . e($f['empty']) . '</option>';
            }
            foreach ($opts as $ov => $ol) {
                echo '<option value="' . e($ov) . '"' . ((string)$val === (string)$ov ? ' selected' : '') . '>' . e($ol) . '</option>';
            }
            echo '</select>';
            break;
        case 'image':
            $has = $val !== '' && upload_url((string)$val) !== '';
            $fo = (string)($vals[$k . '_focus'] ?? '');
            echo '<div class="imgbox"><div class="focusbox" data-key="' . e($k) . '"' . ($has ? '' : ' hidden') . '><img src="' . ($has ? e(upload_url((string)$val)) : '') . '" alt="Aktuelles Bild"><span class="fdot"></span></div>';
            echo '<small class="hint focushint"' . ($has ? '' : ' hidden') . '>Klicke ins Bild, um den wichtigen Ausschnitt (z. B. das Gesicht) festzulegen. Er bleibt sichtbar, wenn das Bild zugeschnitten wird.</small>';
            echo '<input type="hidden" name="' . e($k) . '_focus" value="' . e($fo) . '"><input type="hidden" name="' . e($k) . '_pick" id="f_' . e($k) . '_pick" value="">';
            if ($has) {
                echo '<label class="check"><input type="checkbox" name="_remove_' . e($k) . '" value="1"> Bild entfernen</label>';
            }
            echo '</div><input type="file" id="' . $id . '" name="' . e($k) . '" accept="image/jpeg,image/png,image/webp"' . $desc . '> <button type="button" class="btn small ghost" data-media-pick="' . e($k) . '">Aus Mediathek wählen</button>';
            echo '<small class="hint">JPG, PNG oder WebP, höchstens ' . (int)cfg('max_upload_mb', 8) . ' MB. Wird automatisch verkleinert und optimiert.</small>';
            break;
        case 'pdf':
            if ($val !== '' && upload_url((string)$val) !== '') {
                echo '<div class="imgprev"><a href="' . e(upload_url((string)$val)) . '" target="_blank" rel="noopener">Aktuelle PDF öffnen</a><label class="check"><input type="checkbox" name="_remove_' . e($k) . '" value="1"> PDF entfernen</label></div>';
            }
            echo '<input type="file" id="' . $id . '" name="' . e($k) . '" accept="application/pdf"' . $desc . '>';
            break;
    }
    echo $hint . '</div>';
    if ($tr) {
        echo '<div class="field tr-en"><label for="' . $id . '_en">' . e($f['label']) . ' <span class="enmark">English</span></label><div class="de-ref" data-ref="' . $id . '"></div>';
        render_text_control($f, $k . '_en', $id . '_en', (string)($vals[$k . '_en'] ?? ''));
        echo '<small class="hint">Leer lassen = die deutsche Fassung wird angezeigt.</small></div>';
    }
}

function form_errors(array $errors): void
{
    if ($errors) {
        echo '<div class="flash err" role="alert"><strong>Bitte prüfen:</strong><ul>';
        foreach ($errors as $er) {
            echo '<li>' . e($er) . '</li>';
        }
        echo '</ul></div>';
    }
}

/** Reiter „Deutsch / English“ über dem Formular. */
function lang_bar(array $fields, array $vals): void
{
    $n = 0;
    $any = false;
    foreach ($fields as $f) {
        if ($f['type'] === 'section' || !field_translatable($f)) {
            continue;
        }
        $any = true;
        if (trim((string)($vals[$f['key']] ?? '')) !== '' && trim((string)($vals[$f['key'] . '_en'] ?? '')) === '') {
            $n++;
        }
    }
    if ($any) {
        echo '<div class="langbar" role="group" aria-label="Sprache bearbeiten"><button type="button" data-lang="de" class="on">Deutsch</button><button type="button" data-lang="en">English' . ($n ? ' <span class="badge" title="Noch nicht übersetzt">' . $n . '</span>' : '') . '</button></div>';
    }
}

function draft_banner(array $user, string $kind, string|int $ref, bool $isNew): void
{
    $key = $kind === 'item' ? 'id' : 'g';
    echo '<div class="flash warn" role="status"><strong>' . ($isNew ? 'Neu – noch nicht veröffentlicht.' : 'Entwurf – diese Änderungen sind noch nicht öffentlich.') . '</strong> Mit „Vorschau“ siehst du, wie die Seite damit aussieht.';
    echo ' <form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="publish_draft"><input type="hidden" name="kind" value="' . e($kind) . '"><input type="hidden" name="' . $key . '" value="' . e((string)$ref) . '"><button class="btn small">Jetzt veröffentlichen</button></form> ';
    echo '<form method="post" action="' . a() . '" class="inline" data-confirm="' . ($isNew ? 'Den neuen Entwurf verwerfen? Er wird gelöscht.' : 'Die Entwurfsänderungen verwerfen? Der veröffentlichte Stand bleibt.') . '">' . csrf_field($user) . '<input type="hidden" name="action" value="discard_draft"><input type="hidden" name="kind" value="' . e($kind) . '"><input type="hidden" name="' . $key . '" value="' . e((string)$ref) . '"><button class="btn small danger-o">Verwerfen</button></form></div>';
}

function history_box(array $user, string $kind, string $ref): void
{
    $vs = versions($kind, $ref);
    if (!$vs) {
        return;
    }
    echo '<details class="history"><summary>Frühere Fassungen (' . count($vs) . ')</summary><ul class="rows">';
    foreach ($vs as $i => $v) {
        echo '<li class="row"><span class="r-main"><strong>' . e(when_fmt((int)$v['saved_at'])) . ($i === 0 ? ' · aktuell veröffentlicht' : '') . '</strong><small>von ' . e(who_name((string)$v['saved_by'])) . '</small></span>';
        if ($i > 0) {
            echo '<span class="r-act"><form method="post" action="' . a() . '" class="inline" data-confirm="Diese Fassung als Entwurf laden? Der veröffentlichte Stand bleibt unverändert, bis du den Entwurf veröffentlichst.">' . csrf_field($user) . '<input type="hidden" name="action" value="restore_version"><input type="hidden" name="vid" value="' . (int)$v['id'] . '"><input type="hidden" name="kind" value="' . e($kind) . '"><input type="hidden" name="ref" value="' . e($ref) . '"><button class="btn small ghost">Als Entwurf laden</button></form></span>';
        }
        echo '</li>';
    }
    echo '</ul></details>';
}

// ---------- Listen ----------
function view_list(array $user, string $coll): void
{
    $def = schema()['collections'][$coll];
    $rows = items($coll, false, true);
    layout_start($user, $def['label'], 'c:' . $coll);
    if (!empty($def['help'])) {
        echo '<p class="lead">' . e($def['help']) . '</p>';
    }
    echo '<p class="toolbar"><a class="btn" href="' . a('p=edit&c=' . $coll) . '">+ ' . e($def['singular']) . ' hinzufügen</a>';
    if (count($rows) > 6) {
        echo '<input type="search" id="rowfilter" placeholder="Suchen …" aria-label="Liste durchsuchen">';
    }
    echo '<a class="btn ghost" href="' . e(preview_url(preview_anchor($coll))) . '" target="_blank" rel="noopener">Vorschau ↗</a></p>';
    if (!$rows) {
        echo '<p class="empty">Noch keine Einträge.</p>';
    }
    echo '<ol class="rows sortable" id="rows" data-coll="' . e($coll) . '" data-csrf="' . e($user['csrf']) . '" data-url="' . e(a()) . '">';
    foreach ($rows as $i => $r) {
        $title = trim((string)($r[$def['title']] ?? '')) ?: '(ohne Titel)';
        $sub = array_filter(array_map(fn($k) => (string)($r[$k] ?? ''), $def['sub']));
        $hidden = array_key_exists('published', $r) && !$r['published'];
        echo '<li id="i' . $r['_id'] . '" class="row' . ($hidden ? ' draft' : '') . '" data-id="' . $r['_id'] . '" draggable="true"><span class="grip" aria-hidden="true" title="Ziehen zum Sortieren">⠿</span><span class="no">' . sprintf('%02d', $i + 1) . '</span>';
        echo '<a class="r-main" href="' . a('p=edit&c=' . $coll . '&id=' . $r['_id']) . '"><strong>' . e(mb_strimwidth($title, 0, 90, '…')) . '</strong>';
        if ($sub) {
            echo '<small>' . e(implode(' · ', $sub)) . '</small>';
        }
        if ($r['_updated_by'] !== '' && $r['_updated_by'] !== 'seed') {
            echo '<small class="muted2">Zuletzt: ' . e(who_name($r['_updated_by'])) . ', ' . e(date('d.m.Y', $r['_updated'])) . '</small>';
        }
        if (!$r['_live']) {
            echo '<span class="pill warn">Neu · nicht veröffentlicht</span>';
        } elseif ($r['_draft']) {
            echo '<span class="pill warn">Entwurf mit Änderungen</span>';
        }
        if ($hidden) {
            echo '<span class="pill">Ausgeblendet</span>';
        }
        echo '</a><span class="r-act">';
        foreach (['up' => ['▲', 'nach oben'], 'down' => ['▼', 'nach unten']] as $dir => [$sym, $lab]) {
            echo '<form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="move"><input type="hidden" name="id" value="' . $r['_id'] . '"><input type="hidden" name="dir" value="' . $dir . '"><button class="icon" aria-label="' . e($title) . ' ' . $lab . ' verschieben"' . (($dir === 'up' && $i === 0) || ($dir === 'down' && $i === count($rows) - 1) ? ' disabled' : '') . '>' . $sym . '</button></form>';
        }
        echo '<a class="btn small ghost" href="' . a('p=edit&c=' . $coll . '&id=' . $r['_id']) . '">Bearbeiten</a>';
        echo '<form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="trash"><input type="hidden" name="id" value="' . $r['_id'] . '"><button class="btn small danger-o">In den Papierkorb</button></form>';
        echo '</span></li>';
    }
    echo '</ol>';
    layout_end();
}

function form_actions(string $cancelUrl, string $previewAnchor, bool $isDraft): void
{
    echo '<div class="actions"><button class="btn" name="mode" value="publish">Veröffentlichen</button><button class="btn ghost" name="mode" value="draft">Als Entwurf speichern</button><a class="btn ghost" href="' . e(preview_url($previewAnchor)) . '" target="_blank" rel="noopener">Vorschau ↗</a><a class="btn ghost" href="' . e(AR_BASE . '/admin/vorschau.php?lang=en' . ($previewAnchor !== '' ? '#' . $previewAnchor : '')) . '" target="_blank" rel="noopener">Vorschau English ↗</a><a class="btn ghost" href="' . e($cancelUrl) . '">Abbrechen</a></div>';
    echo '<p class="hint">„Veröffentlichen“ ist sofort für alle sichtbar. „Als Entwurf speichern“ bleibt nur für dich sichtbar – siehe „Vorschau“.' . ($isDraft ? ' Vorhandener Entwurf wird überschrieben.' : '') . '</p>';
}

function view_edit_item(array $user, string $coll, ?int $id, array $vals, array $errors): void
{
    $def = schema()['collections'][$coll];
    layout_start($user, ($id ? $def['singular'] . ' bearbeiten' : $def['singular'] . ' hinzufügen'), 'c:' . $coll);
    $isDraft = !empty($vals['_draft']);
    $isNew = $id && isset($vals['_live']) && (int)$vals['_live'] === 0;
    if ($id && ($isDraft || $isNew)) {
        draft_banner($user, 'item', $id, $isNew);
    }
    if ($id && !empty($vals['_updated_by']) && $vals['_updated_by'] !== 'seed') {
        echo '<p class="hint">Zuletzt geändert von ' . e(who_name((string)$vals['_updated_by'])) . ', ' . e(when_fmt((int)$vals['_updated'])) . '</p>';
    }
    form_errors($errors);
    ?>
<form method="post" action="<?= a() ?>" enctype="multipart/form-data" class="form" data-coll="<?= e($coll) ?>">
<?= csrf_field($user) ?><input type="hidden" name="action" value="save_item"><input type="hidden" name="coll" value="<?= e($coll) ?>"><input type="hidden" name="id" value="<?= (int)$id ?>">
<?php
    lang_bar($def['fields'], $vals);
    foreach ($def['fields'] as $f) {
        render_field($f, $vals[$f['key']] ?? '', $vals);
        if ($coll === 'clips' && $f['key'] === 'tc') {
            tl_preview();
        }
    }
    form_actions(a('p=list&c=' . $coll), preview_anchor($coll), $isDraft);
    echo '</form>';
    if ($id) {
        history_box($user, 'item', (string)$id);
    }
    layout_end();
}

/** Vorschau-Streifen der Zeitleiste (wird von admin.js befüllt). */
function tl_preview(): void
{
    $tl = setting('timeline');
    echo '<div class="tlprev" id="tlprev" data-start="' . e($tl['start']) . '" data-end="' . e($tl['end']) . '" data-minw="' . e($tl['min_w']) . '"><div class="tlprev-h">Vorschau Zeitleiste (' . e(fmt_month($tl['start'])) . ' bis ' . e(fmt_month($tl['end'])) . ')</div><div class="tlprev-bar"><span id="tlprevbar"></span></div><small class="hint" id="tlprevtxt"></small></div>';
}

function view_edit_group(array $user, string $g, array $vals, array $errors): void
{
    $def = schema()['groups'][$g];
    layout_start($user, $def['label'], 'g:' . $g);
    if (!empty($def['help'])) {
        echo '<p class="lead">' . e($def['help']) . '</p>';
    }
    $isDraft = setting_has_draft($g);
    if ($isDraft) {
        draft_banner($user, 'group', $g, false);
    }
    $meta = setting_meta($g);
    if ($meta['at'] && !in_array($meta['by'], ['seed', ''], true)) {
        echo '<p class="hint">Zuletzt geändert von ' . e(who_name($meta['by'])) . ', ' . e(when_fmt($meta['at'])) . '</p>';
    }
    form_errors($errors);
    if ($g === 'seo') {
        echo '<p class="lead">Ansehen: <a href="' . AR_BASE . '/robots.txt" target="_blank" rel="noopener">robots.txt</a> · <a href="' . AR_BASE . '/sitemap.xml" target="_blank" rel="noopener">sitemap.xml</a> · <a href="' . AR_BASE . '/llms.txt" target="_blank" rel="noopener">llms.txt</a> · <a href="https://search.google.com/test/rich-results?url=' . rawurlencode(abs_url('/')) . '" target="_blank" rel="noopener">Google: Test für strukturierte Daten ↗</a></p>';
        echo '<div class="serp" id="serp" aria-label="Vorschau in der Google-Suche"><div class="serp-url">' . e(preg_replace('~^https?://~', '', abs_url('/'))) . '</div><div class="serp-title"></div><div class="serp-desc"></div></div>';
    }
    ?>
<form method="post" action="<?= a() ?>" enctype="multipart/form-data" class="form">
<?= csrf_field($user) ?><input type="hidden" name="action" value="save_group"><input type="hidden" name="g" value="<?= e($g) ?>">
<?php
    lang_bar($def['fields'], $vals);
    foreach ($def['fields'] as $f) {
        render_field($f, $vals[$f['key']] ?? '', $vals);
    }
    form_actions(a(), preview_anchor($g), $isDraft);
    echo '</form>';
    history_box($user, 'group', $g);
    layout_end();
}
