<?= sec_head($no['contact'], $sec['contact_label'], $contact['right'], '0') ?>
<div class="ka">
<h2 class="ka-h"><?= e($contact['h1']) ?></h2>
<p class="ka-in"><?= e($contact['intro']) ?></p>
<div class="ka-btns"><?= contact_mail_button($contact, $hasMail, $sec, 'ka-mail') ?><?= contact_social_links($social, 'ka-sl') ?></div>
<p class="mailnote" id="mailnote" aria-live="polite" hidden></p>
</div>
