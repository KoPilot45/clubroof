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
        'clips' => 'arbeiten', 'tracks' => 'arbeiten', 'timeline' => 'arbeiten', 'episodes' => 'podcast', 'cv' => 'lebenslauf', 'before' => 'lebenslauf',
        'about' => 'ueber', 'crossmedia' => 'ueber', 'languages' => 'ueber', 'offrecord' => 'offtherecord', 'contact' => 'kontakt', 'social' => 'kontakt', 'hero' => 'inhalt',
        'questions' => 'inhalt',
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
        echo '<textarea id="' . e($id) . '" name="' . e($name) . '" rows="' . (int)($f['rows'] ?? 4) . '"' . ($max ? ' maxlength="' . $max . '"' : '') . (!empty($f['rich']) ? ' data-rich="1"' : '') . $desc . '>' . e($val) . '</textarea>';
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

/** Einzelnes Feld: versteckte Felder entfallen, abhängige Felder (show_if) erscheinen je nach Umschalter. */
function render_field(array $f, mixed $val, array $vals = []): void
{
    if (!empty($f['hidden'])) {
        return;
    }
    $open = '';
    $close = '';
    foreach (['show_if', 'show_if2'] as $sk) {
        if (!empty($f[$sk])) {
            $cur = (string)($vals[$f[$sk][0]] ?? '');
            $open .= '<div class="showif" data-showif="' . e($f[$sk][0] . '=' . $f[$sk][1]) . '"' . ($cur === (string)$f[$sk][1] ? '' : ' hidden') . '>';
            $close .= '</div>';
        }
    }
    if ($open !== '') {
        echo $open;
        render_field_inner($f, $val, $vals);
        echo $close;
        return;
    }
    render_field_inner($f, $val, $vals);
}

/** Eine Zeile der Galerie (Bild oder PDF mit optionaler Bildunterschrift). */
function gallery_row(string $k, string|int $i, array $g): string
{
    $fn = (string)($g['f'] ?? '');
    $thumb = $fn === '' ? '' : '<img src="' . e(upload_url($fn)) . '" alt="" loading="lazy">';
    return '<li class="gal-row" data-f="' . e($fn) . '"><span class="gal-grip" aria-hidden="true" title="Zum Sortieren ziehen">⠿</span><span class="gal-thumb">' . $thumb . '</span>'
        . '<span class="gal-fields"><input type="hidden" data-n="f" name="' . e($k) . '[' . $i . '][f]" value="' . e($fn) . '">'
        . '<input type="text" data-n="cap" name="' . e($k) . '[' . $i . '][cap]" value="' . e((string)($g['cap'] ?? '')) . '" maxlength="200" placeholder="Bildunterschrift (optional)" aria-label="Bildunterschrift (optional)"></span>'
        . '<span class="gal-btns"><button type="button" data-gal="up" aria-label="Nach oben" title="Nach oben">' . aicon('up', 16) . '</button><button type="button" data-gal="down" aria-label="Nach unten" title="Nach unten">' . aicon('down', 16) . '</button>'
        . '<button type="button" data-gal="del" class="danger" aria-label="Entfernen" title="Entfernen">' . aicon('x', 16) . '</button></span></li>';
}

