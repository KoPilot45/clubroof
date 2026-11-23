<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/render.php';
require __DIR__ . '/../lib/seo_files.php';
require __DIR__ . '/views.php';

security_headers(true);
check_origin();
header('Content-Type: text/html; charset=utf-8');

$p = (string)($_GET['p'] ?? 'home');
$user = current_user();

// ---------- Anmeldung ----------
if (!$user) {
    $step = 'email';
    $email = '';
    $error = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $action = (string)($_POST['action'] ?? '');
        $email = strtolower(trim((string)($_POST['email'] ?? '')));
        if ($action === 'request') {
            login_request($email);
            $step = 'code';
        } elseif ($action === 'verify') {
            if (login_verify($email, (string)($_POST['code'] ?? ''), (string)($_POST['pw'] ?? ''))) {
                header('Location: ' . AR_BASE . '/admin/');
                exit;
            }
            $step = 'code';
            $error = 'Code oder Passwort ungültig bzw. Code abgelaufen. Bitte neuen Code anfordern.';
        }
    }
    view_login($step, $email, $error);
    exit;
}

// ---------- Aktionen (nur POST + CSRF) ----------
$flash = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check($user);
    register_shutdown_function(function () {
        clear_page_cache();
        regenerate_seo_files();
    });
    $act = (string)($_POST['action'] ?? '');
    $who = $user['email'];
    $back = function (string $to, string $msg, string $type = 'ok') {
        setcookie('ar_flash', $type . '|' . rawurlencode($msg), ['expires' => time() + 30, 'path' => AR_BASE . '/admin/', 'httponly' => true, 'samesite' => 'Strict', 'secure' => is_https()]);
        header('Location: ' . $to);
        exit;
    };
    $s = schema();
    switch ($act) {
        case 'logout':
            logout();
            header('Location: ' . AR_BASE . '/admin/');
            exit;

        case 'save_item': {
            $coll = (string)($_POST['coll'] ?? '');
            $id = (int)($_POST['id'] ?? 0) ?: null;
            if (!isset($s['collections'][$coll])) {
                fatal('Unbekannter Bereich.', 400);
            }
            $old = $id ? (item($id) ?: []) : [];
            if ($id && (($old['coll'] ?? '') !== $coll || $old['_deleted'] !== null)) {
                fatal('Eintrag nicht gefunden.', 404);
            }
            [$data, $errors] = sanitize_fields($s['collections'][$coll]['fields'], $_POST, $_FILES, $old);
            if ($errors) {
                view_edit_item($user, $coll, $id, array_merge(field_defaults($s['collections'][$coll]['fields']), $data), $errors);
                exit;
            }
            $publish = ($_POST['mode'] ?? 'publish') !== 'draft';
            $id = save_item($coll, $id, $data, $who, $publish);
            audit($who, $publish ? 'publish_item' : 'draft_item', $coll . '#' . $id . ' ' . ($data[$s['collections'][$coll]['title']] ?? ''));
            if ($publish) {
                $back(AR_BASE . '/admin/?p=list&c=' . $coll, 'Veröffentlicht.');
            }
            $back(AR_BASE . '/admin/?p=edit&c=' . $coll . '&id=' . $id, 'Entwurf gespeichert – noch nicht öffentlich. Mit „Vorschau“ ansehen, mit „Jetzt veröffentlichen“ live schalten.');
        }

        case 'save_group': {
            $g = (string)($_POST['g'] ?? '');
            if (!isset($s['groups'][$g])) {
                fatal('Unbekannter Bereich.', 400);
            }
            $old = setting($g, true);
            [$data, $errors] = sanitize_fields($s['groups'][$g]['fields'], $_POST, $_FILES, $old);
            if ($errors) {
                view_edit_group($user, $g, array_merge($old, $data), $errors);
                exit;
            }
            $publish = ($_POST['mode'] ?? 'publish') !== 'draft';
            save_setting($g, $data, $who, $publish);
            cleanup_uploads();
            audit($who, $publish ? 'publish_group' : 'draft_group', $g);
            $back(AR_BASE . '/admin/?p=group&g=' . $g, $publish ? 'Veröffentlicht.' : 'Entwurf gespeichert – noch nicht öffentlich. Mit „Vorschau“ ansehen.');
        }

        case 'publish_draft':
            if (($_POST['kind'] ?? '') === 'item') {
                $it = item((int)($_POST['id'] ?? 0));
                if ($it) {
                    publish_item_draft((int)$it['_id'], $who);
                    audit($who, 'publish_item', $it['coll'] . '#' . $it['_id']);
                    $back(AR_BASE . '/admin/?p=list&c=' . $it['coll'], 'Veröffentlicht.');
                }
            } elseif (isset($s['groups'][(string)($_POST['g'] ?? '')])) {
                publish_setting_draft((string)$_POST['g'], $who);
                audit($who, 'publish_group', (string)$_POST['g']);
                $back(AR_BASE . '/admin/?p=group&g=' . $_POST['g'], 'Veröffentlicht.');
            }
            $back(AR_BASE . '/admin/', 'Nicht gefunden.', 'err');

        case 'discard_draft':
            if (($_POST['kind'] ?? '') === 'item') {
                $it = item((int)($_POST['id'] ?? 0));
                if ($it) {
                    discard_item_draft((int)$it['_id']);
                    audit($who, 'discard_draft', $it['coll'] . '#' . $it['_id']);
                    $back(AR_BASE . '/admin/?p=list&c=' . $it['coll'], 'Entwurf verworfen.');
                }
            } elseif (isset($s['groups'][(string)($_POST['g'] ?? '')])) {
                discard_setting_draft((string)$_POST['g']);
                audit($who, 'discard_draft', (string)$_POST['g']);
                $back(AR_BASE . '/admin/?p=group&g=' . $_POST['g'], 'Entwurf verworfen.');
            }
            $back(AR_BASE . '/admin/', 'Nicht gefunden.', 'err');

        case 'publish_all':
            foreach (open_drafts() as $d) {
                if ($d['kind'] === 'item') {
                    publish_item_draft((int)$d['ref'], $who);
                } else {
                    publish_setting_draft((string)$d['ref'], $who);
                }
            }
            audit($who, 'publish_all');
            $back(AR_BASE . '/admin/', 'Alle Entwürfe veröffentlicht.');

        case 'restore_version': {
            $ver = q('SELECT * FROM ar_versions WHERE id = ?', [(int)($_POST['vid'] ?? 0)])->fetch();
            if (!$ver || $ver['kind'] !== (string)($_POST['kind'] ?? '') || $ver['ref'] !== (string)($_POST['ref'] ?? '')) {
                $back(AR_BASE . '/admin/', 'Fassung nicht gefunden.', 'err');
            }
            reset_content_cache();
            if ($ver['kind'] === 'item') {
                q('UPDATE ar_items SET draft = ?, updated_at = ?, updated_by = ? WHERE id = ?', [$ver['data'], time(), $who, (int)$ver['ref']]);
                $it = item((int)$ver['ref']);
                audit($who, 'restore_version', 'item#' . $ver['ref']);
                $back(AR_BASE . '/admin/?p=edit&c=' . ($it['coll'] ?? '') . '&id=' . (int)$ver['ref'], 'Frühere Fassung als Entwurf geladen. Prüfen und veröffentlichen.');
            }
            save_setting((string)$ver['ref'], json_arr($ver['data']) ?? [], $who, false);
            audit($who, 'restore_version', 'group:' . $ver['ref']);
            $back(AR_BASE . '/admin/?p=group&g=' . $ver['ref'], 'Frühere Fassung als Entwurf geladen. Prüfen und veröffentlichen.');
        }

        case 'reorder':
            $ok = reorder_items((string)($_POST['coll'] ?? ''), array_filter(explode(',', (string)($_POST['ids'] ?? ''))));
            header('Content-Type: application/json');
            echo json_encode(['ok' => $ok]);
            exit;

        case 'trash':
            $it = item((int)($_POST['id'] ?? 0));
            if ($it) {
                trash_item((int)$it['_id']);
                audit($who, 'trash', $it['coll'] . '#' . $it['_id']);
                $back(AR_BASE . '/admin/?p=list&c=' . $it['coll'], 'In den Papierkorb verschoben. Du findest den Eintrag dort wieder.');
            }
            $back(AR_BASE . '/admin/', 'Eintrag nicht gefunden.', 'err');

        case 'restore':
            $it = item((int)($_POST['id'] ?? 0));
            if ($it) {
                restore_item((int)$it['_id']);
                audit($who, 'restore', $it['coll'] . '#' . $it['_id']);
                $back(AR_BASE . '/admin/?p=trash', 'Wiederhergestellt.');
            }
            $back(AR_BASE . '/admin/?p=trash', 'Eintrag nicht gefunden.', 'err');

        case 'purge':
            $it = item((int)($_POST['id'] ?? 0));
            if ($it && $it['_deleted'] !== null) {
                purge_item((int)$it['_id']);
                audit($who, 'purge', $it['coll'] . '#' . $it['_id']);
                $back(AR_BASE . '/admin/?p=trash', 'Endgültig gelöscht.');
            }
            $back(AR_BASE . '/admin/?p=trash', 'Eintrag nicht gefunden.', 'err');

        case 'empty_trash':
            $n = 0;
            foreach (array_keys($s['collections']) as $c) {
                foreach (items($c, true) as $it) {
                    purge_item((int)$it['_id']);
                    $n++;
                }
            }
            audit($who, 'empty_trash', (string)$n);
            $back(AR_BASE . '/admin/?p=trash', $n . ' Einträge endgültig gelöscht.');

        case 'move':
            $it = item((int)($_POST['id'] ?? 0));
            if ($it) {
                move_item((int)$it['_id'], ($_POST['dir'] ?? '') === 'up' ? 'up' : 'down');
                header('Location: ' . AR_BASE . '/admin/?p=list&c=' . $it['coll'] . '#i' . $it['_id']);
                exit;
            }
            $back(AR_BASE . '/admin/', 'Eintrag nicht gefunden.', 'err');

        case 'add_user':
            if ($user['role'] !== 'owner') {
                fatal('Nur der Inhaber darf Zugänge verwalten.', 403);
            }
            $em = strtolower(trim((string)($_POST['email'] ?? '')));
            $nm = trim((string)($_POST['name'] ?? ''));
            if (!filter_var($em, FILTER_VALIDATE_EMAIL) || mb_strlen($em) > 190) {
                $back(AR_BASE . '/admin/?p=users', 'Ungültige E-Mail-Adresse.', 'err');
            }
            $domain = strtolower((string)parse_url((string)cfg('site_url'), PHP_URL_HOST));
            if ($domain !== '' && str_ends_with($em, '@' . $domain)) {
                $back(AR_BASE . '/admin/?p=users', 'Das Postfach darf nicht auf der eigenen Domain liegen (Postfach und Domain bleiben getrennt).', 'err');
            }
            if (find_user($em)) {
                $back(AR_BASE . '/admin/?p=users', 'Diese Adresse hat bereits Zugang.', 'err');
            }
            q('INSERT INTO ar_users (email, name, role, created_at) VALUES (?,?,?,?)', [$em, mb_substr($nm, 0, 120), 'editor', time()]);
            audit($who, 'add_user', $em);
            $back(AR_BASE . '/admin/?p=users', 'Zugang angelegt. Die Person meldet sich mit dieser Adresse und einem Code an.');

        case 'remove_user':
            if ($user['role'] !== 'owner') {
                fatal('Nur der Inhaber darf Zugänge verwalten.', 403);
            }
            $uid = (int)($_POST['id'] ?? 0);
            $tu = q('SELECT * FROM ar_users WHERE id = ?', [$uid])->fetch();
            if (!$tu || $tu['role'] === 'owner') {
                $back(AR_BASE . '/admin/?p=users', 'Dieser Zugang kann nicht entfernt werden.', 'err');
            }
            q('DELETE FROM ar_sessions WHERE user_id = ?', [$uid]);
            q('DELETE FROM ar_users WHERE id = ?', [$uid]);
            audit($who, 'remove_user', $tu['email']);
            $back(AR_BASE . '/admin/?p=users', 'Zugang entfernt.');

        case 'export':
            if ($user['role'] !== 'owner') {
                fatal('Nur der Inhaber darf die Sicherung herunterladen.', 403);
            }
            audit($who, 'export');
            header('Content-Type: application/json; charset=utf-8');
            header('Content-Disposition: attachment; filename="sicherung-' . date('Y-m-d') . '.json"');
            echo export_json();
            exit;

        case 'backup_now':
            if ($user['role'] !== 'owner') {
                fatal('Nur der Inhaber darf Sicherungen verwalten.', 403);
            }
            $ok = backup_mail();
            audit($who, 'backup_mail', $ok ? 'ok' : 'fehlgeschlagen');
            $back(AR_BASE . '/admin/?p=backup', $ok ? 'Sicherung wurde per Mail verschickt.' : 'Mailversand fehlgeschlagen – siehe Systemcheck.', $ok ? 'ok' : 'err');

        case 'import_backup': {
            if ($user['role'] !== 'owner') {
                fatal('Nur der Inhaber darf Sicherungen verwalten.', 403);
            }
            if (empty($_POST['confirm']) || empty($_FILES['backup']['tmp_name']) || !is_uploaded_file($_FILES['backup']['tmp_name']) || $_FILES['backup']['size'] > 20 * 1048576) {
                $back(AR_BASE . '/admin/?p=backup', 'Bitte Datei wählen und bestätigen.', 'err');
            }
            [$ok, $msg] = import_data((string)file_get_contents($_FILES['backup']['tmp_name']), $who);
            audit($who, 'import_backup', $ok ? 'ok' : 'fehlgeschlagen');
            $back(AR_BASE . '/admin/?p=backup', $msg, $ok ? 'ok' : 'err');
        }

        case 'media_upload': {
            [$n, $errs] = store_uploaded_images($_FILES['files'] ?? []);
            audit($who, 'media_upload', (string)$n);
            if ($errs) {
                $back(AR_BASE . '/admin/?p=media', $n . ' hochgeladen. Fehler: ' . implode(' ', $errs), 'err');
            }
            $back(AR_BASE . '/admin/?p=media', $n ? $n . ' Bild(er) hochgeladen.' : 'Keine Datei gewählt.', $n ? 'ok' : 'err');
        }

        case 'media_delete': {
            $nm = (string)($_POST['name'] ?? '');
            if (!preg_match('~^[a-z0-9_-]+\.(jpg|png|webp)$~', $nm) || isset(media_usage()[$nm]) || !is_file(upload_dir() . '/' . $nm)) {
                $back(AR_BASE . '/admin/?p=media', 'Bild wird noch verwendet oder existiert nicht.', 'err');
            }
            @unlink(upload_dir() . '/' . $nm);
            audit($who, 'media_delete', $nm);
            $back(AR_BASE . '/admin/?p=media', 'Bild gelöscht.');
        }

        case 'session_revoke': {
            $h = (string)($_POST['h'] ?? '');
            $row = q('SELECT user_id FROM ar_sessions WHERE token_hash = ?', [$h])->fetch();
            if ($row && ($user['role'] === 'owner' || (int)$row['user_id'] === (int)$user['user_id']) && !hash_equals($h, current_token_hash())) {
                q('DELETE FROM ar_sessions WHERE token_hash = ?', [$h]);
                audit($who, 'session_revoke');
            }
            $back(AR_BASE . '/admin/?p=sessions', 'Gerät abgemeldet.');
        }

        case 'sessions_revoke_others':
            q('DELETE FROM ar_sessions WHERE user_id = ? AND token_hash <> ?', [(int)$user['user_id'], current_token_hash()]);
            audit($who, 'sessions_revoke_others');
            $back(AR_BASE . '/admin/?p=sessions', 'Alle anderen Geräte wurden abgemeldet.');

        case 'account_save': {
            $errs = [];
            $nm = mb_substr(trim((string)($_POST['name'] ?? '')), 0, 120);
            $row = q('SELECT pw_hash FROM ar_users WHERE id = ?', [(int)$user['user_id']])->fetch();
            $hasPw = !empty($row['pw_hash']);
            $new = (string)($_POST['new_pw'] ?? '');
            $remove = !empty($_POST['remove_pw']);
            if (($new !== '' || $remove) && $hasPw && !password_verify((string)($_POST['current_pw'] ?? ''), (string)$row['pw_hash'])) {
                $errs[] = 'Das aktuelle Passwort stimmt nicht.';
            }
            if ($new !== '' && !$errs) {
                if (mb_strlen($new) < 12) {
                    $errs[] = 'Das Passwort braucht mindestens 12 Zeichen.';
                } elseif ($new !== (string)($_POST['new_pw2'] ?? '')) {
                    $errs[] = 'Die beiden Passwörter stimmen nicht überein.';
                }
            }
            if ($errs) {
                view_account($user, $errs);
                exit;
            }
            q('UPDATE ar_users SET name = ? WHERE id = ?', [$nm, (int)$user['user_id']]);
            if ($new !== '') {
                q('UPDATE ar_users SET pw_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), (int)$user['user_id']]);
                audit($who, 'password_set');
            } elseif ($remove) {
                q('UPDATE ar_users SET pw_hash = NULL WHERE id = ?', [(int)$user['user_id']]);
                audit($who, 'password_removed');
            }
            $back(AR_BASE . '/admin/?p=account', 'Gespeichert.');
        }

        case 'test_mail':
            $ok = send_mail($user['email'], 'Testmail der Verwaltung', "Wenn du diese Mail liest, funktioniert der Mailversand.\n");
            $back(AR_BASE . '/admin/?p=check', $ok ? 'Testmail wurde verschickt – bitte Postfach prüfen.' : 'Mailversand fehlgeschlagen. Siehe Hinweise unten.', $ok ? 'ok' : 'err');
    }
    fatal('Unbekannte Aktion.', 400);
}

