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
            if (login_verify($email, (string)($_POST['code'] ?? ''))) {
                header('Location: ' . AR_BASE . '/admin/');
                exit;
            }
            $step = 'code';
            $error = 'Der Code ist ungültig oder abgelaufen. Bitte neuen Code anfordern.';
        }
    }
    view_login($step, $email, $error);
    exit;
}

// ---------- Aktionen (nur POST + CSRF) ----------
$flash = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check($user);
    register_shutdown_function('regenerate_seo_files');
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
            $id = save_item($coll, $id, $data, $who);
            audit($who, 'save_item', $coll . '#' . $id . ' ' . ($data[$s['collections'][$coll]['title']] ?? ''));
            $back(AR_BASE . '/admin/?p=list&c=' . $coll, 'Gespeichert.');
        }

        case 'save_group': {
            $g = (string)($_POST['g'] ?? '');
            if (!isset($s['groups'][$g])) {
                fatal('Unbekannter Bereich.', 400);
            }
            $old = setting($g);
            [$data, $errors] = sanitize_fields($s['groups'][$g]['fields'], $_POST, $_FILES, $old);
            if ($errors) {
                view_edit_group($user, $g, array_merge($old, $data), $errors);
                exit;
            }
            save_setting($g, $data, $who);
            cleanup_uploads();
            audit($who, 'save_group', $g);
            $back(AR_BASE . '/admin/?p=group&g=' . $g, 'Gespeichert.');
        }

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
        isset($s['groups'][$g]) ? view_edit_group($user, $g, setting($g), []) : view_home($user);
        break;
    case 'trash':
        view_trash($user);
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
