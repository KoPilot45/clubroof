<?php if ($stripLogos): ?>
<ul class="cv-logos" role="list">
<?php foreach ($stripLogos as $lgo): $lu = upload_url($lgo['logo']); ?>
<li><?php if ($lgo['url'] !== ''): ?><a href="<?= e($lgo['url']) ?>" target="_blank" rel="noopener noreferrer"><?php endif; ?><img src="<?= e($lu) ?>"<?= img_attrs($lgo['logo']) ?> alt="<?= e($lgo['org']) ?>" loading="lazy" decoding="async"><?php if ($lgo['url'] !== ''): ?></a><?php endif; ?></li>
<?php endforeach; ?>
</ul>
<?php endif; ?>
