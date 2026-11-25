<?php
// Erzeugt assets/fonts-all.css (alle Schriften des Katalogs; nur für die Schrift-Seite im Backend).
// Aufruf: php tools/fonts-build.php
$_SERVER['SCRIPT_NAME'] = '/index.php';
require dirname(__DIR__) . '/lib/fonts.php';
$css = "/* Alle wählbaren Schriften (SIL Open Font License) – nur für die Schrift-Seite im Backend, damit die Beispiele in der jeweiligen Schrift erscheinen. */\n";
foreach (font_catalog() as $role => $fonts) {
    foreach (array_keys($fonts) as $key) {
        $css .= font_faces_css([$role => $key], 'fonts');
    }
}
file_put_contents(dirname(__DIR__) . '/assets/fonts-all.css', $css);
echo strlen($css), " Bytes, ", substr_count($css, '@font-face'), " Schriftschnitte\n";
