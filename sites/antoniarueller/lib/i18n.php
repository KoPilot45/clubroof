<?php
declare(strict_types=1);

/** Feste Oberflächentexte der Seite: deutscher Text => englischer Text. */
function ui_en(): array
{
    return [
        'Zum Inhalt springen' => 'Skip to content', 'Hauptnavigation' => 'Main navigation', 'Menü öffnen' => 'Open menu', 'Menü' => 'Menu', 'Menü schließen' => 'Close menu',
        'Mobile Navigation' => 'Mobile navigation', 'Intro' => 'Intro', 'Was mich antreibt' => 'What drives me', 'Featured Clip' => 'Featured clip', 'Showreel' => 'Showreel',
        'Vorheriger Clip' => 'Previous clip', 'Hauptbeitrag' => 'Featured story', 'Nach oben' => 'Back to top', 'Von' => 'By', 'Clip wechseln' => 'Switch clip', 'Nächster Clip' => 'Next clip', 'Podcast' => 'Podcast', 'Stationen' => 'Stations', 'Lebenslauf' => 'CV', 'Über' => 'About',
        'Über mich' => 'About me', 'Off the record' => 'Off the record', 'Kontakt' => 'Contact', 'Clip anklicken für Details' => 'Select a clip for details', 'Clip anklicken: springt zum Beitrag' => 'Select a clip to jump to the post', 'Nur diese Spur zeigen' => 'Show this track only', 'Spur' => 'Track',
        'Zum Beitrag' => 'View story', 'Beitrag ansehen' => 'View piece', 'Galerie' => 'Gallery', 'Schließen' => 'Close', 'Zurück' => 'Previous', 'Weiter' => 'Next', 'von' => 'of', 'PDF öffnen' => 'Open PDF', 'AR / Menü' => 'AR / Menu', 'Seite nicht gefunden' => 'Page not found', 'Diese Seite gibt es *nicht* (mehr).' => 'This page does *not* exist (any more).', 'Der Link ist vielleicht veraltet oder falsch geschrieben. Hier geht es weiter:' => 'The link may be outdated or mistyped. Continue here:', 'Clip nicht gefunden' => 'Clip not found', 'Programm' => 'Program', 'Redaktion:' => 'Outlet:', 'Rolle:' => 'Role:', 'Anhören bei' => 'Listen on', 'Folge' => 'Episode', 'E-Mail schreiben' => 'Write an email',
        'Impressum' => 'Imprint', 'Datenschutz' => 'Privacy', 'heute' => 'today', 'seit' => 'since', 'Zur Startseite' => 'Back to home', 'Clips' => 'clips',
        'öffnet in neuem Tab' => 'opens in a new tab', 'Beitrag öffnen' => 'Open story', 'Video / TV' => 'Video / TV', 'Text / Online' => 'Text / online', 'Radio' => 'Radio',
        'YouTube / Social' => 'YouTube / social', 'Social' => 'Social', 'Video' => 'Video', 'Text' => 'Text', 'Deutsche Version' => 'Deutsche Version', 'Sprache' => 'Language',
        'Zum Inhalt' => 'To content', 'Mailprogramm öffnet sich nicht? Adresse:' => 'Mail app not opening? Address:', 'Kopieren' => 'Copy', 'Kopiert' => 'Copied',
        'Bitte JavaScript aktivieren, um die E-Mail-Adresse zu sehen – oder im Impressum nachsehen.' => 'Please enable JavaScript to see the email address – or check the imprint.',
    ];
}

/** Übersetzt einen festen Text, wenn die englische Seite angezeigt wird. */
function tr(string $de): string
{
    static $m = null;
    if (current_lang() !== 'en') {
        return $de;
    }
    $m ??= ui_en();
    return $m[$de] ?? $de;
}

function lang_url(string $lang, string $page = ''): string
{
    if (defined('AR_PREVIEW')) {
        return AR_BASE . '/admin/vorschau.php?lang=' . $lang . ($page !== '' ? '&seite=' . $page : '');
    }
    $paths = $lang === 'en'
        ? ['' => '/en/', 'impressum' => '/en/imprint/', 'datenschutz' => '/en/privacy/']
        : ['' => '/', 'impressum' => '/impressum/', 'datenschutz' => '/datenschutz/'];
    return AR_BASE . ($paths[$page] ?? $paths['']);
}

function legal_url(string $page): string
{
    return lang_url(current_lang(), $page);
}

function media_label(string $m): string
{
    return tr(media_options()[$m] ?? '');
}