function render_field_inner(array $f, mixed $val, array $vals = []): void
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
        case 'switch':
            echo '<div class="seg" role="group" aria-label="' . e($f['label']) . '">';
            foreach (($f['options'] ?? []) as $ov => $ol) {
                $on = (string)$val === (string)$ov;
                echo '<button type="button" class="seg-b' . ($on ? ' on' : '') . '" data-v="' . e($ov) . '" aria-pressed="' . ($on ? 'true' : 'false') . '">' . e($ol) . '</button>';
            }
            echo '<input type="hidden" id="' . $id . '" name="' . e($k) . '" value="' . e((string)$val) . '"></div>';
            break;
        case 'gallery':
            $gi = is_array($val) ? array_values($val) : [];
            echo '<div class="gal' . ($gi ? '' : ' empty') . '" data-key="' . e($k) . '" data-max="' . (int)($f['max_items'] ?? 30) . '"><ul class="gal-list" id="gal_' . e($k) . '">';
            foreach ($gi as $n => $g) {
                echo gallery_row($k, $n, (array)$g);
            }
            echo '</ul><p class="gal-none hint">Noch keine Bilder.</p><p class="gal-status newbadge" role="status" hidden></p>';
            echo '<div class="gal-add"><label class="btn small ghost gal-file">' . aicon('plus', 15) . ' Bilder hinzufügen<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,.avif" hidden></label> <button type="button" class="btn small ghost" data-gal-media>Aus Mediathek wählen</button></div>';
            echo '<template id="galtpl_' . e($k) . '">' . gallery_row($k, '__I__', []) . '</template></div>';
            echo '<small class="hint">JPG, PNG, WebP oder AVIF, je höchstens ' . (int)cfg('max_upload_mb', 8) . ' MB, bis zu ' . (int)($f['max_items'] ?? 30) . ' Bilder. Sie werden automatisch optimiert. Reihenfolge per Ziehen oder mit den Pfeilen ändern.</small>';
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
            $isLogo = !empty($f['logo']);
            $fo = (string)($vals[$k . '_focus'] ?? '');
            echo '<div class="imgbox"><div class="focusbox' . ($isLogo ? ' logo' : '') . '" data-key="' . e($k) . '"' . ($has ? '' : ' hidden') . '><img src="' . ($has ? e(upload_url((string)$val)) : '') . '" alt="Aktuelles Bild"><span class="fdot"></span><button type="button" class="imgx" data-img-remove="' . e($k) . '" aria-label="Bild entfernen" title="Bild entfernen">' . aicon('x', 16) . '</button></div>';
            echo '<div class="imgask" role="alertdialog" aria-label="Bild entfernen?" hidden><span>Dieses Bild wirklich entfernen?</span><button type="button" class="btn small danger" data-img-yes>Ja, entfernen</button><button type="button" class="btn small ghost" data-img-no>Abbrechen</button></div>';
            echo '<small class="hint focushint"' . ($has && !$isLogo ? '' : ' hidden') . '>Klicke ins Bild, um den wichtigen Ausschnitt (z. B. das Gesicht) festzulegen. Er bleibt sichtbar, wenn das Bild zugeschnitten wird.</small>';
            echo '<input type="hidden" name="' . e($k) . '_focus" value="' . e($fo) . '"><input type="hidden" name="' . e($k) . '_pick" id="f_' . e($k) . '_pick" value="">';
            echo '<input type="hidden" name="_remove_' . e($k) . '" id="f_' . e($k) . '_remove" value="">';
            echo '</div><input type="file" id="' . $id . '" name="' . e($k) . '" accept="image/jpeg,image/png,image/webp,image/avif,.avif"' . ($isLogo ? ' data-logo' : '') . $desc . '> <button type="button" class="btn small ghost" data-media-pick="' . e($k) . '">Aus Mediathek wählen</button>';
            if ($isLogo) {
                echo '<small class="hint">Am besten <strong>freigestellt</strong> (transparenter Hintergrund, PNG oder WebP), z. B. mit „Hintergrund entfernen“ in einer Bildbearbeitungs-App oder auf remove.bg. Wird beim Hochladen automatisch auf höchstens ' . LOGO_MAX_W . ' × ' . LOGO_MAX_H . ' Pixel verkleinert und in WebP umgewandelt.</small>';
            } else {
                echo '<small class="hint">JPG, PNG, WebP oder AVIF, höchstens ' . (int)cfg('max_upload_mb', 8) . ' MB. Wird automatisch verkleinert und optimiert.</small>';
            }
            break;
        case 'pdf':
            $hasPdf = $val !== '' && upload_url((string)$val) !== '';
            echo '<div class="pdfbox"' . ($hasPdf ? '' : ' hidden') . '><span class="pdf-ic" aria-hidden="true">' . aicon('doc', 22) . '</span><a href="' . ($hasPdf ? e(upload_url((string)$val)) : '#') . '" target="_blank" rel="noopener">Aktuelles PDF öffnen</a><button type="button" class="btn small danger-o" data-pdf-remove="' . e($k) . '">Entfernen</button></div>';
            echo '<p class="newbadge pdfnote" role="status" hidden></p>';
            echo '<input type="hidden" name="_remove_' . e($k) . '" id="f_' . e($k) . '_remove" value=""><input type="hidden" name="' . e($k) . '_pick" id="f_' . e($k) . '_pick" value="">';
            echo '<input type="file" id="' . $id . '" name="' . e($k) . '" accept="application/pdf" data-pdf-up' . $desc . '> <button type="button" class="btn small ghost" data-pdf-media="' . e($k) . '">Aus Mediathek wählen</button>';
            echo '<small class="hint">PDF, höchstens ' . (int)cfg('max_upload_mb', 8) . ' MB. Wird sofort hochgeladen; auf der Seite erscheint es erst nach „Veröffentlichen“.</small>';
            break;
    }
    echo $hint . '</div>';
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

