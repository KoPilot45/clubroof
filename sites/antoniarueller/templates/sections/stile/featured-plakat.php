<section<?= $idPlaced ? '' : ' id="arbeiten"' ?> aria-label="<?= tr('Featured Clip') ?>" style="padding-top:96px">
<article class="fp<?= $fImg !== '' ? ' has-img' : '' ?>">
<div class="fp-txt">
<span class="fp-tag"><?= e(tr($sec['feat_label'])) ?> · <?= e($fc['_cat'] !== '' ? $fc['_cat'] : media_label($fc['medium'])) ?></span>
<h2 class="fp-h"><?= e($fc['title']) ?></h2>
<?php if ($fc['desc'] !== ''): ?><p class="fp-st"><?= e($fc['desc']) ?></p><?php endif; ?>
<?php $meta = implode(' · ', array_filter([$fBy, (string)$fc['_date']])); if ($meta !== ''): ?><p class="fp-by"><?= e($meta) ?></p><?php endif; ?>
<?php if ($fc['_hosted']): ?><button type="button" class="fp-cta" data-gal="<?= (int)$fc['_id'] ?>" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>"><?= icon($fc['medium'], 16) ?><span><?= e(tr($fc['_cta'])) ?></span><span aria-hidden="true">→</span></button>
<?php elseif ($fc['_href'] !== ''): ?><a class="fp-cta" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>" href="<?= e($fc['_href']) ?>" <?= $fc['_blank'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>><?= icon($fc['medium'], 16) ?><span><?= e(tr($fc['_cta'])) ?></span><span aria-hidden="true">→</span></a><?php endif; ?>
</div>
<?php if ($fImg !== ''): ?><figure class="fp-card"><span class="cl-pin" aria-hidden="true"></span><div class="fp-img"><?php $fv = img_square_set((string)$fc['still'], (string)($fc['still_focus'] ?? '')); ?><img src="<?= e($fv['src'] ?? $fImg) ?>"<?= $fv ? ' srcset="' . e($fv['srcset']) . '" sizes="(max-width: 900px) 300px, 380px" width="' . $fv['size'] . '" height="' . $fv['size'] . '"' : '' ?> alt="" loading="lazy" style="object-position:<?= e(focus_pos((string)($fc['still_focus'] ?? ''))) ?>"></div><?php $kick = implode(' · ', array_filter([(string)$fc['_cat'], (string)$fc['short']])); ?><figcaption><?= e($kick !== '' ? $kick : (string)$fc['_no']) ?><?php if (trim((string)($fc['still_credit'] ?? '')) !== ''): ?> · <?= e($fc['still_credit']) ?><?php endif; ?></figcaption></figure><?php endif; ?>
</article>
</section>
