<?php
declare(strict_types=1);

/** Texte mit [Platzhaltern] in veröffentlichten Inhalten finden. */
function find_placeholders(): array
{
    $s = schema();
    $out = [];
    $scan = function (array $fields, array $vals, string $area, string $item, string $link) use (&$out) {
        foreach ($fields as $f) {
            if (!in_array($f['type'], ['text', 'textarea', 'markup', 'url'], true) || in_array($f['key'], ['robots_extra'], true)) {
                continue;
            }
            foreach ([$f['key'] => '', $f['key'] . '_en' => ' (English)'] as $key => $suffix) {
                $v = (string)($vals[$key] ?? '');
                if ($v !== '' && preg_match('~\[[^\]\n]{2,}\]~u', $v, $m)) {
                    $out[] = ['area' => $area, 'item' => $item, 'field' => $f['label'] . $suffix, 'snippet' => $m[0], 'link' => $link];
                }
            }
        }
    };
    foreach ($s['collections'] as $coll => $def) {
        foreach (items($coll, false, true) as $it) {
            if (array_key_exists('published', $it) && !$it['published']) {
                continue;
            }
            $title = trim((string)$it[$def['title']]) ?: '(ohne Titel)';
            $scan($def['fields'], $it, $def['label'], mb_strimwidth($title, 0, 50, '…'), a('p=edit&c=' . $coll . '&id=' . $it['_id']));
        }
    }
    foreach ($s['groups'] as $g => $def) {
        $scan($def['fields'], setting($g, true), $def['label'], '', a('p=group&g=' . $g));
    }
    return $out;
}

/** Wie viel ist ins Englische übersetzt? */
function translation_progress(): array
{
    $s = schema();
    $total = 0;
    $done = 0;
    $byArea = [];
    $count = function (array $fields, array $vals, string $area) use (&$total, &$done, &$byArea) {
        foreach ($fields as $f) {
            if ($f['type'] === 'section' || !field_translatable($f) || !field_relevant($f, $vals)) {
                continue;
            }
            $de = trim((string)($vals[$f['key']] ?? ''));
            if ($de === '') {
                continue;
            }
            $total++;
            if (trim((string)($vals[$f['key'] . '_en'] ?? '')) !== '') {
                $done++;
            } else {
                $byArea[$area] = ($byArea[$area] ?? 0) + 1;
            }
        }
    };
    foreach ($s['collections'] as $coll => $def) {
        foreach (items($coll, false, true) as $it) {
            $count($def['fields'], $it, $def['label']);
        }
    }
    foreach ($s['groups'] as $g => $def) {
        $count($def['fields'], setting($g, true), $def['label']);
    }
    arsort($byArea);
    return ['total' => $total, 'done' => $done, 'missing_by_area' => $byArea];
}

/**
 * Alle übersetzbaren Texte für die Übersetzungstabelle.
 * Zeile: key (c:ID:feld | g:gruppe:feld), area, area_key, item, label, de, en, multi, max, link
 */
/** Felder, die nur bei bestimmter Einstellung gelten (show_if) oder deren Standardtext das Wörterbuch übersetzt, werden nicht abgefragt. */
function field_relevant(array $f, array $vals): bool
{
    if (!empty($f['show_if']) && (string)($vals[$f['show_if'][0]] ?? '') !== (string)$f['show_if'][1]) {
        return false;
    }
    if (!empty($f['dict']) && trim((string)($vals[$f['key']] ?? '')) === (string)($f['default'] ?? '')) {
        return false;
    }
    return true;
}

