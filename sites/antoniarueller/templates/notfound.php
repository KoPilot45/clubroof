<?php
/** Inhalt der 404-Seite (wird von templates/legal.php eingebunden). */
$home = lang_url(current_lang(), '');
$links = [];
foreach (items_shown('nav') as $nv) {
    if (preg_match('~^[a-z]+$~', (string)$nv['anchor'])) {
        $links[] = ['label' => (string)$nv['label'], 'href' => $home . '#' . $nv['anchor']];
    }
}
?>
<section class="nf" aria-labelledby="nf-h">
<?= sec_head('404', 'Clip nicht gefunden', 'TC 00:00:00:00', '40px') ?>
<p class="nf-code" aria-hidden="true"><span class="ar-outline">4</span><span class="nf-zero"></span><span class="ar-outline">4</span></p>
<h1 class="nf-h" id="nf-h"><?= mk(tr('Diese Seite gibt es *nicht* (mehr).')) ?></h1>
<p class="nf-p"><?= e(tr('Der Link ist vielleicht veraltet oder falsch geschrieben. Hier geht es weiter:')) ?></p>
<div class="nf-btns">
<a class="btn-solid btn-lg" href="<?= e($home) ?>"><?= e(tr('Zur Startseite')) ?> <span aria-hidden="true">→</span></a>
<?php foreach (array_slice($links, 0, 3) as $lk): ?><a class="btn-ghost btn-lg" href="<?= e($lk['href']) ?>"><?= e($lk['label']) ?></a>
<?php endforeach; ?>
</div>
</section>
