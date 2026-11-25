<?php if ($showCv):
    $stripLogos = cv_logo_strip($cvGroups);
    $cvI = 0;
?>
<section id="lebenslauf" aria-label="<?= e(tr($sec['cv_label'])) ?>" style="padding-top:144px">
<?= sec_head($no['cv'], $sec['cv_label'], ($cvMin ? $cvMin . ' — ' . tr($sec['cv_today']) : '') . ($sec['cv_right'] !== '' ? ' · ' . $sec['cv_right'] : ''), '24px') ?>
<?php if (trim($sec['cv_h1'] . $sec['cv_h2']) !== ''): ?><h2 class="big-h" style="margin-bottom:40px"><span class="bh1"><?= e($sec['cv_h1']) ?></span><span class="bh2"><?= e($sec['cv_h2']) ?></span></h2><?php else: ?><h2 class="sr-only"><?= e($sec['cv_label']) ?></h2><?php endif; ?>
<?php foreach ($subOrder['cv'] as $subId): if ($sub[$subId]) { include __DIR__ . '/cv-' . $subId . '.php'; } endforeach; ?>
<?php if (upload_url($contact['cv_pdf']) !== ''): ?><div style="display:flex;justify-content:flex-end;margin-top:24px"><a class="btn-solid" data-ev="cv" data-k="pdf" href="<?= e(upload_url($contact['cv_pdf'])) ?>" target="_blank" rel="noopener" download><?= e($sec['cv_pdf_label']) ?> <span aria-hidden="true">↓</span></a></div><?php endif; ?>
</section>
<?php endif; ?>
