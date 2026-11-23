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
    }
}
