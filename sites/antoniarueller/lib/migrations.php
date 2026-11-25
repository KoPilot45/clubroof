<?php
declare(strict_types=1);

/**
 * Einmalige Anpassungen bestehender Installationen (laufen automatisch beim nächsten Aufruf).
 */
function run_migrations(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $row = $pdo->query("SELECT data FROM ar_settings WHERE grp = '_migrations'")->fetchColumn();
    $applied = $row ? (json_decode((string)$row, true) ?: []) : [];
    $before = count($applied);

    // Entwürfe, Versionen, Passwort, Geräteliste
    if (!in_array('schema_v2', $applied, true)) {
        $my = db_is_mysql();
        $txt = $my ? 'MEDIUMTEXT' : 'TEXT';
        $id = $my ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
        $tail = $my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
        foreach ([
            "ALTER TABLE ar_items ADD COLUMN draft $txt NULL",
            "ALTER TABLE ar_items ADD COLUMN live INT NOT NULL DEFAULT 1",
            "ALTER TABLE ar_settings ADD COLUMN draft $txt NULL",
            "ALTER TABLE ar_users ADD COLUMN pw_hash VARCHAR(255) NULL",
            "ALTER TABLE ar_sessions ADD COLUMN ua_text VARCHAR(190) NOT NULL DEFAULT ''",
            "CREATE TABLE IF NOT EXISTS ar_versions (id $id, kind VARCHAR(10) NOT NULL, ref VARCHAR(60) NOT NULL, data $txt NOT NULL, saved_by VARCHAR(190) NOT NULL DEFAULT '', saved_at INT NOT NULL)$tail",
            "CREATE INDEX ar_versions_r ON ar_versions (kind, ref)",
        ] as $sql) {
            try {
                $pdo->exec($sql);
            } catch (Throwable $e) {
                // Spalte/Tabelle existiert bereits
            }
        }
        $applied[] = 'schema_v2';
    }

    // Tabelle für „Passwort vergessen“
    if (!in_array('resets_v1', $applied, true)) {
        $my = db_is_mysql();
        $id = $my ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
        $tail = $my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS ar_resets (id $id, email VARCHAR(190) NOT NULL, token_hash VARCHAR(64) NOT NULL, expires INT NOT NULL, used INT NOT NULL DEFAULT 0, created_at INT NOT NULL)$tail");
        } catch (Throwable $e) {
            error_log('ar_resets: ' . $e->getMessage());
        }
        $applied[] = 'resets_v1';
    }

    // Titel/Beschreibung/Vorschaubild wandern aus „Allgemein“ in den neuen Bereich „SEO“
    if (!in_array('seo_v1', $applied, true)) {
        $has = $pdo->query("SELECT 1 FROM ar_settings WHERE grp = 'seo'")->fetchColumn();
        if (!$has) {
            $site = setting('site');
            $seo = array_merge(field_defaults(schema()['groups']['seo']['fields']), array_intersect_key($site, array_flip(['title', 'description', 'og_image'])));
            save_setting('seo', $seo, 'migration');
        }
        $applied[] = 'seo_v1';
    }

    // Neue Vorlagen für Impressum/Datenschutz, solange die alten Platzhalter unverändert sind
    if (!in_array('legal_v1', $applied, true)) {
        require_once __DIR__ . '/legal_defaults.php';
        $legal = setting('legal', true);
        $new = legal_defaults();
        $old = legal_old_placeholders();
        $changed = false;
        foreach (['impressum' => 0, 'datenschutz' => 1] as $k => $i) {
            if (trim((string)$legal[$k]) === '' || trim((string)$legal[$k]) === $old[$i]) {
                $legal[$k] = $new[$k];
                $changed = true;
            }
        }
        if ($changed) {
            save_setting('legal', $legal, 'migration');
        }
        $applied[] = 'legal_v1';
    }

    // Sinnvolle SEO-Texte für robots/llms (nur, wo noch nichts Eigenes steht)
    if (!in_array('seo_v2', $applied, true)) {
        $seo = setting('seo');
        $oldDesc = 'Antonia Rüller – Journalistin und Reporterin in Bremen. Recherche und dokumentarisches Erzählen für Radio, Podcast und Bewegtbild.';
        if (in_array(trim((string)$seo['title']), ['', 'Antonia Rüller – Journalistin'], true)) {
            $seo['title'] = 'Antonia Rüller – Journalistin & Reporterin in Bremen';
        }
        if (in_array(trim((string)$seo['description']), ['', $oldDesc], true)) {
            $seo['description'] = 'Antonia Rüller, Journalistin und Reporterin in Bremen: investigative Recherche und dokumentarisches Erzählen für Radio, Podcast und Video – u. a. Radio Bremen, ARD und WDR.';
        }
        if (trim((string)$seo['llms_summary']) === '') {
            $seo['llms_summary'] = 'Antonia Rüller ist Journalistin und Reporterin in Bremen. Sie recherchiert und erzählt dokumentarisch für Radio, Podcast und Bewegtbild – seit November 2026 im Investigativ-Bereich von Radio Bremen. Zuvor war sie sieben Jahre beim WDR (Lokalzeit, WDR aktuell, MordOrte) und arbeitete u. a. für das ARD-Studio Istanbul, das ARD-Hauptstadtstudio, das Y-Kollektiv und SRF Genf. Schwerpunkte: politische Umbrüche, Macht und Selbstbestimmung, Gesundheitsversorgung, Klima und Recht, Türkei.';
        }
        if (trim((string)$seo['llms_extra']) === '') {
            $seo['llms_extra'] = "Beiträge dürfen mit Quellenangabe und Link zitiert werden. Die Rechte an den verlinkten Beiträgen liegen bei den jeweiligen Redaktionen. Diese Datei ist ein Überblick; maßgeblich ist die Startseite. Für Anfragen und Recherchehinweise bitte den Kontaktbereich der Startseite nutzen.";
        }
        if ($seo['ai_bots'] === 'allow') {
            $seo['ai_bots'] = 'block';
        }
        save_setting('seo', $seo, 'migration');
        $applied[] = 'seo_v2';
    }

    // Social-Media-Profile: bisherigen LinkedIn-Link als erstes Profil übernehmen
    if (!in_array('social_v1', $applied, true)) {
        $have = $pdo->query("SELECT 1 FROM ar_items WHERE coll = 'social' LIMIT 1")->fetchColumn();
        $contact = setting('contact');
        $li = trim((string)($contact['linkedin'] ?? ''));
        if (!$have && $li !== '') {
            save_item('social', null, ['label' => 'LinkedIn', 'url' => $li, 'published' => true], 'migration');
        }
        $applied[] = 'social_v1';
    }

    // Englische Startübersetzungen (erneut anwendbar: füllt nur leere Felder)
    foreach (['en_v1', 'en_v2'] as $mid) {
        if (!in_array($mid, $applied, true)) {
            migrate_en_dictionary();
            $applied[] = $mid;
        }
    }

    // Datenschutz: Reichweitenmessung ergänzen
    if (!in_array('privacy_stats_v1', $applied, true)) {
        $legal = setting('legal', true);
        $patched = privacy_stats_patch((string)$legal['datenschutz']);
        if ($patched !== null) {
            $legal['datenschutz'] = $patched;
            save_setting('legal', $legal, 'migration');
        }
        $applied[] = 'privacy_stats_v1';
    }

    require_once __DIR__ . '/legal_defaults.php';
    // Datenschutz: Besuchserkennung (ein Besuch pro Gerät und Stunde)
    if (!in_array('privacy_stats_v2', $applied, true)) {
        $legal = setting('legal', true);
        $pairs = privacy_stats_v2_pairs();
        $ch = false;
        foreach (['datenschutz' => 'de', 'datenschutz_en' => 'en'] as $key => $lng) {
            $txt = (string)($legal[$key] ?? '');
            $new = $txt;
            foreach ($pairs[$lng] as [$o, $n]) {
                $new = str_replace($o, $n, $new);
            }
            if ($new !== $txt) {
                $legal[$key] = $new;
                $ch = true;
            }
        }
        if ($ch) {
            save_setting('legal', $legal, 'migration');
        }
        $applied[] = 'privacy_stats_v2';
    }

    // Reparatur: Impressum/Datenschutz-Vorlagen, falls noch die alten Platzhalter oder leere Texte gespeichert sind
    if (!in_array('legal_v2', $applied, true)) {
        require_once __DIR__ . '/legal_defaults.php';
        $legal = setting('legal', true);
        $new = legal_defaults();
        $old = legal_old_placeholders();
        $changed = false;
        foreach (['impressum' => 0, 'datenschutz' => 1] as $k => $i) {
            $row = json_arr((string)(settings_rows()['legal']['data'] ?? ''));
            $stored = trim((string)($row[$k] ?? ''));
            if ($stored === '' || $stored === $old[$i]) {
                $legal[$k] = $new[$k];
                $changed = true;
            }
        }
        if ($changed) {
            save_setting('legal', $legal, 'migration');
        }
        $applied[] = 'legal_v2';
    }

    // Reparatur: LinkedIn-Link aus den alten Kontaktdaten als Social-Profil übernehmen (falls noch keins existiert)
    if (!in_array('social_v2', $applied, true)) {
        $have = $pdo->query("SELECT 1 FROM ar_items WHERE coll = 'social' LIMIT 1")->fetchColumn();
        $row = json_arr((string)(settings_rows()['contact']['data'] ?? ''));
        $li = trim((string)($row['linkedin'] ?? ''));
        if (!$have && $li !== '') {
            save_item('social', null, ['label' => 'LinkedIn', 'url' => $li, 'published' => true], 'migration');
        }
        $applied[] = 'social_v2';
    }

    // Sicherstellen, dass die Datenschutzerklärung die Besuchszählung beschreibt (falls noch nicht vorhanden)
    if (!in_array('privacy_stats_v3', $applied, true)) {
        $legal = setting('legal', true);
        $patched = privacy_stats_patch((string)$legal['datenschutz']);
        if ($patched !== null) {
            $legal['datenschutz'] = $patched;
            save_setting('legal', $legal, 'migration');
        }
        $applied[] = 'privacy_stats_v3';
    }

    // Datenschutz: Ereigniszähler, Crawler, 404
    if (!in_array('privacy_stats_v4', $applied, true)) {
        $legal = setting('legal', true);
        $pairs = privacy_stats_v4_pairs();
        $ch = false;
        foreach (['datenschutz' => 'de', 'datenschutz_en' => 'en'] as $key => $lng) {
            $txt = (string)($legal[$key] ?? '');
            $new = $txt;
            foreach ($pairs[$lng] as [$o, $n]) {
                if (!str_contains($new, 'Verknüpfungen angeklickt') && !str_contains($new, 'certain links are clicked')) {
                    $new = str_replace($o, $n, $new);
                }
            }
            if ($new !== $txt) {
                $legal[$key] = $new;
                $ch = true;
            }
        }
        if ($ch) {
            save_setting('legal', $legal, 'migration');
        }
        $applied[] = 'privacy_stats_v4';
    }

    // Reihenfolge: „Über mich“ vor „Lebenslauf“ (Navigation)
    if (!in_array('order_v1', $applied, true)) {
        $nav = [];
        foreach (q("SELECT id, data, sort FROM ar_items WHERE coll = 'nav' AND deleted_at IS NULL")->fetchAll() as $r) {
            $d = json_arr($r['data']) ?? [];
            $nav[(string)($d['anchor'] ?? '')] = $r;
        }
        if (isset($nav['lebenslauf'], $nav['ueber']) && (int)$nav['lebenslauf']['sort'] < (int)$nav['ueber']['sort']) {
            q('UPDATE ar_items SET sort = ? WHERE id = ?', [(int)$nav['ueber']['sort'], (int)$nav['lebenslauf']['id']]);
            q('UPDATE ar_items SET sort = ? WHERE id = ?', [(int)$nav['lebenslauf']['sort'], (int)$nav['ueber']['id']]);
        }
        $applied[] = 'order_v1';
    }

    // Schnittplatz ohne Datumsmaßstab: lange Balken früherer Fassungen werden zu „Lang“, kurze bleiben „Normal“
    if (!in_array('schnitt_v1', $applied, true)) {
        foreach (q("SELECT id, data, draft FROM ar_items WHERE coll = 'clips'")->fetchAll() as $r) {
            foreach (['data', 'draft'] as $col) {
                $d = json_arr($r[$col] ?? null);
                if ($d === null || isset($d['tl_len'])) {
                    continue;
                }
                $long = !empty($d['tl_end']) || (float)str_replace(',', '.', (string)($d['tl_w'] ?? 0)) >= 8;
                $d['tl_len'] = $long ? 'long' : 'normal';
                q('UPDATE ar_items SET ' . $col . ' = ? WHERE id = ?', [json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (int)$r['id']]);
            }
        }
        $applied[] = 'schnitt_v1';
    }

    // Laufband entfernt: die nicht mehr verwendeten Wörter werden einmalig gelöscht (Sicherungen enthalten sie weiterhin)
    if (!in_array('laufband_v1', $applied, true)) {
        q("DELETE FROM ar_items WHERE coll = 'marquee'");
        $applied[] = 'laufband_v1';
    }

    // Kategorien statt Spuren: jede Referenz bekommt die Kategorie (Spur) passend zu ihrem früheren Medium; Listentitel „Alle Beiträge“
    if (!in_array('kategorien_v1', $applied, true)) {
        $tr = q("SELECT data FROM ar_items WHERE coll = 'tracks' AND deleted_at IS NULL ORDER BY sort ASC, id ASC")->fetchAll();
        $tracks = array_values(array_filter(array_map(fn($r) => json_arr($r['data']) ?? [], $tr), fn($t) => !empty($t['code'])));
        if ($tracks) {
            $codes = array_column($tracks, 'code');
            foreach (q("SELECT id, data, draft FROM ar_items WHERE coll = 'clips'")->fetchAll() as $r) {
                foreach (['data', 'draft'] as $col) {
                    $d = json_arr($r[$col] ?? null);
                    if ($d === null || in_array((string)($d['tl_track'] ?? ''), $codes, true)) {
                        continue;
                    }
                    $hit = null;
                    foreach ($tracks as $t) {
                        if (($t['icon'] ?? '') === ($d['medium'] ?? 'text')) {
                            $hit = $t['code'];
                            break;
                        }
                    }
                    $d['tl_track'] = $hit ?? $tracks[0]['code'];
                    q('UPDATE ar_items SET ' . $col . ' = ? WHERE id = ?', [json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (int)$r['id']]);
                }
            }
        }
        foreach (q("SELECT grp, data, draft FROM ar_settings WHERE grp = 'sections'")->fetchAll() as $r) {
            foreach (['data', 'draft'] as $col) {
                $d = json_arr($r[$col] ?? null);
                if ($d === null || ($d['show_all'] ?? '') !== 'Alle Clips') {
                    continue;
                }
                $d['show_all'] = 'Alle Beiträge';
                if (($d['show_all_en'] ?? '') === 'All clips') {
                    $d['show_all_en'] = 'All posts';
                }
                q('UPDATE ar_settings SET ' . $col . ' = ? WHERE grp = ?', [json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'sections']);
            }
        }
        $applied[] = 'kategorien_v1';
    }

    // Abschnitte: veralteten Hinweis zum Schnittplatz auf dem Handy (Pfeile gibt es nicht mehr) aktualisieren
    if (!in_array('abschnitte_v1', $applied, true)) {
        foreach (q("SELECT data, draft FROM ar_settings WHERE grp = 'timeline'")->fetchAll() as $r) {
            foreach (['data', 'draft'] as $col) {
                $d = json_arr($r[$col] ?? null);
                if ($d === null || ($d['hint_mobile'] ?? '') !== 'Pfeile nutzen oder Clip antippen') {
                    continue;
                }
                $d['hint_mobile'] = 'Clip antippen: springt zum Beitrag';
                if (($d['hint_mobile_en'] ?? '') !== '') {
                    $d['hint_mobile_en'] = 'Tap a clip to jump to the post';
                }
                q('UPDATE ar_settings SET ' . $col . ' = ? WHERE grp = ?', [json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'timeline']);
            }
        }
        $applied[] = 'abschnitte_v1';
    }

    // Zusätzliche Zugänge aus config.php ('extra_users'): werden einmal angelegt; spätere Entfernung im Admin bleibt bestehen
    foreach ((array)cfg('extra_users', []) as $u) {
        $em = strtolower(trim((string)($u['email'] ?? '')));
        $mark = 'user:' . $em;
        if ($em === '' || !filter_var($em, FILTER_VALIDATE_EMAIL) || in_array($mark, $applied, true)) {
            continue;
        }
        $exists = $pdo->prepare('SELECT 1 FROM ar_users WHERE email = ?');
        $exists->execute([$em]);
        if (!$exists->fetchColumn()) {
            $pdo->prepare('INSERT INTO ar_users (email, name, role, created_at) VALUES (?,?,?,?)')
                ->execute([$em, mb_substr((string)($u['name'] ?? ''), 0, 120), 'editor', time()]);
        }
        $applied[] = $mark;
    }
    // Rolle „Inhaber“ für Zugänge aus config.php ('role' => 'owner'), einmalig
    foreach ((array)cfg('extra_users', []) as $u) {
        $em = strtolower(trim((string)($u['email'] ?? '')));
        $mark = 'role:' . $em;
        if ($em !== '' && ($u['role'] ?? '') === 'owner' && !in_array($mark, $applied, true)) {
            $pdo->prepare("UPDATE ar_users SET role = 'owner' WHERE email = ?")->execute([$em]);
            $applied[] = $mark;
        }
    }

    // Stationen und Lebenslauf sind eine Liste: Logo, Redaktion und Link der alten „Sender & Redaktionen“ wandern an passende Lebenslauf-Einträge
    // (gleiche Organisation); ohne passenden Eintrag entsteht ein neuer. Die alten Datensätze bleiben unangetastet in der Tabelle.
    if (!in_array('cv_stations_v1', $applied, true)) {
        try {
            $st = $pdo->query("SELECT data FROM ar_items WHERE coll = 'stations' AND deleted_at IS NULL ORDER BY sort ASC, id ASC")->fetchAll();
            if ($st) {
                $cvRows = $pdo->query("SELECT id, data, draft FROM ar_items WHERE coll = 'cv' AND deleted_at IS NULL")->fetchAll();
                $maxSort = (int)$pdo->query("SELECT COALESCE(MAX(sort), 0) FROM ar_items WHERE coll = 'cv'")->fetchColumn();
                $fill = function (array $d, array $src): array {
                    foreach (['logo', 'desk', 'url'] as $k) {
                        if (trim((string)($d[$k] ?? '')) === '' && trim((string)($src[$k] ?? '')) !== '') {
                            $d[$k] = (string)$src[$k];
                        }
                    }
                    return $d;
                };
                foreach ($st as $row) {
                    $sd = json_decode((string)$row['data'], true) ?: [];
                    $name = trim((string)($sd['name'] ?? ''));
                    if ($name === '') {
                        continue;
                    }
                    $src = ['logo' => $sd['logo'] ?? '', 'desk' => $sd['desk'] ?? '', 'url' => $sd['url'] ?? ''];
                    $needle = mb_strtolower($name);
                    $hit = false;
                    foreach ($cvRows as $cr) {
                        $cd = json_decode((string)$cr['data'], true) ?: [];
                        $org = mb_strtolower(trim((string)($cd['org'] ?? '')));
                        if ($org === '' || !(str_contains($org, $needle) || str_contains($needle, $org))) {
                            continue;
                        }
                        $hit = true;
                        $upd = $pdo->prepare('UPDATE ar_items SET data = ?, draft = ? WHERE id = ?');
                        $dr = $cr['draft'] !== null ? json_decode((string)$cr['draft'], true) : null;
                        $upd->execute([json_encode($fill($cd, $src), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                            is_array($dr) ? json_encode($fill($dr, $src), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null, $cr['id']]);
                    }
                    if (!$hit) {
                        $nd = ['org' => $name, 'logo' => (string)$src['logo'], 'role' => '', 'from' => '', 'to' => '', 'ongoing' => false,
                            'when_label' => (string)($sd['period'] ?? ''), 'desk' => (string)$src['desk'], 'url' => (string)$src['url']];
                        $pdo->prepare('INSERT INTO ar_items (coll, data, sort, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)')
                            ->execute(['cv', json_encode($nd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ++$maxSort, time(), time(), 'migration']);
                    }
                }
            }
            $applied[] = 'cv_stations_v1';
        } catch (Throwable $e) {
            // Tabelle noch nicht vorhanden: beim nächsten Aufruf erneut
        }
    }

    // Überschriften „Crossmedial“ und „Sprachen“ liegen jetzt unter „Abschnitte“: vorhandene Werte (auch Englisch) übernehmen, nichts überschreiben
    if (!in_array('about_labels_v1', $applied, true)) {
        try {
            $ab = $pdo->query("SELECT data, draft FROM ar_settings WHERE grp = 'about'")->fetch();
            if ($ab) {
                $ad = json_decode((string)$ab['data'], true) ?: [];
                $sr = $pdo->query("SELECT data, draft FROM ar_settings WHERE grp = 'sections'")->fetch();
                $sd = $sr ? (json_decode((string)$sr['data'], true) ?: []) : [];
                $sdr = ($sr && $sr['draft'] !== null) ? (json_decode((string)$sr['draft'], true) ?: null) : null;
                $fill = function (array $to) use ($ad): array {
                    foreach (['cross_label', 'lang_label', 'cross_label_en', 'lang_label_en'] as $k) {
                        if (trim((string)($ad[$k] ?? '')) !== '' && trim((string)($to[$k] ?? '')) === '') {
                            $to[$k] = (string)$ad[$k];
                        }
                    }
                    return $to;
                };
                $enc = fn($x) => json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $nd = $fill($sd);
                if ($nd !== $sd || ($sdr !== null && $fill($sdr) !== $sdr)) {
                    if ($sr) {
                        $pdo->prepare("UPDATE ar_settings SET data = ?, draft = ? WHERE grp = 'sections'")->execute([$enc($nd), $sdr !== null ? $enc($fill($sdr)) : null]);
                    } else {
                        $pdo->prepare("INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES ('sections', ?, ?, 'migration')")->execute([$enc($nd), time()]);
                    }
                }
            }
            $applied[] = 'about_labels_v1';
        } catch (Throwable $e) {
            // beim nächsten Aufruf erneut
        }
    }

    // „Abschnitte“ (eine Gruppe für alle Abschnitte) ist auf vier Gruppen (Abschnittstexte je Menüpunkt) verteilt:
    // vorhandene Werte (auch Englisch und Entwürfe) werden übernommen, die alte Zeile bleibt unangetastet.
    if (!in_array('texts_split_v1', $applied, true)) {
        try {
            require_once __DIR__ . '/schema.php';
            $old = $pdo->query("SELECT data, draft FROM ar_settings WHERE grp = 'sections'")->fetch();
            if ($old) {
                $dat = json_decode((string)$old['data'], true) ?: [];
                $dra = $old['draft'] !== null ? (json_decode((string)$old['draft'], true) ?: null) : null;
                $partsD = split_legacy_sections($dat);
                $partsR = $dra !== null ? split_legacy_sections($dra) : [];
                $enc = fn($x) => json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                foreach (array_keys(texts_groups()) as $tg) {
                    $has = $pdo->prepare('SELECT 1 FROM ar_settings WHERE grp = ?');
                    $has->execute([$tg]);
                    if ($has->fetchColumn()) {
                        continue;
                    }
                    $pdo->prepare('INSERT INTO ar_settings (grp, data, draft, updated_at, updated_by) VALUES (?,?,?,?,?)')
                        ->execute([$tg, $enc($partsD[$tg] ?? []), $dra !== null && isset($partsR[$tg]) ? $enc($partsR[$tg]) : null, time(), 'migration']);
                }
            }
            $applied[] = 'texts_split_v1';
        } catch (Throwable $e) {
            // beim nächsten Aufruf erneut
        }
    }

    // Akzentfarbe und REC-Rot standen früher unter „Allgemein & Design“: Abweichungen vom Standard werden als „Eigene Farben“ übernommen
    if (!in_array('colors_v1', $applied, true)) {
        try {
            $has = $pdo->query("SELECT 1 FROM ar_settings WHERE grp = 'colors'")->fetchColumn();
            if (!$has) {
                $row = $pdo->query("SELECT data FROM ar_settings WHERE grp = 'site'")->fetchColumn();
                $sd = $row !== false ? (json_decode((string)$row, true) ?: []) : [];
                $acc = strtoupper(trim((string)($sd['accent'] ?? '')));
                $rec = strtoupper(trim((string)($sd['rec'] ?? '')));
                $custom = ($acc !== '' && $acc !== '#0E5C62' && preg_match('~^#[0-9A-F]{6}$~', $acc)) || ($rec !== '' && $rec !== '#C42F24' && preg_match('~^#[0-9A-F]{6}$~', $rec));
                if ($custom) {
                    $cd = ['palette' => 'custom', 'c_accent' => preg_match('~^#[0-9A-F]{6}$~', $acc) ? $acc : '#0E5C62', 'c_rec' => preg_match('~^#[0-9A-F]{6}$~', $rec) ? $rec : '#C42F24'];
                    $pdo->prepare("INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES ('colors', ?, ?, 'migration')")
                        ->execute([json_encode($cd), time()]);
                }
            }
            $applied[] = 'colors_v1';
        } catch (Throwable $e) {
            // beim nächsten Aufruf erneut
        }
    }

    // Schalter „Abschnitt zeigen“ (früher in den Abschnittstexten) liegen jetzt unter „Aufbau der Seite“: vorhandene Werte übernehmen
    if (!in_array('layout_v1', $applied, true)) {
        try {
            require_once __DIR__ . '/schema.php';
            $has = $pdo->query("SELECT 1 FROM ar_settings WHERE grp = 'layout'")->fetchColumn();
            if (!$has) {
                $keys = ['on_questions', 'on_show', 'on_podcast', 'on_about', 'on_cv', 'on_off', 'on_contact'];
                $data = [];
                foreach (['sections', 'texts_start', 'texts_arbeiten', 'texts_ueber', 'texts_kontakt'] as $g) {
                    $r = $pdo->prepare('SELECT data FROM ar_settings WHERE grp = ?');
                    $r->execute([$g]);
                    $row = $r->fetchColumn();
                    $d = $row !== false ? (json_decode((string)$row, true) ?: []) : [];
                    foreach ($keys as $k) {
                        if (array_key_exists($k, $d)) {
                            $data[$k] = !empty($d[$k]);
                        }
                    }
                }
                if ($data) {
                    $pdo->prepare("INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES ('layout', ?, ?, 'migration')")
                        ->execute([json_encode($data), time()]);
                }
            }
            $applied[] = 'layout_v1';
        } catch (Throwable $e) {
            // beim nächsten Aufruf erneut
        }
    }

    // Englische Texte ohne deutschen Text (Überschriftenteile, die auf Deutsch längst geleert sind) entfernen
    if (!in_array('en_orphans_v1', $applied, true)) {
        try {
            require_once __DIR__ . '/schema.php';
            $s = schema();
            $strip = function (array $fields, array $d): array {
                $eff = array_merge(field_defaults($fields), $d);
                $n = 0;
                foreach ($fields as $f) {
                    if ($f['type'] === 'section' || !field_translatable($f)) {
                        continue;
                    }
                    $k = $f['key'] . '_en';
                    if (trim((string)($eff[$f['key']] ?? '')) === '' && trim((string)($d[$k] ?? '')) !== '') {
                        $d[$k] = '';
                        $n++;
                    }
                }
                return [$d, $n];
            };
            foreach ($pdo->query('SELECT id, coll, data, draft FROM ar_items')->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $def = $s['collections'][$r['coll']] ?? null;
                if (!$def) {
                    continue;
                }
                foreach (['data', 'draft'] as $col) {
                    $d = json_decode((string)($r[$col] ?? ''), true);
                    if (!is_array($d)) {
                        continue;
                    }
                    [$d, $n] = $strip($def['fields'], $d);
                    if ($n) {
                        $pdo->prepare("UPDATE ar_items SET $col = ? WHERE id = ?")->execute([json_encode($d, JSON_UNESCAPED_UNICODE), (int)$r['id']]);
                    }
                }
            }
            foreach ($pdo->query('SELECT grp, data, draft FROM ar_settings')->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $def = $s['groups'][$r['grp']] ?? null;
                if (!$def) {
                    continue;
                }
                foreach (['data', 'draft'] as $col) {
                    $d = json_decode((string)($r[$col] ?? ''), true);
                    if (!is_array($d)) {
                        continue;
                    }
                    [$d, $n] = $strip($def['fields'], $d);
                    if ($n) {
                        $pdo->prepare("UPDATE ar_settings SET $col = ? WHERE grp = ?")->execute([json_encode($d, JSON_UNESCAPED_UNICODE), $r['grp']]);
                    }
                }
            }
            $applied[] = 'en_orphans_v1';
        } catch (Throwable $e) {
            // beim nächsten Aufruf erneut
        }
    }

    if (count($applied) !== $before) {
        $json = json_encode($applied);
        $exists = $pdo->query("SELECT 1 FROM ar_settings WHERE grp = '_migrations'")->fetchColumn();
        if ($exists) {
            $pdo->prepare("UPDATE ar_settings SET data = ?, updated_at = ? WHERE grp = '_migrations'")->execute([$json, time()]);
        } else {
            $pdo->prepare("INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES ('_migrations', ?, ?, 'system')")->execute([$json, time()]);
        }
        require_once __DIR__ . '/render.php';
        clear_page_cache();
        // robots.txt, sitemap.xml, llms.txt als echte Dateien bereitstellen
        require_once __DIR__ . '/seo_files.php';
        regenerate_seo_files();
    }
}

function migrate_en_dictionary(): void
{
    require_once __DIR__ . '/en_seed.php';
    $dict = en_dictionary();
    $s = schema();
    foreach (q('SELECT id, coll, data FROM ar_items')->fetchAll() as $r) {
        $def = $s['collections'][$r['coll']] ?? null;
        if (!$def) {
            continue;
        }
        $d = json_arr($r['data']) ?? [];
        $eff = array_merge(field_defaults($def['fields']), $d);
        $ch = false;
        foreach ($def['fields'] as $f) {
            if ($f['type'] === 'section' || !field_translatable($f)) {
                continue;
            }
            $de = (string)($eff[$f['key']] ?? '');
            if ($de !== '' && trim((string)($d[$f['key'] . '_en'] ?? '')) === '' && isset($dict[$de])) {
                $d[$f['key'] . '_en'] = $dict[$de];
                $ch = true;
            }
        }
        if ($ch) {
            q('UPDATE ar_items SET data = ? WHERE id = ?', [enc($d), (int)$r['id']]);
        }
    }
    foreach ($s['groups'] as $g => $def) {
        $row = q('SELECT data FROM ar_settings WHERE grp = ?', [$g])->fetch();
        $d = $row ? (json_arr($row['data']) ?? []) : [];
        $eff = array_merge(field_defaults($def['fields']), $d);
        $ch = false;
        foreach ($def['fields'] as $f) {
            if ($f['type'] === 'section' || !field_translatable($f)) {
                continue;
            }
            $de = (string)($eff[$f['key']] ?? '');
            if ($de !== '' && trim((string)($d[$f['key'] . '_en'] ?? '')) === '' && isset($dict[$de])) {
                $d[$f['key'] . '_en'] = $dict[$de];
                $ch = true;
            }
        }
        if ($g === 'seo') {
            foreach (en_seo_defaults() as $k => $v) {
                if (trim((string)($d[$k] ?? '')) === '') {
                    $d[$k] = $v;
                    $ch = true;
                }
            }
        }
        if ($g === 'legal') {
            foreach (legal_defaults_en() as $k => $v) {
                if (trim((string)($d[$k . '_en'] ?? '')) === '') {
                    $d[$k . '_en'] = $v;
                    $ch = true;
                }
            }
        }
        if ($ch) {
            if ($row) {
                q('UPDATE ar_settings SET data = ? WHERE grp = ?', [enc($d), $g]);
            } else {
                q('INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES (?,?,?,?)', [$g, enc($d), time(), 'migration']);
            }
        }
    }
}
