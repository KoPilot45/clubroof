<?php
// Arbeiten: Featured, Schnittplatz und Beitragsliste in der gewählten Reihenfolge. Aufeinanderfolgende Teile teilen sich einen Abschnitt;
// die Kopfzeile („REC 01 — Showreel“) steht vor dem ersten Teil des Showreels, die id „arbeiten“ am ersten Abschnitt.
$idPlaced = false;
$open = false;
$headDone = false;
foreach ($subOrder['arbeiten'] as $subId):
    if ($subId === 'featured') {
        if (!$featured || !$sub['featured']) {
            continue;
        }
        if ($open) {
            echo "</section>\n";
            $open = false;
        }
        include __DIR__ . '/arbeiten-featured.php';
        $idPlaced = true;
        continue;
    }
    if (!$clips || !$sec['on_show'] || !$sub[$subId]) {
        continue;
    }
    $first = $clips[0];
    if (!$open):
        $open = true;
?>
<section aria-label="<?= e(tr($sec['show_label'])) ?>"<?= $idPlaced ? '' : ' id="arbeiten"' ?> style="padding-top:<?= $headDone ? 80 : 128 ?>px">
<?php
        $idPlaced = true;
    endif;
    if (!$headDone) {
        $headDone = true;
        include __DIR__ . '/arbeiten-head.php';
    }
    include __DIR__ . '/arbeiten-' . $subId . '.php';
endforeach;
if ($open) {
    echo "</section>\n";
}
