<?php if ($sec['on_about']): ?>
<section id="ueber" aria-label="<?= e(tr($sec['about_label'])) ?>" style="padding-top:144px">
<h2 class="sr-only"><?= e(tr($sec['about_label'])) ?></h2>
<?= sec_head($no['about'], $sec['about_label'], $about['right'], '48px') ?>
<div class="ag<?= upload_url($about['portrait']) === '' ? ' no-ph' : '' ?>">
<?php if (upload_url($about['portrait']) !== ''): ?><div class="ag-ph"><?= about_photo_html($about, 'ag-img', '(max-width: 760px) 100vw, 520px') ?></div><?php endif; ?>
<div class="ag-tx">
<?php if ($about['headline'] !== ''): ?><p class="ag-h"><?= mk($about['headline']) ?></p><?php endif; ?>
<div class="ag-cols"><?php foreach ([$about['text1'], $about['text2']] as $t): if ($t === '') { continue; } ?><p><?= nl2br(e($t)) ?></p><?php endforeach; ?></div>
<?php foreach ($subOrder['about'] as $subId): if ($sub[$subId]) { include __DIR__ . '/../about-' . $subId . '.php'; } endforeach; ?>
</div>
</div>
</section>
<?php endif; ?>
