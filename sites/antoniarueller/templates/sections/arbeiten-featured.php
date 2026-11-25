<?php $fc = $featured; $fImg = upload_url($fc['still']); $fBy = array_filter([trim($hero['first'] . ' ' . $hero['last']), trim((string)$fc['outlet'])]); ?>
<section<?= $idPlaced ? '' : ' id="arbeiten"' ?> aria-label="<?= tr('Featured Clip') ?>" style="padding-top:96px">
<article class="fa">
<div class="fa-mast"><span><?= e(tr($sec['feat_label'])) ?></span><span><?= e($fc['_cat'] !== '' ? $fc['_cat'] : media_label($fc['medium'])) ?></span><span><?= e(implode(' · ', array_filter([(string)$fc['outlet'], (string)$fc['_date']]))) ?></span></div>
<div class="fa-body<?= $fImg !== '' ? ' has-img' : '' ?>">
<div class="fa-main">
<?php $kick = implode(' · ', array_filter([(string)$fc['_cat'], (string)$fc['short']])); if ($kick !== ''): ?><p class="fa-kick"><?= e($kick) ?></p><?php endif; ?>
<h2 class="ar-feat-h"><?= e($fc['title']) ?></h2>
<?php if ($fc['desc'] !== ''): ?><p class="fa-stand"><?= e($fc['desc']) ?></p><?php endif; ?>
<div class="fa-foot">
<span class="fa-by"><?= $fBy ? e(tr($sec['feat_by'])) . ' <b>' . e(array_shift($fBy)) . '</b>' . ($fBy ? ' · ' . e(implode(' · ', $fBy)) : '') : '' ?></span>
<?php if ($fc['_hosted']): ?><button type="button" class="fa-cta" data-gal="<?= (int)$fc['_id'] ?>" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>"><?= icon($fc['medium'], 16) ?><span><?= e(tr($fc['_cta'])) ?></span><span aria-hidden="true">→</span></button>
<?php elseif ($fc['_href'] !== ''): ?><a class="fa-cta" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>" href="<?= e($fc['_href']) ?>" <?= $fc['_blank'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>><?= icon($fc['medium'], 16) ?><span><?= e(tr($fc['_cta'])) ?></span><span aria-hidden="true">→</span></a><?php endif; ?>
</div>
</div>
<?php if ($fImg !== ''): ?><figure class="fa-img"><?php $fv = img_square_set((string)$fc['still'], (string)($fc['still_focus'] ?? '')); ?><img src="<?= e($fv['src'] ?? $fImg) ?>"<?= $fv ? ' srcset="' . e($fv['srcset']) . '" sizes="(max-width: 900px) min(420px, calc(100vw - 40px)), min(400px, 28vw)" width="' . $fv['size'] . '" height="' . $fv['size'] . '"' : '' ?> alt="" loading="lazy" style="object-position:<?= e(focus_pos((string)($fc['still_focus'] ?? ''))) ?>"><?php if (trim((string)($fc['still_credit'] ?? '')) !== ''): ?><figcaption class="cred"><?= e($fc['still_credit']) ?></figcaption><?php endif; ?></figure><?php else: ?><div class="fa-no" aria-hidden="true"><?= e($fc['_no']) ?></div><?php endif; ?>
</div>
</article>
</section>
