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
        $legal = setting('legal');
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
