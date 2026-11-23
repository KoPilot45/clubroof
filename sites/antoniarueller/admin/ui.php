<?php
declare(strict_types=1);

/** Bausteine der Oberfläche: Symbole, Seitenleiste, Suche, Website-Karte, Hilfe. */

function aicon(string $name, int $size = 18): string
{
    static $p = [
        'home' => '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
        'film' => '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
        'mic' => '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
        'user' => '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
        'doc' => '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
        'chat' => '<path d="M4 5h16v11H9l-5 4z"/>',
        'mail' => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
        'palette' => '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-1.9-.4-1 .2-2.1 1.3-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
        'search' => '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        'chart' => '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
        'gear' => '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
        'map' => '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
        'plus' => '<path d="M12 5v14M5 12h14"/>',
        'dots' => '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
        'eye' => '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        'copy' => '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
        'trash' => '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
        'edit' => '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
        'up' => '<path d="m6 14 6-6 6 6"/>',
        'down' => '<path d="m6 10 6 6 6-6"/>',
        'external' => '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
        'help' => '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.5"/>',
        'logout' => '<path d="M10 4H5v16h5M16 8l4 4-4 4M20 12H9"/>',
        'menu' => '<path d="M4 7h16M4 12h16M4 17h16"/>',
        'check' => '<path d="m5 12 5 5 9-10"/>',
        'globe' => '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
        'save' => '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    ];
    return '<svg class="ic" width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . ($p[$name] ?? '') . '</svg>';
}

/** Link-Ziel eines Menüeintrags. */
function nav_href(string $kind, string $key): string
{
    return $kind === 'c' ? a('p=list&c=' . $key) : ($kind === 'g' ? a('p=group&g=' . $key) : a('p=' . $key));
}

/** Anzahl offener Entwürfe je Sammlung/Gruppe: ['c:clips' => 2, 'g:hero' => 1] */
function nav_draft_counts(): array
{
    $n = [];
    foreach (open_drafts() as $d) {
        $k = $d['kind'] === 'item' ? 'c:' . $d['coll'] : 'g:' . $d['ref'];
        $n[$k] = ($n[$k] ?? 0) + 1;
    }
    return $n;
}

function render_sidebar(array $user, string $active): void
{
    $s = schema();
    $isOwner = $user['role'] === 'owner';
    $drafts = nav_draft_counts();
    $trashN = 0;
    foreach (array_keys($s['collections']) as $c) {
        $trashN += (int)q('SELECT COUNT(*) FROM ar_items WHERE coll = ? AND deleted_at IS NOT NULL', [$c])->fetchColumn();
    }
    echo '<nav aria-label="Hauptmenü">';
    echo '<a href="' . a() . '" class="top' . ($active === 'home' ? ' on' : '') . '">' . aicon('home') . 'Übersicht</a>';
    foreach (admin_nav() as $gid => [$title, $ic, $desc, $entries]) {
        $vis = array_filter($entries, fn($e) => empty($e[4]) || $isOwner);
        if (!$vis) {
            continue;
        }
        $isOpen = false;
        $gDraft = 0;
        foreach ($vis as $e) {
            $key = $e[0] === 'p' ? $e[1] : $e[0] . ':' . $e[1];
            $isOpen = $isOpen || $active === $key;
            $gDraft += $drafts[$e[0] . ':' . $e[1]] ?? 0;
        }
        echo '<details class="ng" data-g="' . e($gid) . '"' . ($isOpen ? ' open data-active="1"' : '') . '><summary>' . aicon($ic) . '<span class="ng-t">' . e($title) . '</span>';
        if ($gDraft) {
            echo '<span class="badge warn" title="Offene Entwürfe">' . $gDraft . '</span>';
        }
        echo '</summary><div class="ng-l">';
        foreach ($vis as $e) {
            [$kind, $key, $label] = $e;
            $act = $kind === 'p' ? $active === $key : $active === $kind . ':' . $key;
            $cnt = $drafts[$kind . ':' . $key] ?? 0;
            echo '<a href="' . e(nav_href($kind, $key)) . '" class="' . ($act ? 'on' : '') . '" title="' . e($e[3]) . '"' . ($act ? ' aria-current="page"' : '') . '>' . e($label);
            if ($cnt) {
                echo ' <span class="badge warn" title="Offene Entwürfe">' . $cnt . '</span>';
            } elseif ($kind === 'p' && $key === 'trash' && $trashN) {
                echo ' <span class="badge">' . $trashN . '</span>';
            }
            echo '</a>';
        }
        echo '</div></details>';
    }
    echo '</nav>';
}

/** Suchindex für Strg+K: Menüpunkte und alle Inhalte. */
function admin_search_index(array $user): array
{
    $isOwner = $user['role'] === 'owner';
    $s = schema();
    $idx = [['t' => 'Übersicht', 's' => 'Startseite der Verwaltung', 'u' => a(), 'k' => 'Seite']];
    foreach (admin_nav() as [$title, , , $entries]) {
        foreach ($entries as $e) {
            if (!empty($e[4]) && !$isOwner) {
                continue;
            }
            $idx[] = ['t' => $e[2], 's' => $e[3], 'u' => nav_href($e[0], $e[1]), 'k' => $title];
        }
    }
    foreach ($s['collections'] as $coll => $def) {
        foreach (items($coll, false, true) as $r) {
            $t = trim((string)($r[$def['title']] ?? ''));
            if ($t === '') {
                continue;
            }
            $idx[] = ['t' => mb_strimwidth($t, 0, 80, '…'), 's' => $def['singular'], 'u' => a('p=edit&c=' . $coll . '&id=' . $r['_id']), 'k' => $def['label']];
        }
    }
    foreach ([['Neue Referenz', 'clips'], ['Neue Podcast-Folge', 'episodes']] as [$t, $c]) {
        $idx[] = ['t' => $t, 's' => 'Neu anlegen', 'u' => a('p=edit&c=' . $c), 'k' => 'Neu'];
    }
    return $idx;
}

function render_search_box(array $user): void
{
    $json = json_encode(admin_search_index($user), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    echo '<div class="gs" id="gs" hidden><div class="gs-card" role="dialog" aria-modal="true" aria-label="Suchen"><div class="gs-in">' . aicon('search') . '<input type="search" id="gsq" placeholder="Suchen: Referenz, Impressum, Podcast …" autocomplete="off" aria-label="Suchbegriff"><kbd>Esc</kbd></div><ul id="gsl" class="gs-l" role="listbox"></ul></div></div>';
    echo '<script type="application/json" id="gsdata">' . $json . '</script>';
}

/** Website-Karte: die Abschnitte der Seite in echter Reihenfolge, mit Zugriff auf alles darin. */
function site_map(array $user): void
{
    $s = schema();
    $drafts = nav_draft_counts();
    $order = [
        'start' => 'inhalt', 'arbeiten' => 'arbeiten', 'podcast' => 'podcast', 'ueber' => 'ueber',
        'cv' => 'lebenslauf', 'otr' => 'offtherecord', 'kontakt' => 'kontakt',
    ];
    $nav = admin_nav();
    echo '<section class="card wide sitemap" aria-labelledby="smh"><div class="sm-h"><h2 id="smh">' . aicon('map', 20) . ' Deine Website</h2><a class="btn small ghost" href="' . e(preview_url()) . '" target="_blank" rel="noopener">Ganze Vorschau ' . aicon('external', 14) . '</a></div>';
    echo '<p class="hint">So ist die Seite aufgebaut – von oben nach unten. Wähle einen Abschnitt, um ihn zu bearbeiten.</p><ol class="sm-g">';
    foreach ($order as $gid => $anchor) {
        [$title, $ic, $desc, $entries] = $nav[$gid];
        echo '<li class="sm-c"><div class="sm-t">' . aicon($ic, 20) . '<strong>' . e($title) . '</strong></div><p class="sm-d">' . e($desc) . '</p><ul>';
        foreach ($entries as $e) {
            [$kind, $key, $label] = $e;
            $meta = '';
            if ($kind === 'c') {
                $meta = (string)count(items($key, false, true));
            }
            $dn = $drafts[$kind . ':' . $key] ?? 0;
            echo '<li><a href="' . e(nav_href($kind, $key)) . '">' . e($label) . '</a>' . ($meta !== '' ? ' <span class="cnt">' . e($meta) . '</span>' : '') . ($dn ? ' <span class="pill warn">Entwurf</span>' : '') . '</li>';
        }
        echo '</ul><a class="sm-v" href="' . e(preview_url($anchor)) . '" target="_blank" rel="noopener">In der Vorschau ansehen ' . aicon('external', 13) . '</a></li>';
    }
    echo '</ol></section>';
}

function view_help(array $user): void
{
    layout_start($user, 'Hilfe', 'help');
    echo '<p class="lead">Kurze Anleitungen für die häufigsten Aufgaben. Mit <kbd>Strg</kbd> + <kbd>K</kbd> findest du jede Stelle der Verwaltung sofort.</p>';
    $topics = [
        ['Neue Referenz anlegen', ['Menü „Arbeiten“ → „Referenzen“ → „Referenz hinzufügen“.', 'Titel, Kategorie und Datum eintragen; mit dem Datum landet sie automatisch an der richtigen Stelle der Zeitleiste.', '„Als Entwurf speichern“ zeigt sie nur dir (über „Vorschau“), „Veröffentlichen“ schaltet sie live.']],
        ['Podcast-Folge hinzufügen', ['Menü „Podcast“ → „Folgen“ → „Folge hinzufügen“.', 'Titel und Links zu den Plattformen eintragen. Leere Links werden nicht angezeigt.']],
        ['Etwas vorübergehend ausblenden', ['In der Liste den Schalter „Anzeigen“ der Zeile ausschalten. Der Eintrag bleibt erhalten und kann jederzeit wieder eingeschaltet werden.']],
        ['Reihenfolge ändern', ['In der Liste die Zeile am Griff (⠿) ziehen. Ohne Maus: Menü „⋯“ → „Nach oben / unten“.']],
        ['Versehentlich entfernt?', ['Nach dem Entfernen erscheint unten ein Hinweis mit „Rückgängig“. Später findest du den Eintrag im Papierkorb (Menü „System“).']],
        ['Englische Fassung', ['Menü „Englisch“ → „Übersetzungstabelle“: links der deutsche Text, rechts die englische Fassung. Gespeichert wird beim Verlassen des Feldes.', 'Mit dem Filter „Noch offen“ siehst du nur, was noch fehlt. Leere Felder zeigen auf der englischen Seite den deutschen Text.']],
        ['Änderungen prüfen, bevor sie öffentlich sind', ['„Als Entwurf speichern“ und dann „Vorschau“ öffnen. Im Formular zeigt „Live-Vorschau“ die Seite direkt daneben.', 'Entwürfe werden beim Schreiben automatisch gespeichert – öffentlich wird erst, was du veröffentlichst.']],
        ['Tastenkürzel', ['<kbd>Strg</kbd> + <kbd>K</kbd> Suche · <kbd>Strg</kbd> + <kbd>S</kbd> Entwurf speichern · <kbd>Strg</kbd> + <kbd>Enter</kbd> Veröffentlichen']],
    ];
    echo '<div class="helpgrid">';
    foreach ($topics as [$t, $steps]) {
        echo '<section class="card"><h2>' . e($t) . '</h2><ul class="plain">';
        foreach ($steps as $x) {
            echo '<li>' . (str_contains($x, '<kbd>') ? $x : e($x)) . '</li>';
        }
        echo '</ul></section>';
    }
    echo '</div>';
    layout_end();
}