/** Hinweis über dem Formular: Englisch wird in der Übersetzungstabelle bearbeitet. */
function lang_bar(array $fields, array $vals, string $areaKey = ''): void
{
    $n = 0;
    $any = false;
    foreach ($fields as $f) {
        if ($f['type'] === 'section' || !field_translatable($f) || !field_relevant($f, $vals)) {
            continue;
        }
        $any = true;
        if (trim((string)($vals[$f['key']] ?? '')) !== '' && trim((string)($vals[$f['key'] . '_en'] ?? '')) === '') {
            $n++;
        }
    }
    if ($any) {
        echo '<p class="enhint">' . aicon('globe', 16) . ' <span>Englische Fassung: ' . ($n ? '<strong>' . $n . ' Text' . ($n === 1 ? '' : 'e') . ' noch offen</strong>' : 'vollständig') . '.</span> <a href="' . e(a('p=translate' . ($areaKey !== '' ? '&a=' . rawurlencode($areaKey) : ''))) . '">In der Übersetzungstabelle bearbeiten →</a></p>';
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
    $desc = $def['help'] ?? '';
    if ($desc === '') {
        foreach (admin_nav() as [, , , $entries]) {
            foreach ($entries as $e) {
                if ($e[0] === 'c' && $e[1] === $coll) {
                    $desc = $e[3];
                }
            }
        }
    }
    if ($desc !== '') {
        echo '<p class="lead">' . e($desc) . '</p>';
    }
    $imgKey = '';
    $hasPub = false;
    foreach ($def['fields'] as $f) {
        if ($f['type'] === 'image' && $imgKey === '') {
            $imgKey = $f['key'];
        }
        $hasPub = $hasPub || $f['key'] === 'published';
    }
    $cnt = ['all' => count($rows), 'draft' => 0, 'hidden' => 0];
    foreach ($rows as $r) {
        $cnt['draft'] += (!$r['_live'] || $r['_draft']) ? 1 : 0;
        $cnt['hidden'] += ($hasPub && !$r['published']) ? 1 : 0;
    }
    echo '<div class="toolbar"><a class="btn" href="' . a('p=edit&c=' . $coll) . '">' . aicon('plus') . ' ' . e($def['singular']) . ' hinzufügen</a>';
    if (count($rows) > 6) {
        echo '<input type="search" id="rowfilter" placeholder="In dieser Liste suchen …" aria-label="Liste durchsuchen">';
    }
    echo '<a class="btn ghost" href="' . e(preview_url(preview_anchor($coll))) . '" target="_blank" rel="noopener">Vorschau ' . aicon('external', 14) . '</a></div>';
    if ($rows && ($cnt['draft'] || $cnt['hidden'])) {
        echo '<div class="chips" role="group" aria-label="Filtern"><button type="button" class="chip on" data-f="all">Alle <span>' . $cnt['all'] . '</span></button>';
        if ($cnt['draft']) {
            echo '<button type="button" class="chip" data-f="draft">Entwürfe <span>' . $cnt['draft'] . '</span></button>';
        }
        if ($cnt['hidden']) {
            echo '<button type="button" class="chip" data-f="hidden">Ausgeblendet <span>' . $cnt['hidden'] . '</span></button>';
        }
        echo '</div>';
    }
    if (!$rows) {
        echo '<div class="emptystate">' . aicon('plus', 28) . '<p><strong>Noch keine Einträge.</strong><br>Lege ' . e($def['singular'] === 'Frage' ? 'die erste' : 'den ersten') . ' Eintrag an – er erscheint auf der Seite, sobald du ihn veröffentlichst.</p><a class="btn" href="' . a('p=edit&c=' . $coll) . '">' . e($def['singular']) . ' hinzufügen</a></div>';
        layout_end();
        return;
    }
    echo '<form method="post" action="' . a() . '" id="bulkform" class="bulk" hidden>' . csrf_field($user) . '<input type="hidden" name="action" value="bulk"><span class="bulk-n" id="bulkn"></span>';
    if ($hasPub) {
        echo '<button class="btn small ghost" name="op" value="show">Einblenden</button><button class="btn small ghost" name="op" value="hide">Ausblenden</button>';
    }
    echo '<button class="btn small danger-o" name="op" value="trash" data-confirm="Die ausgewählten Einträge in den Papierkorb verschieben?">In den Papierkorb</button></form>';
    echo '<ol class="rows sortable cards" id="rows" data-coll="' . e($coll) . '" data-csrf="' . e($user['csrf']) . '" data-url="' . e(a()) . '">';
    foreach ($rows as $i => $r) {
        $title = trim((string)($r[$def['title']] ?? '')) ?: '(ohne Titel)';
        $sub = array_filter(array_map(fn($k) => (string)($r[$k] ?? ''), $def['sub']));
        $hidden = $hasPub && !$r['published'];
        $isDraft = !$r['_live'] || $r['_draft'];
        $state = ($isDraft ? 'draft ' : '') . ($hidden ? 'hidden' : '');
        $edit = a('p=edit&c=' . $coll . '&id=' . $r['_id']);
        echo '<li id="i' . $r['_id'] . '" class="row' . ($hidden ? ' off' : '') . '" data-id="' . $r['_id'] . '" data-state="' . e(trim($state)) . '" draggable="true">';
        echo '<input type="checkbox" class="sel" name="ids[]" value="' . $r['_id'] . '" form="bulkform" aria-label="' . e($title) . ' auswählen">';
        echo '<span class="grip" aria-hidden="true" title="Ziehen zum Sortieren">⠿</span><span class="no">' . sprintf('%02d', $i + 1) . '</span>';
        if ($imgKey !== '' && !empty($r[$imgKey])) {
            echo '<img class="thumb" src="' . e(upload_url((string)$r[$imgKey])) . '" alt="" loading="lazy" width="56" height="56">';
        }
        echo '<a class="r-main" href="' . e($edit) . '"><strong>' . e(mb_strimwidth($title, 0, 90, '…')) . '</strong>';
        if ($sub) {
            echo '<small>' . e(implode(' · ', $sub)) . '</small>';
        }
        echo '<span class="chipline">';
        if (!$r['_live']) {
            echo '<span class="pill warn">Neu · nicht veröffentlicht</span>';
        } elseif ($r['_draft']) {
            echo '<span class="pill warn">Entwurf mit Änderungen</span>';
        }
        if ($hidden) {
            echo '<span class="pill hid">Ausgeblendet</span>';
        }
        if (!empty($def['star']) && !empty($r[$def['star']])) {
            echo '<span class="pill feat ' . ($hidden ? 'warn' : 'ok') . '">' . ($hidden ? 'Featured – aktuell ausgeblendet' : 'Featured') . '</span>';
        }
        if ($r['_updated_by'] !== '' && $r['_updated_by'] !== 'seed') {
            echo '<span class="muted2">' . e(who_name($r['_updated_by'])) . ', ' . e(date('d.m.Y', $r['_updated'])) . '</span>';
        }
        echo '</span></a><span class="r-act">';
        if (!empty($def['star'])) {
            $isStar = !empty($r[$def['star']]);
            echo '<form method="post" action="' . a() . '" class="inline star-f">' . csrf_field($user) . '<input type="hidden" name="action" value="toggle_featured"><input type="hidden" name="id" value="' . $r['_id'] . '"><button class="star' . ($isStar ? ' on' : '') . '" aria-pressed="' . ($isStar ? 'true' : 'false') . '" aria-label="' . e($title) . ' als Featured hervorheben" title="' . ($isStar ? 'Featured – zum Aufheben klicken' : 'Als Featured hervorheben (immer nur eine Referenz)') . '">' . aicon('star', 18) . '</button></form>';
        }
        if ($hasPub) {
            echo '<form method="post" action="' . a() . '" class="inline tgl-f">' . csrf_field($user) . '<input type="hidden" name="action" value="toggle_pub"><input type="hidden" name="id" value="' . $r['_id'] . '"><input type="hidden" name="to" value="' . ($hidden ? '1' : '0') . '"><button class="tgl' . ($hidden ? '' : ' on') . '" role="switch" aria-checked="' . ($hidden ? 'false' : 'true') . '" aria-label="' . e($title) . ' auf der Seite anzeigen" title="' . ($hidden ? 'Ausgeblendet – zum Einblenden klicken' : 'Sichtbar – zum Ausblenden klicken') . '"><span></span></button></form>';
        }
        echo '<a class="btn small ghost" href="' . e($edit) . '">' . aicon('edit', 15) . ' Bearbeiten</a>';
        echo '<details class="more"><summary aria-label="Weitere Aktionen für ' . e($title) . '">' . aicon('dots') . '</summary><div class="more-m">';
        foreach (['up' => ['up', 'Nach oben'], 'down' => ['down', 'Nach unten']] as $dir => [$ic, $lab]) {
            if (($dir === 'up' && $i === 0) || ($dir === 'down' && $i === count($rows) - 1)) {
                continue;
            }
            echo '<form method="post" action="' . a() . '">' . csrf_field($user) . '<input type="hidden" name="action" value="move"><input type="hidden" name="id" value="' . $r['_id'] . '"><input type="hidden" name="dir" value="' . $dir . '"><button>' . aicon($ic, 16) . $lab . '</button></form>';
        }
        echo '<form method="post" action="' . a() . '">' . csrf_field($user) . '<input type="hidden" name="action" value="duplicate"><input type="hidden" name="id" value="' . $r['_id'] . '"><button>' . aicon('copy', 16) . 'Duplizieren</button></form>';
        echo '<form method="post" action="' . a() . '">' . csrf_field($user) . '<input type="hidden" name="action" value="trash"><input type="hidden" name="id" value="' . $r['_id'] . '"><button class="danger">' . aicon('trash', 16) . 'In den Papierkorb</button></form>';
        echo '</div></details></span></li>';
    }
    echo '</ol>';
    layout_end();
}

function form_actions(string $cancelUrl, string $previewAnchor, bool $isDraft, bool $canLive = false): void
{
    echo '<div class="actions" id="actions"><div class="act-main"><button class="btn" name="mode" value="publish">' . aicon('check', 16) . ' Veröffentlichen</button><button class="btn ghost" name="mode" value="draft">Als Entwurf speichern</button></div>';
    echo '<span class="savestate" id="savestate" role="status" aria-live="polite">' . ($isDraft ? 'Entwurf vorhanden' : 'Keine Änderungen') . '</span>';
    echo '<div class="act-aux">';
    if ($canLive) {
        echo '<button type="button" class="ibtn" id="livebtn" aria-pressed="false" data-src="' . e(preview_url($previewAnchor)) . '" title="Live-Vorschau neben dem Formular ein- oder ausblenden">' . aicon('panel', 16) . '<span>Live</span></button>';
    }
    echo '<a class="ibtn" href="' . e(preview_url($previewAnchor)) . '" target="_blank" rel="noopener" title="Vorschau in neuem Tab">' . aicon('eye', 16) . '<span>Vorschau</span></a>';
    echo '<a class="ibtn" href="' . e(AR_BASE . '/admin/vorschau.php?lang=en' . ($previewAnchor !== '' ? '#' . $previewAnchor : '')) . '" target="_blank" rel="noopener" title="Englische Vorschau in neuem Tab">' . aicon('globe', 16) . '<span>English</span></a>';
    echo '<a class="act-cancel" href="' . e($cancelUrl) . '">Abbrechen</a>';
    echo '<details class="kbhelp"><summary aria-label="Hilfe zum Speichern und zu Tastenkürzeln" title="Hilfe">?</summary><div class="kbhelp-m"><p><strong>Veröffentlichen</strong> ist sofort für alle sichtbar. <strong>Als Entwurf speichern</strong> bleibt nur für dich sichtbar; Änderungen werden außerdem automatisch als Entwurf gesichert.</p><p><kbd>Strg</kbd>+<kbd>S</kbd> Entwurf · <kbd>Strg</kbd>+<kbd>Enter</kbd> veröffentlichen</p></div></details>';
    echo '</div></div>';
}

/** Felder ausgeben; Abschnitte mit 'adv' => true sind als „Erweitert“ eingeklappt, mit 'card' => true als Karte mit Schieberegler. */
function render_fields(array $fields, array $vals, ?callable $after = null): void
{
    $adv = false;
    $card = false;
    $toggles = [];
    foreach ($fields as $f) {
        if (!empty($f['card_toggle'])) {
            $toggles[$f['key']] = $f;
        }
    }
    foreach ($fields as $f) {
        if ($f['type'] === 'section') {
            if ($adv) {
                echo '</details>';
                $adv = false;
            }
            if (!empty($f['sub']) && $card) {
                echo '<h3 class="seccard-sub">' . e($f['label']) . '</h3>';
                continue;
            }
            if ($card) {
                echo '</div></section>';
                $card = false;
            }
            if (!empty($f['card'])) {
                $tk = (string)($f['toggle'] ?? '');
                $on = $tk === '' || !empty($vals[$tk]);
                echo '<section class="seccard' . ($on ? '' : ' off') . '"><header class="seccard-h"><h2>' . e($f['label']) . '</h2>';
                if ($tk !== '' && isset($toggles[$tk])) {
                    echo '<label class="sw"><input type="checkbox" name="' . e($tk) . '" value="1"' . ($on ? ' checked' : '') . ' aria-label="' . e($f['label'] . ': ' . $toggles[$tk]['label']) . '"><span class="sw-ui" aria-hidden="true"></span><span class="sw-t"><span class="sw-on">Sichtbar</span><span class="sw-off">Ausgeblendet</span></span></label>';
                } else {
                    echo '<span class="sw-fix">Immer sichtbar</span>';
                }
                if (!empty($f['link'])) {
                    echo '<a class="seccard-l" href="' . e(nav_href($f['link'][0], $f['link'][1])) . '">Inhalte bearbeiten →</a>';
                }
                echo '</header>';
                if (!empty($f['note'])) {
                    echo '<p class="seccard-note">' . e($f['note']) . '</p>';
                }
                echo '<div class="seccard-b">';
                $card = true;
                continue;
            }
            if (!empty($f['adv'])) {
                echo '<details class="adv"><summary>' . e($f['label']) . ' <small>(erweitert)</small></summary>';
                $adv = true;
                continue;
            }
        }
        if (!empty($f['card_toggle'])) {
            continue;
        }
        render_field($f, $vals[$f['key']] ?? '', $vals);
        if ($after) {
            $after($f);
        }
    }
    if ($adv) {
        echo '</details>';
    }
    if ($card) {
        echo '</div></section>';
    }
}

function view_edit_item(array $user, string $coll, ?int $id, array $vals, array $errors): void
{
    $def = schema()['collections'][$coll];
    layout_start($user, ($id ? $def['singular'] . ' bearbeiten' : $def['singular'] . ' hinzufügen'), 'c:' . $coll, true);
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
<div class="edwrap" id="edwrap">
<form method="post" action="<?= a() ?>" enctype="multipart/form-data" class="form" data-coll="<?= e($coll) ?>"<?= $id ? ' data-autosave="1"' : '' ?>>
<?= csrf_field($user) ?><input type="hidden" name="action" value="save_item"><input type="hidden" name="coll" value="<?= e($coll) ?>"><input type="hidden" name="id" value="<?= (int)$id ?>">
<?php
    lang_bar($def['fields'], $vals, 'c:' . $coll);
    render_fields($def['fields'], $vals);
    form_actions(a('p=list&c=' . $coll), preview_anchor($coll), $isDraft, (bool)$id);
    echo '</form><aside class="livepane" id="livepane" hidden><div class="lp-h"><strong>Live-Vorschau</strong><button type="button" class="btn small ghost" id="lpreload">Aktualisieren</button></div><iframe id="lpframe" title="Vorschau der Seite" loading="lazy"></iframe></aside></div>';
    if ($id) {
        history_box($user, 'item', (string)$id);
    }
    layout_end();
}

function view_edit_group(array $user, string $g, array $vals, array $errors): void
{
    $def = schema()['groups'][$g];
    layout_start($user, $def['label'], 'g:' . $g, true);
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
<div class="edwrap" id="edwrap">
<form method="post" action="<?= a() ?>" enctype="multipart/form-data" class="form" data-autosave="1">
<?= csrf_field($user) ?><input type="hidden" name="action" value="save_group"><input type="hidden" name="g" value="<?= e($g) ?>">
<?php
    lang_bar($def['fields'], $vals, 'g:' . $g);
    render_fields($def['fields'], $vals);
    form_actions(a(), preview_anchor($g), $isDraft, true);
    echo '</form><aside class="livepane" id="livepane" hidden><div class="lp-h"><strong>Live-Vorschau</strong><button type="button" class="btn small ghost" id="lpreload">Aktualisieren</button></div><iframe id="lpframe" title="Vorschau der Seite" loading="lazy"></iframe></aside></div>';
    history_box($user, 'group', $g);
    layout_end();
}