function translation_rows(): array
{
    $s = schema();
    $out = [];
    $add = function (array $fields, array $vals, string $kind, string $ref, string $area, string $areaKey, string $item, string $link) use (&$out) {
        foreach ($fields as $f) {
            if ($f['type'] === 'gallery') {
                foreach ((array)($vals[$f['key']] ?? []) as $g) {
                    if (trim((string)($g['cap'] ?? '')) === '') {
                        continue;
                    }
                    $out[] = [
                        'key' => $kind . ':' . $ref . ':gallery.' . $g['f'], 'area' => $area, 'area_key' => $areaKey, 'item' => $item, 'label' => 'Bildunterschrift',
                        'de' => trim((string)$g['cap']), 'en' => (string)($g['cap_en'] ?? ''), 'multi' => false, 'rich' => false, 'max' => 200, 'link' => $link,
                    ];
                }
                continue;
            }
            if ($f['type'] === 'section' || !field_translatable($f) || !field_relevant($f, $vals)) {
                continue;
            }
            $de = trim((string)($vals[$f['key']] ?? ''));
            if ($de === '') {
                continue;
            }
            $out[] = [
                'key' => $kind . ':' . $ref . ':' . $f['key'], 'area' => $area, 'area_key' => $areaKey, 'item' => $item, 'label' => $f['label'],
                'de' => $de, 'en' => (string)($vals[$f['key'] . '_en'] ?? ''), 'multi' => $f['type'] === 'textarea', 'rich' => !empty($f['rich']), 'max' => (int)($f['max'] ?? 500), 'link' => $link,
            ];
        }
    };
    foreach ($s['groups'] as $g => $def) {
        $add($def['fields'], setting($g, true), 'g', $g, $def['label'], 'g:' . $g, '', a('p=group&g=' . $g));
    }
    foreach ($s['collections'] as $coll => $def) {
        foreach (items($coll, false, true) as $it) {
            $title = trim((string)($it[$def['title']] ?? '')) ?: '(ohne Titel)';
            $add($def['fields'], $it, 'c', (string)$it['_id'], $def['label'], 'c:' . $coll, mb_strimwidth($title, 0, 60, '…'), a('p=edit&c=' . $coll . '&id=' . $it['_id']));
        }
    }
    return $out;
}

/** „Startklar“-Liste: [['ok'=>bool, 'text'=>…, 'link'=>…, 'level'=>'must'|'nice']] */
function readiness_checks(): array
{
    $c = setting('contact', true);
    $seo = setting('seo', true);
    $hero = setting('hero', true);
    $legal = setting('legal', true);
    $clips = array_filter(items('clips', false, true), fn($x) => $x['published'] && (($x['link_mode'] === 'hosted' && $x['gallery']) || ($x['link_mode'] !== 'hosted' && str_starts_with(safe_url($x['url']), 'http'))));
    $ph = fn(string $t) => $t === '' || (bool)preg_match('~\[[^\]\n]{2,}\]~u', $t);
    $tp = translation_progress();
    $pct = $tp['total'] ? (int)round($tp['done'] / $tp['total'] * 100) : 100;
    $last = backup_last();
    $titleLen = mb_strlen((string)$seo['title']);
    $descLen = mb_strlen((string)$seo['description']);
    return [
        ['must', trim((string)$c['email']) !== '', 'Kontakt-E-Mail-Adresse eingetragen', a('p=group&g=contact')],
        ['must', !$ph((string)$legal['impressum']), 'Impressum vollständig (keine [Platzhalter] mehr)', a('p=group&g=legal')],
        ['must', !$ph((string)$legal['datenschutz']), 'Datenschutzerklärung vollständig (keine [Platzhalter] mehr)', a('p=group&g=legal')],
        ['must', str_contains((string)$legal['datenschutz'], 'Reichweitenmessung'), 'Datenschutzerklärung beschreibt die Besuchszählung (Abschnitt „Reichweitenmessung“)', a('p=group&g=legal')],
        ['must', !$seo['noindex'], 'Suchmaschinen zugelassen („noindex“ ist aus)', a('p=group&g=seo')],
        ['must', $hero['photo'] !== '' && trim((string)$hero['photo_alt']) !== '', 'Startfoto mit Bildbeschreibung', a('p=group&g=hero')],
        ['must', count($clips) >= 3, 'Mindestens drei Referenzen mit echtem Link oder eigenen Bildern', a('p=list&c=clips')],
        ['nice', $titleLen >= 40 && $titleLen <= 70 && $descLen >= 100 && $descLen <= 170, 'Titel und Beschreibung für Google in guter Länge', a('p=group&g=seo')],
        ['nice', count(items('social', false, true)) > 0, 'Mindestens ein Social-Media-Profil', a('p=list&c=social')],
        ['nice', cfg('mail.driver') !== 'log', 'Mailversand ist eingerichtet', a('p=check')],
        ['nice', !is_file(AR_ROOT . '/diagnose.php') && !is_dir(AR_ROOT . '/tools'), 'Diagnose-Datei und Ordner tools/ vom Server entfernt', a('p=check')],
        ['nice', $last > time() - 14 * 86400, 'Sicherung der letzten 14 Tage vorhanden', a('p=backup')],
        ['nice', $pct >= 80, 'Englische Fassung zu mindestens 80 % übersetzt (jetzt ' . $pct . ' %)', a('p=list&c=clips')],
    ];
}
