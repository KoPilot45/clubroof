<section<?= $idPlaced ? '' : ' id="arbeiten"' ?> aria-label="<?= tr('Featured Clip') ?>" style="padding-top:96px">
<article class="fs<?= $fImg !== '' ? ' has-img' : '' ?>">
<div class="fs-head"><span><b><?= e(tr($sec['feat_label'])) ?></b> · <?= e($fc['_cat'] !== '' ? $fc['_cat'] : media_label($fc['medium'])) ?></span><span><?= e(implode(' · ', array_filter([$fBy, (string)$fc['_date']]))) ?></span></div>
<div class="fs-body">
<?php if ($fImg !== ''): ?><figure class="fs-img"><?php $fv = img_square_set((string)$fc['still'], (string)($fc['still_focus'] ?? '')); ?><img src="<?= e($fv['src'] ?? $fImg) ?>"<?= $fv ? ' srcset="' . e($fv['srcset']) . '" sizes="(max-width: 900px) 300px, 380px" width="' . $fv['size'] . '" height="' . $fv['size'] . '"' : '' ?> alt="" loading="lazy" style="object-position:<?= e(focus_pos((string)($fc['still_focus'] ?? ''))) ?>"><?php if (trim((string)($fc['still_credit'] ?? '')) !== ''): ?><figcaption class="cred"><?= e($fc['still_credit']) ?></figcaption><?php endif; ?></figure><?php endif; ?>
<div class="fs-main">
<?php if (trim((string)$fc['short']) !== ''): ?><p class="fs-kick"><?= e($fc['short']) ?></p><?php endif; ?>
<h2 class="fs-h"><?= e($fc['title']) ?></h2>
<?php if ($fc['desc'] !== ''): ?><p class="fs-st"><?= e($fc['desc']) ?></p><?php endif; ?>
<?php if ($fc['_hosted']): ?><button type="button" class="fs-cta" data-gal="<?= (int)$fc['_id'] ?>" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>"><?= icon($fc['medium'], 16) ?><span><?= e(tr($fc['_cta'])) ?></span><span aria-hidden="true">→</span></button>
<?php elseif ($fc['_href'] !== ''): ?><a class="fs-cta" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>" href="<?= e($fc['_href']) ?>" <?= $fc['_blank'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>><?= icon($fc['medium'], 16) ?><span><?= e(tr($fc['_cta'])) ?></span><span aria-hidden="true">→</span></a><?php endif; ?>
</div>
</div>
</article>
</section>
