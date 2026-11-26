<?php if ($__tpl = style_template('list')) { include $__tpl; return; } ?>
<div class="muted list-h"><?= e($sec['show_all']) ?></div>
<ol class="clip-list">
<?php foreach ($clips as $n => $c): $cImg = upload_url((string)$c['still']); $ext = $c['_href']; $cat = $c['_cat'] !== '' ? $c['_cat'] : media_label($c['medium']);
$ctaIcon = $c['_hosted'] ? '<svg class="cl-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6"/></svg>' : '<svg class="cl-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 16L18 6M9 6h9v9M5 10v9h9"/></svg>';
$ctaHtml = '<span class="cl-cta"><span>' . e(tr($c['_cta'])) . '</span>' . $ctaIcon . '</span>'; ?>
<li class="ar-clip" id="clip-<?= $c['_id'] ?>" data-id="<?= $c['_id'] ?>"<?= $cImg === '' ? ' data-txt="1"' : '' ?>>
<span class="cl-pin" aria-hidden="true"></span>
<?php if ($c['_hosted']): ?><button type="button" class="cl-link" data-gal="<?= (int)$c['_id'] ?>" data-ev="clip" data-k="<?= (int)$c['_id'] ?>">
<?php elseif ($ext !== ''): ?><a class="cl-link" data-ev="clip" data-k="<?= (int)$c['_id'] ?>" href="<?= e($ext) ?>" <?= $c['_blank'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>>
<?php else: ?><div class="cl-link">
<?php endif; ?>
<span class="cl-kick"><b><?= icon($c['medium'], 14) ?><?= e($cat) ?></b><?php if (trim((string)$c['outlet']) !== ''): ?><span><?= e($c['outlet']) ?></span><?php endif; ?></span>
<span class="ar-clip-title"><?= e($c['title']) ?></span>
<?php if ($cImg !== ''): ?><span class="cl-fig"><?php $iv = img_square_set((string)$c['still'], (string)($c['still_focus'] ?? '')); ?><img src="<?= e($iv['src'] ?? $cImg) ?>"<?= $iv ? ' srcset="' . e($iv['srcset']) . '" sizes="(max-width: 600px) calc(100vw - 72px), (max-width: 1000px) calc(50vw - 72px), min(380px, calc((100vw - 190px) / 3))" width="' . $iv['size'] . '" height="' . $iv['size'] . '"' : img_attrs((string)$c['still']) ?> alt="" loading="lazy" decoding="async" style="object-position:<?= e(focus_pos((string)($c['still_focus'] ?? ''))) ?>"><?php if (trim((string)($c['still_credit'] ?? '')) !== ''): ?><span class="cl-cred cred"><?= e($c['still_credit']) ?></span><?php endif; ?></span>
<?php endif; ?>
<?php if (trim((string)$c['desc']) !== ''): ?><span class="cl-desc"><?= e($c['desc']) ?></span><?php endif; ?>
<span class="cl-foot"><span class="cl-nd"><span class="cl-no"><?= e($c['_no']) ?></span><?php if ($c['_date'] !== ''): ?><span class="cl-date"><?= e($c['_date']) ?></span><?php endif; ?></span><?php if ($c['_hosted'] || $ext !== ''): ?><?= $ctaHtml ?><?php if (!$c['_hosted'] && $c['_blank']): ?><span class="sr-only"> (<?= e(tr('öffnet in neuem Tab')) ?>)</span><?php endif; ?><?php endif; ?></span>
<?php if ($c['_hosted']): ?></button>
<?php elseif ($ext !== ''): ?></a>
<?php else: ?></div>
<?php endif; ?>
</li>
<?php endforeach; ?>
</ol>