// ---------- Anzeige ----------
if (isset($_COOKIE['ar_flash'])) {
    [$ft, $fm] = array_pad(explode('|', (string)$_COOKIE['ar_flash'], 2), 2, '');
    $flash = ['type' => $ft === 'err' ? 'err' : 'ok', 'msg' => rawurldecode($fm)];
    setcookie('ar_flash', '', ['expires' => time() - 3600, 'path' => AR_BASE . '/admin/']);
}
$GLOBALS['flash'] = $flash;
$s = schema();

switch ($p) {
    case 'list':
        $c = (string)($_GET['c'] ?? '');
        isset($s['collections'][$c]) ? view_list($user, $c) : view_home($user);
        break;
    case 'edit':
        $c = (string)($_GET['c'] ?? '');
        if (!isset($s['collections'][$c])) {
            view_home($user);
            break;
        }
        $id = (int)($_GET['id'] ?? 0) ?: null;
        if ($id) {
            $it = item($id);
            if (!$it || $it['coll'] !== $c || $it['_deleted'] !== null) {
                view_home($user);
                break;
            }
            view_edit_item($user, $c, $id, $it, []);
        } else {
            view_edit_item($user, $c, null, field_defaults($s['collections'][$c]['fields']), []);
        }
        break;
    case 'group':
        $g = (string)($_GET['g'] ?? '');
        isset($s['groups'][$g]) ? view_edit_group($user, $g, setting($g, true), []) : view_home($user);
        break;
    case 'trash':
        view_trash($user);
        break;
    case 'media':
        view_media($user);
        break;
    case 'media_json':
        header('Content-Type: application/json');
        echo json_encode(array_map(fn($m) => ['name' => $m['name'], 'url' => $m['url']], media_list()));
        break;
    case 'sessions':
        view_sessions($user);
        break;
    case 'account':
        view_account($user);
        break;
    case 'backup':
        view_backup($user);
        break;
    case 'users':
        view_users($user);
        break;
    case 'log':
        view_log($user);
        break;
    case 'check':
        view_check($user);
        break;
    default:
        view_home($user);
}
