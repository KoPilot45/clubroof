<div class="muted list-h"><?= e($sec['show_all']) ?></div>
<ol class="clip-list">
<?php foreach ($clips as $n => $c): $cImg = upload_url((string)$c['still']); $ext = $c['_href']; $cat = $c['_cat'] !== '' ? $c['_cat'] : media_label($c['medium']); ?>
<li class="ar-clip" id="clip-<?= $c['_id'] ?>" data-id="<?= $c['_id'] ?>">
<?php if ($c['_hosted']): ?><button type="button" class="cl-link" data-gal="<?= (int)$c['_id'] ?>" data-ev="clip" data-k="<?= (int)$c['_id'] ?>">
<?php elseif ($ext !== ''): ?><a class="cl-link" data-ev="clip" data-k="<?= (int)$c['_id'] ?>" href="<?= e($ext) ?>" <?= $c['_blank'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>>
<?php else: ?><div class="cl-link">
<?php endif; ?>
<span class="cl-fig<?= $cImg === '' ? ' txt t' . ($n % 2) : '' ?>"><?php if ($cImg !== ''): ?><?php $iv = img_square_set((string)$c['still'], (string)($c['still_focus'] ?? '')); ?><img src="<?= e($iv['src'] ?? $cImg) ?>"<?= $iv ? ' srcset="' . e($iv['srcset']) . '" sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) calc(50vw - 60px), min(430px, calc((100vw - 152px) / 3))" width="' . $iv['size'] . '" height="' . $iv['size'] . '"' : img_attrs((string)$c['still']) ?> alt="" loading="lazy" decoding="async" style="object-position:<?= e(focus_pos((string)($c['still_focus'] ?? ''))) ?>"><?php endif; ?><span class="cl-no"><?= e($c['_no']) ?></span><span class="cl-kind"><?= icon($c['medium'], 14) ?><?= e($cat) ?></span><?php if ($cImg !== '' && trim((string)($c['still_credit'] ?? '')) !== ''): ?><span class="cl-cred cred"><?= e($c['still_credit']) ?></span><?php endif; ?></span>
<span class="ar-clip-title"><?= e($c['title']) ?></span>
<?php if (trim((string)$c['desc']) !== ''): ?><span class="cl-desc"><?= e($c['desc']) ?></span><?php endif; ?>
<span class="cl-meta"><?= implode('', array_map(fn($x) => '<span>' . e($x) . '</span>', array_filter([(string)$c['outlet'], (string)$c['_date']]))) ?></span>
<?php if (trim((string)$c['role']) !== ''): ?><span class="cl-role"><?= e(tr($sec['role_label'])) ?> <?= e($c['role']) ?></span><?php endif; ?>
<?php if ($c['_hosted']): ?><span class="cl-cta"><span><?= e(tr($c['_cta'])) ?></span><span aria-hidden="true">→</span></span></button>
<?php elseif ($ext !== ''): ?><span class="cl-cta"><span><?= e(tr($c['_cta'])) ?></span><span aria-hidden="true">→</span></span></a>
<?php else: ?></div>
<?php endif; ?>
</li>
<?php endforeach; ?>
</ol>
