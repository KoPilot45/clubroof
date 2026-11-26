<?php if ($__tpl = style_template('about')) { include $__tpl; return; } ?>
<?php if ($sec['on_about']): ?>
<section id="ueber" aria-label="<?= e(tr($sec['about_label'])) ?>" style="padding-top:144px">
<h2 class="sr-only"><?= e(tr($sec['about_label'])) ?></h2>
<?= sec_head($no['about'], $sec['about_label'], $about['right'], '48px') ?>
<div class="about">
<?php if (upload_url($about['portrait']) !== ''): ?>
<div class="about-img"><?php $pv = img_width_set((string)$about['portrait']); ?><img src="<?= e(upload_url($about['portrait'])) ?>"<?= $pv ? ' srcset="' . e($pv['srcset']) . '" sizes="(max-width: 500px) calc(100vw - 40px), 460px"' : '' ?><?= img_attrs($about['portrait']) ?> alt="<?= e($about['portrait_alt']) ?>" loading="lazy" decoding="async"><?php if ($about['onair'] !== ''): ?><span class="ar-onair"><?= e($about['onair']) ?></span><?php endif; ?></div>
<?php endif; ?>
<div class="about-r">
<?php if ($about['headline'] !== ''): ?><p class="about-h"><?= mk($about['headline']) ?></p><?php endif; ?>
<div class="about-cols"><?php foreach ([$about['text1'], $about['text2']] as $t): if ($t === '') { continue; } ?><p><?= nl2br(e($t)) ?></p><?php endforeach; ?></div>
<?php foreach ($subOrder['about'] as $subId): if ($sub[$subId]) { include __DIR__ . '/about-' . $subId . '.php'; } endforeach; ?>
</div>
</div>
</section>
<?php endif; ?>
