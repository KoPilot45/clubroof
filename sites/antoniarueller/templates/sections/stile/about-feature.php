<?php if ($sec['on_about']): ?>
<section id="ueber" aria-label="<?= e(tr($sec['about_label'])) ?>" style="padding-top:144px">
<h2 class="sr-only"><?= e(tr($sec['about_label'])) ?></h2>
<?= sec_head($no['about'], $sec['about_label'], $about['right'], '40px') ?>
<?php if ($about['headline'] !== ''): ?><p class="af-h"><?= mk($about['headline']) ?></p><?php endif; ?>
<div class="af<?= upload_url($about['portrait']) === '' ? ' no-ph' : '' ?>">
<div class="af-left">
<div class="af-cols"><?php foreach ([$about['text1'], $about['text2']] as $t): if ($t === '') { continue; } ?><p><?= nl2br(e($t)) ?></p><?php endforeach; ?></div>
<div class="af-band">
<?php foreach ($subOrder['about'] as $subId): if ($sub[$subId]) { include __DIR__ . '/../about-' . $subId . '.php'; } endforeach; ?>
</div>
</div>
<?php if (upload_url($about['portrait']) !== ''): ?><figure class="af-ph"><?= about_photo_html($about, 'af-img', '(max-width: 760px) 100vw, 380px') ?></figure><?php endif; ?>
</div>
</section>
<?php endif; ?>
