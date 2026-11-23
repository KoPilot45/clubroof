<?php
declare(strict_types=1);

// Anmeldung, „Passwort vergessen“, Passwort neu festlegen

function login_card_start(string $title, string $info = '', string $error = ''): void
{
    admin_head($title);
    echo '<div class="login"><div class="card"><div class="brand-l"><span class="dot"></span>Verwaltung <small>antoniarueller.de</small></div>';
    if ($info !== '') {
        echo '<div class="flash ok" role="status">' . e($info) . '</div>';
    }
    if ($error !== '') {
        echo '<div class="flash err" role="alert">' . e($error) . '</div>';
    }
}

function login_card_end(): void
{
    echo '</div></div>';
    admin_foot();
}

function view_login(string $step, string $email, string $error, string $info = ''): void
{
    login_card_start('Anmelden', $info, $error);
    if ($step === 'email') {
        ?>
<h1>Anmelden</h1>
<p>Gib deine E-Mail-Adresse ein. Wir senden dir einen Code für die Anmeldung.</p>
<form method="post" autocomplete="on" class="lf">
<input type="hidden" name="action" value="request">
<label for="email">E-Mail-Adresse</label>
<input id="email" name="email" type="email" required autofocus autocomplete="email" value="<?= e($email) ?>">
<button class="btn">Code senden</button>
</form>
<p class="again"><a href="<?= a('p=forgot') ?>">Passwort vergessen?</a></p>
<?php
    } else {
        ?>
<h1>Code eingeben</h1>
<p>Falls die Adresse freigegeben ist, haben wir einen 8-stelligen Code geschickt (<?= (int)cfg('code_valid_minutes', 10) ?> Minuten gültig). Keine Mail da? Bitte auch den Spam-Ordner prüfen.</p>
<form method="post" class="lf">
<input type="hidden" name="action" value="verify">
<input type="hidden" name="email" value="<?= e($email) ?>">
<label for="code">Code aus der E-Mail</label>
<input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{8,9}" maxlength="9" required autofocus class="code" placeholder="0000 0000">
<label for="pw">Passwort <small>(nur falls eingerichtet)</small></label>
<input id="pw" name="pw" type="password" autocomplete="current-password" placeholder="Dein Passwort">
<button class="btn">Anmelden</button>
</form>
<form method="post" class="again"><input type="hidden" name="action" value="request"><input type="hidden" name="email" value="<?= e($email) ?>"><button class="link">Neuen Code senden</button> · <a href="<?= a() ?>">Andere Adresse</a> · <a href="<?= a('p=forgot&e=' . rawurlencode($email)) ?>">Passwort vergessen?</a></form>
<?php
    }
    login_card_end();
}

function view_forgot(bool $sent, string $email): void
{
    login_card_start('Passwort vergessen');
    if ($sent) {
        ?>
<h1>Mail unterwegs</h1>
<p>Falls die Adresse freigegeben ist, haben wir dir einen Link zum Festlegen eines neuen Passworts geschickt. Er ist 30 Minuten gültig und nur einmal nutzbar. Prüfe auch den Spam-Ordner.</p>
<p class="again"><a href="<?= a() ?>">Zurück zur Anmeldung</a></p>
<?php
    } else {
        ?>
<h1>Passwort vergessen?</h1>
<p>Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du ein neues Passwort festlegst. Danach meldest du dich wie gewohnt mit E-Mail-Code und neuem Passwort an.</p>
<form method="post" autocomplete="on" class="lf">
<input type="hidden" name="action" value="forgot">
<label for="email">E-Mail-Adresse</label>
<input id="email" name="email" type="email" required autofocus autocomplete="email" value="<?= e($email) ?>">
<button class="btn">Link senden</button>
</form>
<p class="again"><a href="<?= a() ?>">Zurück zur Anmeldung</a></p>
<?php
    }
    login_card_end();
}

function view_reset(string $email, string $token, string $error, bool $checkOnly = false): void
{
    login_card_start('Neues Passwort', '', $checkOnly ? '' : $error);
    if ($checkOnly && $error !== '') {
        echo '<h1>Link ungültig</h1><p>' . e($error) . '</p><p class="again"><a href="' . a('p=forgot&e=' . rawurlencode($email)) . '">Neuen Link anfordern</a> · <a href="' . a() . '">Zur Anmeldung</a></p>';
        login_card_end();
        return;
    }
    ?>
<h1>Neues Passwort festlegen</h1>
<p>Mindestens 12 Zeichen. Ein langer Satz ist besser als ein kurzes kompliziertes Wort.</p>
<form method="post" class="lf" autocomplete="off">
<input type="hidden" name="action" value="reset_apply">
<input type="hidden" name="email" value="<?= e($email) ?>">
<input type="hidden" name="t" value="<?= e($token) ?>">
<label for="pw1">Neues Passwort</label>
<input id="pw1" name="pw1" type="password" minlength="12" required autofocus autocomplete="new-password" data-strength="1">
<label for="pw2">Passwort wiederholen</label>
<input id="pw2" name="pw2" type="password" minlength="12" required autocomplete="new-password">
<button class="btn">Passwort speichern</button>
</form>
<?php
    login_card_end();
}
